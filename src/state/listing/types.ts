import { PublicKey } from "@solana/web3.js";
import {
    FixableBeetStruct,
    u8,
    u32,
    u64,
    bignum,
    utf8String,
    array,
} from "@metaplex-foundation/beet";
import { publicKey } from "@metaplex-foundation/beet-solana";



export class ListingData {
    constructor(
        readonly account_type: number,
        readonly id: bignum,
        readonly mint: PublicKey,
        readonly name: string,
        readonly symbol: string,
        readonly decimals: number,
        readonly icon: string,
        readonly meta_url: string,
        readonly banner: string,
        readonly description: string,
        readonly positive_votes: number,
        readonly negative_votes: number,
        readonly socials: string[],
    ) {}

    static readonly struct = new FixableBeetStruct<ListingData>(
        [
            ["account_type", u8],
            ["id", u64],
            ["mint", publicKey],
            ["name", utf8String],
            ["symbol", utf8String],
            ["decimals", u8],
            ["icon", utf8String],
            ["meta_url", utf8String],
            ["banner", utf8String],
            ["description", utf8String],
            ["positive_votes", u32],
            ["negative_votes", u32],
            ["socials", array(utf8String)],
        ],
        (args) =>
            new ListingData(
                args.account_type!,
                args.id!,
                args.mint!,
                args.name!,
                args.symbol!,
                args.decimals!,
                args.icon!,
                args.meta_url!,
                args.banner!,
                args.description!,
                args.positive_votes!,
                args.negative_votes!,
                args.socials!,
            ),
        "ListingData",
    );
}
