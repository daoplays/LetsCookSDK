import { CollectionData } from "../../state/collections/types";
import { PublicKey, TransactionInstruction, Connection, AccountMeta } from "@solana/web3.js";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    getTransferHook,
    resolveExtraAccountMeta,
    ExtraAccountMetaAccountDataLayout,
} from "@solana/spl-token";
import { Key, getAssetV1GpaBuilder, updateAuthority, AssetV1 } from "@metaplex-foundation/mpl-core";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED, CORE } from "../../components/constants";
import { CollectionKeys } from "../../state/collections/enums";
import { LaunchInstruction } from "../../state/common/enums";
import { uInt32ToLEBytes } from "../../utils/common";
import { BeetStruct, u8 } from "@metaplex-foundation/beet";
import { MintData } from "../../state/common/types";

function serialiseWrapInstruction(): Buffer {
    const data = new WrapNFTInstruction(LaunchInstruction.wrap_nft);

    const [buf] = WrapNFTInstruction.struct.serialize(data);

    return buf;
}

class WrapNFTInstruction {
    constructor(readonly instruction: number) {}

    static readonly struct = new BeetStruct<WrapNFTInstruction>(
        [["instruction", u8]],
        (args) => new WrapNFTInstruction(args.instruction!),
        "WrapNFTInstruction",
    );
}

export const GetWrapNFTInstruction = async (
    launchData: CollectionData,
    mint_account: MintData,
    user: PublicKey,
    asset_key: PublicKey | null,
    connection: Connection,
): Promise<TransactionInstruction | null> => {
    let wrapped_nft_key: PublicKey;

    if (asset_key === null) {
        const umi = createUmi(connection.rpcEndpoint, "confirmed");

        const collection_umiKey = publicKey(launchData.keys[CollectionKeys.CollectionMint].toString());

        const assets = await getAssetV1GpaBuilder(umi)
            .whereField("key", Key.AssetV1)
            .whereField("updateAuthority", updateAuthority("Collection", [collection_umiKey]))
            .getDeserialized();

        const valid_assets: AssetV1[] = [];
        for (let i = 0; i < assets.length; i++) {
            if (assets[i].owner !== user.toString()) {
                continue;
            }

            valid_assets.push(assets[i]);
        }
        if (valid_assets.length === 0) {
            console.log("no nfts owned by user");
            return null;
        }

        const wrapped_index = Math.floor(Math.random() * valid_assets.length);
        wrapped_nft_key = new PublicKey(valid_assets[wrapped_index].publicKey.toString());
    } else {
        wrapped_nft_key = asset_key;
    }

    const user_data_account = PublicKey.findProgramAddressSync([user.toBytes(), Buffer.from("User")], PROGRAM)[0];

    const program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    const launch_data_account = PublicKey.findProgramAddressSync(
        [Buffer.from(launchData.page_name), Buffer.from("Collection")],
        PROGRAM,
    )[0];

    const token_mint = launchData.keys[CollectionKeys.MintAddress];

    const user_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        user, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    const pda_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        program_sol_account, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    const team_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        launchData.keys[CollectionKeys.TeamWallet], // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    const transfer_hook = getTransferHook(mint_account.mint);

    let transfer_hook_program_account: PublicKey | null = null;
    let transfer_hook_validation_account: PublicKey | null = null;
    const extra_hook_accounts: AccountMeta[] = [];
    if (transfer_hook !== null) {
        transfer_hook_program_account = transfer_hook.programId;
        transfer_hook_validation_account = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), launchData.keys[CollectionKeys.MintAddress].toBuffer()],
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

    const instruction_data = serialiseWrapInstruction();

    const account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: user_data_account, isSigner: false, isWritable: true },

        { pubkey: launch_data_account, isSigner: false, isWritable: true },
        { pubkey: program_sol_account, isSigner: false, isWritable: true },

        { pubkey: token_mint, isSigner: false, isWritable: true },
        { pubkey: user_token_account_key, isSigner: false, isWritable: true },
        { pubkey: pda_token_account_key, isSigner: false, isWritable: true },
        { pubkey: team_token_account_key, isSigner: false, isWritable: true },

        { pubkey: wrapped_nft_key, isSigner: false, isWritable: true },
        { pubkey: launchData.keys[CollectionKeys.CollectionMint], isSigner: false, isWritable: true },
    ];

    account_vector.push({ pubkey: mint_account.token_program, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: SYSTEM_KEY, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: CORE, isSigner: false, isWritable: false });

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
