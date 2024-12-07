import { PublicKey, TransactionInstruction, Connection, Keypair } from "@solana/web3.js";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED, CORE } from "../../components/constants";
import { toast } from "react-toastify";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { AssignmentData, CollectionData } from "../../state/collections";
import { uInt32ToLEBytes } from "../../utils";
import { CollectionKeys } from "../../state/collections/enums";
import { getMintData } from "../../utils/tokens";
import { BeetStruct, u8 } from "@metaplex-foundation/beet";
import { LaunchInstruction } from "../../state/common/enums";

function serialiseMintInstruction(): Buffer {
    const data = new MintNFTInstruction(LaunchInstruction.mint_nft);

    const [buf] = MintNFTInstruction.struct.serialize(data);

    return buf;
}

class MintNFTInstruction {
    constructor(readonly instruction: number) {}

    static readonly struct = new BeetStruct<MintNFTInstruction>(
        [["instruction", u8]],
        (args) => new MintNFTInstruction(args.instruction!),
        "MintNFTInstruction",
    );
}

export const GetMintRandomInstruction = async (connection: Connection, collectionData: CollectionData, user: PublicKey) : Promise<TransactionInstruction | null> => {
    if (collectionData === null) {
        //console.log("launch is null");
        return null;
    }

    let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    let nft_assignment_account = PublicKey.findProgramAddressSync(
        [user.toBytes(), collectionData.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
        PROGRAM,
    )[0];

    //console.log("get assignment data");
    let assignment_data = await connection.getAccountInfo(nft_assignment_account);

    if (assignment_data === null) {
        toast.error("Assignment account not found");
        return null;
    }

    let assignment = AssignmentData.deserialize(assignment_data.data);

    let asset_keypair = new Keypair();

    let launch_data_account = PublicKey.findProgramAddressSync(
        [Buffer.from(collectionData.page_name), Buffer.from("Collection")],
        PROGRAM,
    )[0];

    let token_mint = collectionData.keys[CollectionKeys.MintAddress];
    let mint_info = await getMintData(connection, collectionData.keys[CollectionKeys.MintAddress].toString());

    if (!mint_info) {
        toast.error("Mint not found");
        return null;
    }

    let user_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        user, // owner
        true, // allow owner off curve
        mint_info.token_program,
    );

    let pda_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        program_sol_account, // owner
        true, // allow owner off curve
        mint_info.token_program,
    );

    let team_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        collectionData.keys[CollectionKeys.TeamWallet], // owner
        true, // allow owner off curve
        mint_info.token_program,
    );

    const instruction_data = serialiseMintInstruction();

    var account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: nft_assignment_account, isSigner: false, isWritable: true },

        { pubkey: launch_data_account, isSigner: false, isWritable: true },
        { pubkey: program_sol_account, isSigner: false, isWritable: true },

        { pubkey: asset_keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: collectionData.keys[CollectionKeys.CollectionMint], isSigner: false, isWritable: true },

        { pubkey: collectionData.keys[CollectionKeys.TeamWallet], isSigner: false, isWritable: true },
        { pubkey: token_mint, isSigner: false, isWritable: false },
        { pubkey: pda_token_account_key, isSigner: false, isWritable: true },
        { pubkey: user_token_account_key, isSigner: false, isWritable: true },
        { pubkey: team_token_account_key, isSigner: false, isWritable: true },
    ];

    account_vector.push({ pubkey: SYSTEM_KEY, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: CORE, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: assignment.random_address, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: mint_info.token_program, isSigner: false, isWritable: false });

    const list_instruction = new TransactionInstruction({
        keys: account_vector,
        programId: PROGRAM,
        data: instruction_data,
    });

    return list_instruction;
};
