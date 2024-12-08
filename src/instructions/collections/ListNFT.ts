import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED, CORE } from "../../components/constants";
import { BeetStruct, bignum, u64, u8 } from "@metaplex-foundation/beet";
import { LaunchInstruction } from "../../state/common/enums";
import { CollectionData } from "../../state/collections";
import { uInt32ToLEBytes } from "../../utils";
import { CollectionKeys } from "../../state/collections/enums";

function serialise_list_nft_instruction(price: number): Buffer {
    const data = new ListNFT_Instruction(LaunchInstruction.list_nft, price);

    const [buf] = ListNFT_Instruction.struct.serialize(data);

    return buf;
}

class ListNFT_Instruction {
    constructor(
        readonly instruction: number,
        readonly price: bignum,
    ) {}

    static readonly struct = new BeetStruct<ListNFT_Instruction>(
        [
            ["instruction", u8],
            ["price", u64],
        ],
        (args) => new ListNFT_Instruction(args.instruction!, args.price!),
        "ListNFT_Instruction",
    );
}

export const GetListNFTInstruction = async (launchData: CollectionData, user: PublicKey, asset_key: PublicKey, price: number) : Promise<TransactionInstruction | null> => {
    const program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    const launch_data_account = PublicKey.findProgramAddressSync([Buffer.from(launchData.page_name), Buffer.from("Collection")], PROGRAM)[0];
    const listings_program = new PublicKey("288fPpF7XGk82Wth2XgyoF2A82YKryEyzL58txxt47kd");
    const listings_account = PublicKey.findProgramAddressSync([asset_key.toBytes(), Buffer.from("Listing")], listings_program)[0];
    const listings_summary_account = PublicKey.findProgramAddressSync(
        [launchData.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("Summary")],
        listings_program,
    )[0];

    const instruction_data = serialise_list_nft_instruction(price);

    const account_vector = [
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
