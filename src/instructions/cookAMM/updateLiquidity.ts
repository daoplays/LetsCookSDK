import { PublicKey, TransactionInstruction, Connection, AccountMeta } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getTransferHook,
    resolveExtraAccountMeta,
    ExtraAccountMetaAccountDataLayout,
} from "@solana/spl-token";
import { getMintData } from "../../utils/tokens";
import { PROGRAM, SOL_ACCOUNT_SEED, SYSTEM_KEY } from "../../components/constants";
import { uInt32ToLEBytes } from "../../utils/common";
import { FixableBeetStruct, bignum, u64, u8 } from "@metaplex-foundation/beet";
import { LaunchInstruction } from "../../state/common";
import { AMMData } from "../../state/cookAMM/types";

class UpdateLiquidity_Instruction {
    constructor(
        readonly instruction: number,
        readonly side: number,
        readonly in_amount: bignum,
    ) {}

    static readonly struct = new FixableBeetStruct<UpdateLiquidity_Instruction>(
        [
            ["instruction", u8],
            ["side", u8],
            ["in_amount", u64],
        ],
        (args) => new UpdateLiquidity_Instruction(args.instruction!, args.side!, args.in_amount!),
        "UpdateLiquidity_Instruction",
    );
}

function serialise_update_liquidity(side: number, in_amount: bignum): Buffer {
    const data = new UpdateLiquidity_Instruction(LaunchInstruction.update_cook_liquidity, side, in_amount);
    const [buf] = UpdateLiquidity_Instruction.struct.serialize(data);

    return buf;
}

function serialise_remove_liquidity(side: number, in_amount: bignum): Buffer {
    const data = new UpdateLiquidity_Instruction(LaunchInstruction.remove_cook_liquidity, side, in_amount);
    const [buf] = UpdateLiquidity_Instruction.struct.serialize(data);

    return buf;
}

export const getUpdateCookLiquidityInstruction = async (
    connection: Connection,
    user: PublicKey,
    amm: AMMData,
    token_amount: number,
    order_type: number,
): Promise<TransactionInstruction | null> => {
    if (user === null) return null;

    const token_mint = amm.base_mint;
    const wsol_mint = amm.quote_mint;
    let mint_account = await getMintData(connection, token_mint.toString());

    if (!mint_account) {
        return null;
    }

    let user_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        user, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    let amm_seed_keys = [];
    if (token_mint.toString() < wsol_mint.toString()) {
        amm_seed_keys.push(token_mint);
        amm_seed_keys.push(wsol_mint);
    } else {
        amm_seed_keys.push(wsol_mint);
        amm_seed_keys.push(token_mint);
    }

    let amm_data_account = PublicKey.findProgramAddressSync(
        [amm_seed_keys[0].toBytes(), amm_seed_keys[1].toBytes(), Buffer.from("CookAMM")],
        PROGRAM,
    )[0];

    let base_amm_account = await getAssociatedTokenAddress(
        token_mint, // mint
        amm_data_account, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    let quote_amm_account = await getAssociatedTokenAddress(
        wsol_mint, // mint
        amm_data_account, // owner
        true, // allow owner off curve
        TOKEN_PROGRAM_ID,
    );

    let cook_lp_mint_account = PublicKey.findProgramAddressSync([amm_data_account.toBytes(), Buffer.from("LP")], PROGRAM)[0];

    let user_lp_token_account_key = await getAssociatedTokenAddress(
        cook_lp_mint_account, // mint
        user, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    let temp_wsol_account = PublicKey.findProgramAddressSync([user.toBytes(), Buffer.from("Temp")], PROGRAM)[0];

    let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    let transfer_hook = getTransferHook(mint_account.mint);

    let transfer_hook_program_account: PublicKey | null = null;
    let transfer_hook_validation_account: PublicKey | null = null;
    const extra_hook_accounts: AccountMeta[] = [];
    if (transfer_hook !== null) {
        transfer_hook_program_account = transfer_hook.programId;
        transfer_hook_validation_account = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), mint_account.mint.address.toBuffer()],
            transfer_hook_program_account,
        )[0];

        // check if the validation account exists
        const hook_accounts = await connection.getAccountInfo(transfer_hook_validation_account);

        if (hook_accounts) {
            const extra_account_metas = ExtraAccountMetaAccountDataLayout.decode(Uint8Array.from(hook_accounts.data));
            for (let i = 0; i < extra_account_metas.extraAccountsList.count; i++) {
                const extra = extra_account_metas.extraAccountsList.extraAccounts[i];
                const meta = await resolveExtraAccountMeta(
                    connection,
                    extra,
                    extra_hook_accounts,
                    Buffer.from([]),
                    transfer_hook_program_account,
                );
                extra_hook_accounts.push(meta);
            }
        }
    }

    const instruction_data = order_type == 0 ? serialise_update_liquidity(0, token_amount) : serialise_remove_liquidity(0, token_amount);

    var account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: token_mint, isSigner: false, isWritable: false },
        { pubkey: wsol_mint, isSigner: false, isWritable: false },
        { pubkey: cook_lp_mint_account, isSigner: false, isWritable: true },

        { pubkey: temp_wsol_account, isSigner: false, isWritable: true },
        { pubkey: user_token_account_key, isSigner: false, isWritable: true },
        { pubkey: user_lp_token_account_key, isSigner: false, isWritable: true },

        { pubkey: amm_data_account, isSigner: false, isWritable: true },
        { pubkey: base_amm_account, isSigner: false, isWritable: true },
        { pubkey: quote_amm_account, isSigner: false, isWritable: true },
        { pubkey: program_sol_account, isSigner: false, isWritable: false },

        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: mint_account.token_program, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_KEY, isSigner: false, isWritable: false },
    ];

    if (transfer_hook_program_account && transfer_hook_validation_account) {
        account_vector.push({ pubkey: transfer_hook_program_account, isSigner: false, isWritable: true });
        account_vector.push({ pubkey: transfer_hook_validation_account, isSigner: false, isWritable: true });

        for (let i = 0; i < extra_hook_accounts.length; i++) {
            account_vector.push({
                pubkey: extra_hook_accounts[i].pubkey,
                isSigner: extra_hook_accounts[i].isSigner,
                isWritable: extra_hook_accounts[i].isWritable,
            });
        }
    }

    const instruction = new TransactionInstruction({
        keys: account_vector,
        programId: PROGRAM,
        data: instruction_data,
    });

    return instruction;
};
