import { PublicKey } from "@solana/web3.js";
import {
    FixableBeetStruct,
    uniformFixedSizeArray,
    u8,
    u16,
    u32,
    u64,
    bignum,
    array,
    BeetArgsStruct,
    dataEnum,
    DataEnumKeyAsKind,
    FixableBeet,
} from "@metaplex-foundation/beet";
import { publicKey } from "@metaplex-foundation/beet-solana";

type AMMPluginEnum = {
    TradeToEarn: { total_tokens: bignum; first_reward_date: number; last_reward_date: number };
    LiquidityScaling: { scalar: number; threshold: bignum; active: number };
};
type AMMPlugin = DataEnumKeyAsKind<AMMPluginEnum>;

const ammPluginBeet = dataEnum<AMMPluginEnum>([
    [
        "TradeToEarn",
        new BeetArgsStruct<AMMPluginEnum["TradeToEarn"]>(
            [
                ["total_tokens", u64],
                ["first_reward_date", u32],
                ["last_reward_date", u32],
            ],
            'AMMPluginEnum["TradeToEarn"]',
        ),
    ],
    [
        "LiquidityScaling",
        new BeetArgsStruct<AMMPluginEnum["LiquidityScaling"]>(
            [
                ["scalar", u16],
                ["threshold", u64],
                ["active", u8],
            ],
            'AMMPluginEnum["LiquidityScaling"]',
        ),
    ],
]) as FixableBeet<AMMPlugin>;

export class AMMData {
    constructor(
        readonly account_type: number,
        readonly pool: PublicKey,
        readonly provider: number,
        readonly base_mint: PublicKey,
        readonly quote_mint: PublicKey,
        readonly lp_mint: PublicKey,
        readonly base_key: PublicKey,
        readonly quote_key: PublicKey,
        readonly fee: number,
        readonly num_data_accounts: number,
        readonly last_price: number[],
        readonly lp_amount: bignum,
        readonly borrow_cost: number,
        readonly leverage_fraction: number,
        readonly amm_base_amount: bignum,
        readonly amm_quote_amount: bignum,
        readonly short_base_amount: bignum,
        readonly long_quote_amount: bignum,
        readonly start_time: bignum,
        readonly plugins: Array<DataEnumKeyAsKind<AMMPluginEnum>>,
    ) {}

    static readonly struct = new FixableBeetStruct<AMMData>(
        [
            ["account_type", u8],
            ["pool", publicKey],
            ["provider", u8],
            ["base_mint", publicKey],
            ["quote_mint", publicKey],
            ["lp_mint", publicKey],
            ["base_key", publicKey],
            ["quote_key", publicKey],
            ["fee", u16],
            ["num_data_accounts", u32],
            ["last_price", uniformFixedSizeArray(u8, 4)],
            ["lp_amount", u64],
            ["borrow_cost", u16],
            ["leverage_fraction", u16],
            ["amm_base_amount", u64],
            ["amm_quote_amount", u64],
            ["short_base_amount", u64],
            ["long_quote_amount", u64],
            ["start_time", u64],
            ["plugins", array(ammPluginBeet) as FixableBeet<Array<DataEnumKeyAsKind<AMMPluginEnum>>>],
        ],
        (args) =>
            new AMMData(
                args.account_type!,
                args.pool!,
                args.provider!,
                args.base_mint!,
                args.quote_mint!,
                args.lp_mint!,
                args.base_key!,
                args.quote_key!,
                args.fee!,
                args.num_data_accounts!,
                args.last_price!,
                args.lp_amount!,
                args.borrow_cost!,
                args.leverage_fraction!,
                args.amm_base_amount!,
                args.amm_quote_amount!,
                args.short_base_amount!,
                args.long_quote_amount!,
                args.start_time!,
                args.plugins!,
            ),
        "AMMData",
    );
}
