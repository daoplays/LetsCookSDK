import { PublicKey } from "@solana/web3.js";
import { bignum_to_num } from "../../utils";
import { bignum } from "@metaplex-foundation/beet";
import { LaunchData } from "./types";

export interface LaunchPluginData {
    whitelistKey: PublicKey | null;
    whitelistAmount: bignum | null;
    whitelistPhaseEnd: Date | null;
}

export function getLaunchPlugins(launch: LaunchData): LaunchPluginData {
    const initialData: LaunchPluginData = {
        whitelistKey: null,
        whitelistAmount: null,
        whitelistPhaseEnd: null,
    };

    return launch.plugins.reduce((acc, plugin) => {
        switch (plugin["__kind"]) {
            case "Whitelist":
                acc.whitelistKey = plugin["key"];
                acc.whitelistAmount = plugin["amount"];
                acc.whitelistPhaseEnd = new Date(bignum_to_num(plugin["phase_end"]));
                break;
            default:
                break;
        }
        return acc;
    }, initialData);
}
