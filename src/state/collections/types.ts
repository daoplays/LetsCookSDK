import { PublicKey } from "@solana/web3.js";
import {
    FixableBeetStruct,
    u8,
    u16,
    u32,
    u64,
    bignum,
    utf8String,
    array,
    DataEnumKeyAsKind,
    dataEnum,
    BeetArgsStruct,
    FixableBeetArgsStruct,
    FixableBeet,
} from "@metaplex-foundation/beet";
import { publicKey } from "@metaplex-foundation/beet-solana";
import { NFTListingData } from "./marketplace";

type CollectionPluginEnum = {
    AsymmetricSwapPrice: {
        return_swap_price: bignum;
    };
    MintProbability: { mint_prob: number };
    Whitelist: { key: PublicKey; amount: bignum; phase_end: bignum };
    MintOnly: never;
    Marketplace: { listings: NFTListingData[] };
};
type CollectionPlugin = DataEnumKeyAsKind<CollectionPluginEnum>;

const collectionPluginBeet = dataEnum<CollectionPluginEnum>([
    [
        "AsymmetricSwapPrice",
        new FixableBeetArgsStruct<CollectionPluginEnum["AsymmetricSwapPrice"]>(
            [["return_swap_price", u64]],
            'CollectionPluginEnum["AsymmetricSwapPrice"]',
        ),
    ],

    [
        "MintProbability",
        new BeetArgsStruct<CollectionPluginEnum["MintProbability"]>([["mint_prob", u16]], 'CollectionPluginEnum["MintProbability"]'),
    ],
    [
        "Whitelist",
        new BeetArgsStruct<CollectionPluginEnum["Whitelist"]>(
            [
                ["key", publicKey],
                ["amount", u64],
                ["phase_end", u64],
            ],
            'CollectionPluginEnum["Whitelist"]',
        ),
    ],
    ["MintOnly", new BeetArgsStruct<CollectionPluginEnum["MintOnly"]>([], 'CollectionPluginEnum["MintOnly"]')],
    [
        "Marketplace",
        new FixableBeetArgsStruct<CollectionPluginEnum["Marketplace"]>(
            [["listings", array(NFTListingData.struct)]],
            'CollectionPluginEnum["Marketplace"]',
        ),
    ],
]) as FixableBeet<CollectionPlugin>;

type CollectionMetaEnum = {
    RandomFixedSupply: {
        availability: number[];
    };
    RandomUnlimited: Record<string, never>;
};
type CollectionInfo = DataEnumKeyAsKind<CollectionMetaEnum>;

const collectionInfoBeet = dataEnum<CollectionMetaEnum>([
    [
        "RandomFixedSupply",
        new FixableBeetArgsStruct<CollectionMetaEnum["RandomFixedSupply"]>(
            [["availability", array(u8)]],
            'CollectionMetaEnum["RandomFixedSupply"]',
        ),
    ],
    ["RandomUnlimited", new BeetArgsStruct([], 'CollectionMetaEnum["RandomUnlimited"]')],
]) as FixableBeet<CollectionInfo>;

export class CollectionData {
    constructor(
        readonly account_type: number,
        readonly launch_id: bignum,
        readonly collection_meta: DataEnumKeyAsKind<CollectionMetaEnum>,
        readonly plugins: Array<DataEnumKeyAsKind<CollectionPluginEnum>>,
        readonly collection_name: string,
        readonly collection_symbol: string,
        readonly collection_icon_url: string,
        readonly collection_meta_url: string,

        readonly token_name: string,
        readonly token_symbol: string,
        readonly token_icon_url: string,
        readonly token_decimals: number,
        readonly token_extensions: number,

        readonly nft_icon_url: string,
        readonly nft_meta_url: string,
        readonly nft_name: string,
        readonly nft_type: string,

        readonly banner: string,
        readonly page_name: string,
        readonly description: string,

        readonly total_supply: number,
        readonly num_available: number,
        readonly swap_price: bignum,
        readonly swap_fee: number,

        readonly positive_votes: number,
        readonly negative_votes: number,

        readonly total_mm_buy_amount: bignum,
        readonly total_mm_sell_amount: bignum,
        readonly last_mm_reward_date: number,

        readonly socials: string[],
        readonly flags: number[],
        readonly strings: string[],
        readonly keys: PublicKey[],
    ) {}

    static readonly struct = new FixableBeetStruct<CollectionData>(
        [
            ["account_type", u8],
            ["launch_id", u64],

            ["collection_meta", collectionInfoBeet as FixableBeet<DataEnumKeyAsKind<CollectionMetaEnum>>],
            ["plugins", array(collectionPluginBeet) as FixableBeet<Array<DataEnumKeyAsKind<CollectionPluginEnum>>>],
            ["collection_name", utf8String],
            ["collection_symbol", utf8String],
            ["collection_icon_url", utf8String],
            ["collection_meta_url", utf8String],

            ["token_name", utf8String],
            ["token_symbol", utf8String],
            ["token_icon_url", utf8String],
            ["token_decimals", u8],
            ["token_extensions", u8],

            ["nft_icon_url", utf8String],
            ["nft_meta_url", utf8String],
            ["nft_name", utf8String],
            ["nft_type", utf8String],

            ["banner", utf8String],
            ["page_name", utf8String],
            ["description", utf8String],

            ["total_supply", u32],
            ["num_available", u32],
            ["swap_price", u64],
            ["swap_fee", u16],

            ["positive_votes", u32],
            ["negative_votes", u32],

            ["total_mm_buy_amount", u64],
            ["total_mm_sell_amount", u64],
            ["last_mm_reward_date", u32],

            ["socials", array(utf8String)],
            ["flags", array(u8)],
            ["strings", array(utf8String)],
            ["keys", array(publicKey)],
        ],
        (args) =>
            new CollectionData(
                args.account_type!,
                args.launch_id!,
                args.collection_meta!,
                args.plugins!,
                args.collection_name!,
                args.collection_symbol!,
                args.collection_icon_url!,
                args.collection_meta_url!,

                args.token_name!,
                args.token_symbol!,
                args.token_icon_url!,
                args.token_decimals!,
                args.token_extensions!,

                args.nft_icon_url!,
                args.nft_meta_url!,
                args.nft_name!,
                args.nft_type!,

                args.banner!,
                args.page_name!,
                args.description!,

                args.total_supply!,
                args.num_available!,
                args.swap_price!,
                args.swap_fee!,

                args.positive_votes!,
                args.negative_votes!,

                args.total_mm_buy_amount!,
                args.total_mm_sell_amount!,
                args.last_mm_reward_date!,

                args.socials!,
                args.flags!,
                args.strings!,
                args.keys!,
            ),
        "CollectionData",
    );

    static deserialize(buffer: Buffer): CollectionData {
        return this.struct.deserialize(buffer)[0];
    }
}
