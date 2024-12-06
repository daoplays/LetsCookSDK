import { PublicKey } from "@solana/web3.js";
import { Mint } from "@solana/spl-token";

export interface MintData {
    mint: Mint;
    uri: string;
    name: string;
    symbol: string;
    icon: string;
    extensions: number;
    token_program: PublicKey;
}
