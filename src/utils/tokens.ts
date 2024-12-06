import {
    Mint,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    getMetadataPointerState,
    getPermanentDelegate,
    getTransferFeeConfig,
    getTransferHook,
    unpackMint,
    getExtensionData,
    ExtensionType,
} from "@solana/spl-token";
import { unpack, TokenMetadata } from "@solana/spl-token-metadata";
import { PublicKey, Connection } from "@solana/web3.js";
import { toast } from "react-toastify";

import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import { METAPLEX_META, WRAPPED_SOL } from "../components/constants";
import { MintData } from "../state/common/types";
import { Extensions } from "../state/common/enums";
import { fetchWithTimeout, getNetworkConfig } from "./common";

export const placeholderIcon = "https://snipboard.io/FdHf7J.jpg";

export async function getMint(connection: Connection, mint_string: string): Promise<[Mint | null, PublicKey | null]> {
    if (mint_string === "" || !mint_string) {
        return [null, null];
    }

    let mint_address: PublicKey;

    try {
        // Attempt to create a PublicKey instance
        mint_address = new PublicKey(mint_string);
        // If no error is thrown, input is a valid public key
    } catch (error) {
        toast.error("Invalid public key", {
            type: "error",
            isLoading: false,
            autoClose: 3000,
        });
        return [null, null];
    }

    let result = await connection.getAccountInfo(mint_address, "confirmed");
    let mint: Mint;
    if (result?.owner.equals(TOKEN_PROGRAM_ID)) {
        try {
            mint = unpackMint(mint_address, result, TOKEN_PROGRAM_ID);
            console.log(mint);
        } catch (error) {
            toast.error("Error loading spl token", {
                type: "error",
                isLoading: false,
                autoClose: 3000,
            });
            return [null, null];
        }
    } else {
        try {
            mint = unpackMint(mint_address, result, TOKEN_2022_PROGRAM_ID);
            console.log(mint);
        } catch (error) {
            toast.error("Error loading token22", {
                type: "error",
                isLoading: false,
                autoClose: 3000,
            });
            return [null, null];
        }
    }

    return [mint, result ? result.owner : null];
}

export async function getMintDataWithMint(connection: Connection, mint: Mint, token_program: PublicKey): Promise<MintData | null> {
    if (mint.address.equals(WRAPPED_SOL)) {
        let config = await getNetworkConfig(connection);
        let mint_data: MintData = {
            mint: mint,
            uri: "",
            name: "Wrapped " + config.token,
            symbol: "W" + config.token,
            icon: config.token_image,
            extensions: 0,
            token_program: token_program,
        };
        return mint_data;
    }
    let uri: string | null = null;
    let metadata_pointer = null;
    let name: string = "";
    let symbol: string = "";
    if (token_program.equals(TOKEN_2022_PROGRAM_ID)) {
        // first look for t22 metadata
        metadata_pointer = getMetadataPointerState(mint);
    }

    //console.log("get mint data", mint.address.toString());
    if (metadata_pointer !== null) {
        //console.log("havemetadata pointer ",mint.address.toString(),  metadata_pointer.metadataAddress.toString());
        const data = getExtensionData(ExtensionType.TokenMetadata, mint.tlvData);
        if (data) {
            let metadata: TokenMetadata = unpack(data);
            //console.log(metadata)
            uri = metadata.uri;
            name = metadata.name;
            symbol = metadata.symbol;
        }
    } else {
        let token_meta_key = PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), METAPLEX_META.toBuffer(), mint.address.toBuffer()],
            METAPLEX_META,
        )[0];
        let raw_meta_data = await connection.getAccountInfo(token_meta_key);

        // if we also dont have metaplex metadata then just return with unknown metadata
        if (raw_meta_data === null) {
            let mint_data: MintData = {
                mint: mint,
                uri: "",
                name: "Unknown",
                symbol: "Unknown",
                icon: placeholderIcon,
                extensions: 0,
                token_program: token_program,
            };
            return mint_data;
        }

        let meta_data = Metadata.deserialize(raw_meta_data.data);
        //console.log(meta_data);
        //console.log(meta_data[0].data.symbol, meta_data[0].data.name);
        uri = meta_data[0].data.uri;
        name = meta_data[0].data.name;
        symbol = meta_data[0].data.symbol;
    }

    // check the extensions we care about
    let transfer_hook = getTransferHook(mint);
    let transfer_fee_config = getTransferFeeConfig(mint);
    let permanent_delegate = getPermanentDelegate(mint);

    let extensions =
        (Extensions.TransferFee * Number(transfer_fee_config !== null)) |
        (Extensions.PermanentDelegate * Number(permanent_delegate !== null)) |
        (Extensions.TransferHook * Number(transfer_hook !== null));

    //console.log(name, uri);
    let icon: string = "";
    if (uri) {
        uri = uri.replace("https://cf-ipfs.com/", "https://gateway.moralisipfs.com/");
        try {
            let uri_json = await fetchWithTimeout(uri, 3000).then((res) => res.json());
            //console.log(uri_json)
            icon = uri_json["image"];
        } catch (error) {
            console.log("error getting uri, using placeholder icon");
            console.log("name", name, uri, mint.address.toString());
            console.log(error);
            icon = placeholderIcon;
        }
    }

    let mint_data: MintData = {
        mint: mint,
        uri: uri ? uri : "",
        name: name,
        symbol: symbol,
        icon: icon,
        extensions: extensions,
        token_program: token_program,
    };

    //console.log("have mint data", mint_data);
    return mint_data;
}

export async function getMintData(connection: Connection, token_mint: string): Promise<MintData | null> {
    let [mint, token_program] = await getMint(connection, token_mint);

    if (!mint || !token_program) {
        return null;
    }

    let mint_data = await getMintDataWithMint(connection, mint, token_program);

    return mint_data;
}
