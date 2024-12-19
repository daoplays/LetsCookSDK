import { bignum } from "@metaplex-foundation/beet";
import { AMMData } from "./types";

export interface AMMPluginData {
    // trade rewards
    trade_reward_tokens: bignum;
    trade_reward_first_date: number;
    trade_reward_last_date: number;

    //liquidity plugin
    liquidity_scalar: number;
    liquidity_threshold: bignum;
    liquidity_active: number;
}

export function getAMMPlugins(amm: AMMData): AMMPluginData {
    const initialData: AMMPluginData = {
        trade_reward_tokens: 0,
        trade_reward_first_date: 0,
        trade_reward_last_date: 0,
        liquidity_scalar: 0,
        liquidity_threshold: 0,
        liquidity_active: 0,
    };

    return amm.plugins.reduce((acc, plugin) => {
        switch (plugin["__kind"]) {
            case "TradeToEarn":
                acc.trade_reward_tokens = plugin["total_tokens"];
                acc.trade_reward_first_date = plugin["first_reward_date"];
                acc.trade_reward_last_date = plugin["last_reward_date"];
                break;
            case "LiquidityScaling":
                acc.liquidity_scalar = plugin["scalar"];
                acc.liquidity_threshold = plugin["threshold"];
                acc.liquidity_active = plugin["active"];
                break;
            default:
                break;
        }
        return acc;
    }, initialData);
}
