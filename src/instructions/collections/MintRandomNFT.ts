import { PublicKey, TransactionInstruction, Connection, Keypair, AccountMeta } from "@solana/web3.js";
import { getTransferHook, resolveExtraAccountMeta, ExtraAccountMetaAccountDataLayout } from "@solana/spl-token";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED, CORE } from "../../components/constants";
import { toast } from "react-toastify";
import { uInt32ToLEBytes } from "../../utils";
import { AssignmentData, CollectionData } from "../../state/collections";
import { CollectionKeys } from "../../state/collections/enums";
import { getMintData } from "../../utils/tokens";
import { LaunchInstruction } from "../../state/common/enums";
import { BeetStruct, u8 } from "@metaplex-foundation/beet";
import { getAssociatedTokenAddress } from "@solana/spl-token";

function serialiseMintRandomNFTInstruction(): Buffer {
    const data = new MintRandomNFT_Instruction(LaunchInstruction.mint_random);

    const [buf] = MintRandomNFT_Instruction.struct.serialize(data);

    return buf;
}

class MintRandomNFT_Instruction {
    constructor(readonly instruction: number) {}

    static readonly struct = new BeetStruct<MintRandomNFT_Instruction>(
        [["instruction", u8]],
        (args) => new MintRandomNFT_Instruction(args.instruction!),
        "MintRandomNFT_Instruction",
    );
}

export const GetMintRandomInstruction = async (connection: Connection, collection: CollectionData, user: PublicKey) : Promise<TransactionInstruction | null> => {
    if (collection === null) {
        return null;
    }

    let launch_data_account = PublicKey.findProgramAddressSync([Buffer.from(collection.page_name), Buffer.from("Collection")], PROGRAM)[0];

    let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    let token_mint = collection.keys[CollectionKeys.MintAddress];
    let mint_account = await getMintData(connection, collection.keys[CollectionKeys.MintAddress].toString());

    if (!mint_account) {
        toast.error("Unable to retrieve mint data, please try again later", {
            type: "error",
            isLoading: false,
            autoClose: 3000,
        });
        return null;
    }

    let user_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        user, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    let pda_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        program_sol_account, // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    let team_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        collection.keys[CollectionKeys.TeamWallet], // owner
        true, // allow owner off curve
        mint_account.token_program,
    );

    let nft_assignment_account = PublicKey.findProgramAddressSync(
        [user.toBytes(), collection.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
        PROGRAM,
    )[0];

    //console.log("get assignment data");
    let assignment_data = await connection.getAccountInfo(nft_assignment_account);

    if (assignment_data === null) {
        toast.error("Unable to retrieve nft assignment data, please try again later", {
            type: "error",
            isLoading: false,
            autoClose: 3000,
        });
        return null;
    }

    let assignment = AssignmentData.deserialize(assignment_data.data);

    //let user_data_account = PublicKey.findProgramAddressSync([user.toBytes(), Buffer.from("User")], PROGRAM)[0];

    let nft_mint_keypair = new Keypair();
    let nft_mint_account = nft_mint_keypair.publicKey;

    let transfer_hook = getTransferHook(mint_account.mint);

    let transfer_hook_program_account: PublicKey | null = null;
    let transfer_hook_validation_account: PublicKey | null = null;
    let extra_hook_accounts: AccountMeta[] = [];
    if (transfer_hook !== null) {
        transfer_hook_program_account = transfer_hook.programId;
        transfer_hook_validation_account = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), collection.keys[CollectionKeys.MintAddress].toBuffer()],
            transfer_hook_program_account,
        )[0];

        // check if the validation account exists
        let hook_accounts = await connection.getAccountInfo(transfer_hook_validation_account);

        if (hook_accounts) {
            let extra_account_metas = ExtraAccountMetaAccountDataLayout.decode(Uint8Array.from(hook_accounts.data));
            for (let i = 0; i < extra_account_metas.extraAccountsList.count; i++) {
                let extra = extra_account_metas.extraAccountsList.extraAccounts[i];
                let meta = await resolveExtraAccountMeta(
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

    const instruction_data = serialiseMintRandomNFTInstruction();

    var account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: nft_assignment_account, isSigner: false, isWritable: true },

        { pubkey: launch_data_account, isSigner: false, isWritable: true },
        { pubkey: program_sol_account, isSigner: false, isWritable: true },

        { pubkey: nft_mint_account, isSigner: true, isWritable: true },
        { pubkey: collection.keys[CollectionKeys.CollectionMint], isSigner: false, isWritable: true },

        { pubkey: collection.keys[CollectionKeys.TeamWallet], isSigner: false, isWritable: true },
        { pubkey: token_mint, isSigner: false, isWritable: false },
        { pubkey: pda_token_account_key, isSigner: false, isWritable: true },
        { pubkey: user_token_account_key, isSigner: false, isWritable: true },
        { pubkey: team_token_account_key, isSigner: false, isWritable: true },
    ];

    account_vector.push({ pubkey: SYSTEM_KEY, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: CORE, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: assignment.random_address, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: mint_account.token_program, isSigner: false, isWritable: false });

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

    const list_instruction = new TransactionInstruction({
        keys: account_vector,
        programId: PROGRAM,
        data: instruction_data,
    });

    return list_instruction;
};
