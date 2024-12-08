import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED, CORE } from "../../components/constants";
import { BeetStruct, u32, u8 } from "@metaplex-foundation/beet";
import { LaunchInstruction } from "../../state/common/enums";
import { CollectionData } from "../../state/collections";
import { uInt32ToLEBytes } from "../../utils";
import { CollectionKeys } from "../../state/collections/enums";

function serialise_unlist_nft_instruction(index: number): Buffer {
    const data = new UnlistNFT_Instruction(LaunchInstruction.unlist_nft, index);

    const [buf] = UnlistNFT_Instruction.struct.serialize(data);

    return buf;
}

class UnlistNFT_Instruction {
    constructor(
        readonly instruction: number,
        readonly index: number,
    ) {}

    static readonly struct = new BeetStruct<UnlistNFT_Instruction>(
        [
            ["instruction", u8],
            ["index", u32],
        ],
        (args) => new UnlistNFT_Instruction(args.instruction!, args.index!),
        "UnlistNFT_Instruction",
    );
}

export const GetUnlistNFTInstruction = async (launchData: CollectionData, user: PublicKey, asset_key: PublicKey, index: number) : Promise<TransactionInstruction | null> => {
    let program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    let launch_data_account = PublicKey.findProgramAddressSync([Buffer.from(launchData.page_name), Buffer.from("Collection")], PROGRAM)[0];
    let listings_program = new PublicKey("288fPpF7XGk82Wth2XgyoF2A82YKryEyzL58txxt47kd");
    let listings_account = PublicKey.findProgramAddressSync([asset_key.toBytes(), Buffer.from("Listing")], listings_program)[0];
    let listings_summary_account = PublicKey.findProgramAddressSync(
        [launchData.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("Summary")],
        listings_program,
    )[0];

    const instruction_data = serialise_unlist_nft_instruction(index);

    var account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: launch_data_account, isSigner: false, isWritable: true },
        { pubkey: program_sol_account, isSigner: false, isWritable: true },
        { pubkey: asset_key, isSigner: false, isWritable: true },
        { pubkey: launchData.keys[CollectionKeys.CollectionMint], isSigner: false, isWritable: true },
        { pubkey: listings_account, isSigner: false, isWritable: true },
        { pubkey: listings_summary_account, isSigner: false, isWritable: true },
    ];

    account_vector.push({ pubkey: SYSTEM_KEY, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: CORE, isSigner: false, isWritable: false });
    account_vector.push({ pubkey: listings_program, isSigner: false, isWritable: false });

    const list_instruction = new TransactionInstruction({
        keys: account_vector,
        programId: PROGRAM,
        data: instruction_data,
    });

    return list_instruction;
};
