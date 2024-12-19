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
    FixableBeet,
    i64,
    uniformFixedSizeArray,
} from "@metaplex-foundation/beet";
import { publicKey } from "@metaplex-foundation/beet-solana";

type LaunchPluginEnum = {
    Whitelist: { key: PublicKey; amount: bignum; phase_end: bignum };
};
type LaunchPlugin = DataEnumKeyAsKind<LaunchPluginEnum>;

const launchPluginBeet = dataEnum<LaunchPluginEnum>([
    [
        "Whitelist",
        new BeetArgsStruct<LaunchPluginEnum["Whitelist"]>(
            [
                ["key", publicKey],
                ["amount", u64],
                ["phase_end", u64],
            ],
            'LaunchPluginEnum["Whitelist"]',
        ),
    ],
]) as FixableBeet<LaunchPlugin>;

type LaunchMetaEnum = {
    Raffle: Record<never, never>;
    FCFS: Record<never, never>;
    IDO: { fraction_distributed: number[]; tokens_distributed: bignum };
};
type LaunchInfo = DataEnumKeyAsKind<LaunchMetaEnum>;

const launchInfoBeet = dataEnum<LaunchMetaEnum>([
    ["Raffle", new BeetArgsStruct<LaunchMetaEnum["Raffle"]>([], 'LaunchMetaEnum["Raffle"]')],
    ["FCFS", new BeetArgsStruct<LaunchMetaEnum["FCFS"]>([], 'LaunchMetaEnum["FCFS"]')],
    [
        "IDO",
        new BeetArgsStruct<LaunchMetaEnum["IDO"]>(
            [
                ["fraction_distributed", uniformFixedSizeArray(u8, 8)],
                ["tokens_distributed", u64],
            ],
            'LaunchMetaEnum["IDO"]',
        ),
    ],
]) as FixableBeet<LaunchInfo>;

export class LaunchData {
    constructor(
        readonly account_type: number,
        readonly launch_meta: DataEnumKeyAsKind<LaunchMetaEnum>,
        readonly plugins: Array<DataEnumKeyAsKind<LaunchPluginEnum>>,
        readonly last_interaction: bignum,
        readonly num_interactions: number,
        readonly page_name: string,
        readonly listing: PublicKey,

        readonly total_supply: bignum,
        readonly num_mints: number,
        readonly ticket_price: bignum,
        readonly minimum_liquidity: bignum,
        readonly launch_date: bignum,
        readonly end_date: bignum,

        readonly tickets_sold: number,
        readonly tickets_claimed: number,
        readonly mints_won: number,

        readonly total_mm_buy_amount: bignum,
        readonly total_mm_sell_amount: bignum,
        readonly last_mm_reward_date: number,

        readonly distribution: number[],
        readonly flags: number[],
        readonly strings: string[],
        readonly keys: PublicKey[],
    ) {}

    static readonly struct = new FixableBeetStruct<LaunchData>(
        [
            ["account_type", u8],
            ["launch_meta", launchInfoBeet as FixableBeet<DataEnumKeyAsKind<LaunchMetaEnum>>],
            ["plugins", array(launchPluginBeet) as FixableBeet<Array<DataEnumKeyAsKind<LaunchPluginEnum>>>],
            ["last_interaction", i64],
            ["num_interactions", u16],

            ["page_name", utf8String],
            ["listing", publicKey],

            ["total_supply", u64],
            ["num_mints", u32],
            ["ticket_price", u64],
            ["minimum_liquidity", u64],
            ["launch_date", u64],
            ["end_date", u64],

            ["tickets_sold", u32],
            ["tickets_claimed", u32],
            ["mints_won", u32],

            ["total_mm_buy_amount", u64],
            ["total_mm_sell_amount", u64],
            ["last_mm_reward_date", u32],

            ["distribution", array(u8)],
            ["flags", array(u8)],
            ["strings", array(utf8String)],
            ["keys", array(publicKey)],
        ],
        (args) =>
            new LaunchData(
                args.account_type!,
                args.launch_meta!,
                args.plugins!,
                args.last_interaction!,
                args.num_interactions!,

                args.page_name!,
                args.listing!,

                args.total_supply!,
                args.num_mints!,
                args.ticket_price!,
                args.minimum_liquidity!,
                args.launch_date!,
                args.end_date!,

                args.tickets_sold!,
                args.tickets_claimed!,
                args.mints_won!,

                args.total_mm_buy_amount!,
                args.total_mm_sell_amount!,
                args.last_mm_reward_date!,

                args.distribution!,
                args.flags!,
                args.strings!,
                args.keys!,
            ),
        "LaunchData",
    );
}

export class JoinData {
    constructor(
        readonly account_type: number,
        readonly joiner_key: PublicKey,
        readonly page_name: string,
        readonly num_tickets: number,
        readonly num_claimed_tickets: number,
        readonly num_winning_tickets: number,
        readonly ticket_status: number,
        readonly random_address: PublicKey,
        readonly last_slot: bignum,
    ) {}

    static readonly struct = new FixableBeetStruct<JoinData>(
        [
            ["account_type", u8],
            ["joiner_key", publicKey],
            ["page_name", utf8String],
            ["num_tickets", u16],
            ["num_claimed_tickets", u16],
            ["num_winning_tickets", u16],
            ["ticket_status", u8],
            ["random_address", publicKey],
            ["last_slot", u64],
        ],
        (args) =>
            new JoinData(
                args.account_type!,
                args.joiner_key!,
                args.page_name!,
                args.num_tickets!,
                args.num_claimed_tickets!,
                args.num_winning_tickets!,
                args.ticket_status!,
                args.random_address!,
                args.last_slot!,
            ),
        "JoinData",
    );
}
