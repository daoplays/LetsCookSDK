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
import { PROGRAM, SYSTEM_KEY } from "../../components/constants";
import { getNetworkConfig, uInt32ToLEBytes } from "../../utils/common";
import { FixableBeetStruct, array, bignum, u64, u8 } from "@metaplex-foundation/beet";
import { LaunchInstruction } from "../../state/common";
import { AMMPluginData, getAMMPlugins } from "../../state/cookAMM/plugins";
import { AMMData } from "../../state/cookAMM/types";

class PerformSwap_Instruction {
    constructor(
        readonly instruction: number,
        readonly side: number,
        readonly in_amount: bignum,
        readonly data: number[],
    ) {}

    static readonly struct = new FixableBeetStruct<PerformSwap_Instruction>(
        [
            ["instruction", u8],
            ["side", u8],
            ["in_amount", u64],
            ["data", array(u8)],
        ],
        (args) => new PerformSwap_Instruction(args.instruction!, args.side!, args.in_amount!, args.data!),
        "PerformSwap_Instruction",
    );
}

export function serialise_PerformSwap_Instruction(side: number, in_amount: bignum, jup_data: number[]): Buffer {
    const data = new PerformSwap_Instruction(LaunchInstruction.place_market_order, side, in_amount, jup_data);
    const [buf] = PerformSwap_Instruction.struct.serialize(data);

    return buf;
}

export const getPerformSwapInstruction = async (
    connection: Connection,
    token_amount: number,
    sol_amount: number,
    order_type: number,
    user: PublicKey,
    amm: AMMData,
): Promise<TransactionInstruction | null> => {
    // Initialize connection and check wallet

    if (user === null) return null;

    // Setup token mints and convert amounts to proper decimals
    const token_mint = amm.base_mint;
    const wsol_mint = amm.quote_mint;
    let mint_account = await getMintData(connection, token_mint.toString());

    if (!mint_account) {
        console.error("Mint account not found");
        return null;
    }

    token_amount = token_amount * Math.pow(10, mint_account.mint.decimals);
    sol_amount = sol_amount * Math.pow(10, 9);

    // Create temporary wrapped SOL account, needed to unwrap back to SOL
    let temp_wsol_account = PublicKey.findProgramAddressSync([user.toBytes(), Buffer.from("Temp")], PROGRAM)[0];

    // Determine AMM account ordering based on mint addresses
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

    // Generate associated token accounts
    let user_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        user, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

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

    // Check the AMM Plugins to see if we have trade to earn rewards
    let amm_plugins: AMMPluginData = getAMMPlugins(amm);
    let current_date = Math.floor(new Date().getTime() / 1000 / 24 / 60 / 60) - amm_plugins.trade_reward_first_date;
    let date_bytes = uInt32ToLEBytes(current_date);

    // If we have trade to earn rewards we will use extra accounts
    // for the user and total days trading
    let launch_date_account = PublicKey.findProgramAddressSync(
        [amm_data_account.toBytes(), date_bytes, Buffer.from("LaunchDate")],
        PROGRAM,
    )[0];

    let user_date_account = PublicKey.findProgramAddressSync([amm_data_account.toBytes(), user.toBytes(), date_bytes], PROGRAM)[0];

    // Token account for trade to earn rewards
    let trade_to_earn_account = PublicKey.findProgramAddressSync([amm_data_account.toBytes(), Buffer.from("TradeToEarn")], PROGRAM)[0];

    // Lets Cook user data account
    let user_data_account = PublicKey.findProgramAddressSync([user.toBytes(), Buffer.from("User")], PROGRAM)[0];

    // Time Series price data account
    let index_buffer = uInt32ToLEBytes(0);
    let price_data_account = PublicKey.findProgramAddressSync(
        [amm_data_account.toBytes(), index_buffer, Buffer.from("TimeSeries")],
        PROGRAM,
    )[0];

    // Handle transfer hook accounts if we have a token that has that extension
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
    const instruction_data = serialise_PerformSwap_Instruction(order_type, order_type === 0 ? sol_amount : token_amount, []);

    const config = await getNetworkConfig(connection);

    var account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: user_data_account, isSigner: false, isWritable: true },

        { pubkey: user_token_account_key, isSigner: false, isWritable: true },
        { pubkey: temp_wsol_account, isSigner: false, isWritable: true },

        { pubkey: token_mint, isSigner: false, isWritable: false },
        { pubkey: wsol_mint, isSigner: false, isWritable: false },

        { pubkey: amm_data_account, isSigner: false, isWritable: true },
        { pubkey: base_amm_account, isSigner: false, isWritable: true },
        { pubkey: quote_amm_account, isSigner: false, isWritable: true },

        { pubkey: trade_to_earn_account, isSigner: false, isWritable: true },

        { pubkey: launch_date_account, isSigner: false, isWritable: true },
        { pubkey: user_date_account, isSigner: false, isWritable: true },

        { pubkey: price_data_account, isSigner: false, isWritable: true },

        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: mint_account.token_program, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_KEY, isSigner: false, isWritable: false },
        { pubkey: config.COOK_FEES, isSigner: false, isWritable: true },
    ];

    // if we had transfer hook accounts we also need to add the
    // hook program and validation account
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
