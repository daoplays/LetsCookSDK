import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED, CORE } from "../../components/constants";
import { toast } from "react-toastify";
import { BeetStruct, u32, u8 } from "@metaplex-foundation/beet";
import { LaunchInstruction } from "../../state/common/enums";
import { CollectionData, NewNFTListingData, getCollectionPlugins } from "../../state/collections";
import { uInt32ToLEBytes } from "../../utils";
import { CollectionKeys } from "../../state/collections/enums";

function serialise_buy_nft_instruction(index: number): Buffer {
    const data = new BuyNFT_Instruction(LaunchInstruction.buy_nft, index);

    const [buf] = BuyNFT_Instruction.struct.serialize(data);

    return buf;
}

class BuyNFT_Instruction {
    constructor(
        readonly instruction: number,
        readonly index: number,
    ) {}

    static readonly struct = new BeetStruct<BuyNFT_Instruction>(
        [
            ["instruction", u8],
            ["index", u32],
        ],
        (args) => new BuyNFT_Instruction(args.instruction!, args.index!),
        "BuyNFT_Instruction",
    );
}

export const GetBuyNFTInstruction = async (
    connection: Connection,
    launchData: CollectionData,
    user: PublicKey,
    asset_key: PublicKey,
    index: number,
) : Promise<TransactionInstruction | null> => {
    const program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    const launch_data_account = PublicKey.findProgramAddressSync([Buffer.from(launchData.page_name), Buffer.from("Collection")], PROGRAM)[0];
    const listings_program = new PublicKey("288fPpF7XGk82Wth2XgyoF2A82YKryEyzL58txxt47kd");
    const listings_account = PublicKey.findProgramAddressSync([asset_key.toBytes(), Buffer.from("Listing")], listings_program)[0];
    const listings_summary_account = PublicKey.findProgramAddressSync(
        [launchData.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("Summary")],
        listings_program,
    )[0];

    const listing_data = await connection.getAccountInfo(listings_account);
    let seller;
    if (listing_data) {
        const [listing] = NewNFTListingData.struct.deserialize(listing_data.data);
        seller = listing.seller;
        console.log("Have listing data: ", listing, listing.seller.toString());
    } else {
        const plugins = getCollectionPlugins(launchData);

        if (index == undefined) {
            toast.error("Invalid index", {
                type: "error",
                isLoading: false,
                autoClose: 3000,
            });
            return null;
        }

        if (!plugins.listings[index].asset.equals(asset_key)) {
            toast.error("Asset doesn't match index", {
                type: "error",
                isLoading: false,
                autoClose: 3000,
            });
            return null;
        }
        seller = plugins.listings[index].seller;
    }
    const instruction_data = serialise_buy_nft_instruction(index);

    const account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: launch_data_account, isSigner: false, isWritable: true },
        { pubkey: program_sol_account, isSigner: false, isWritable: true },
        { pubkey: asset_key, isSigner: false, isWritable: true },
        { pubkey: launchData.keys[CollectionKeys.CollectionMint], isSigner: false, isWritable: true },
        { pubkey: seller, isSigner: false, isWritable: true },
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
