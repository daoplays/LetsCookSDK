import { PublicKey } from '@solana/web3.js';
import { NFTListingData } from './marketplace';
import { CollectionData } from './types';
import { bignum_to_num } from '../../utils';
import { bignum } from '@metaplex-foundation/beet';


export interface CollectionPluginData {
    // mint probability
    probability: string;

    //whitelist plugin
    whitelistKey: PublicKey | null;
    whitelistAmount: bignum | null;
    whitelistPhaseEnd: Date | null;

    // mint only plugin
    mintOnly: boolean;

    // listings
    listings: NFTListingData[];
}


export function getCollectionPlugins(collection: CollectionData): CollectionPluginData {
    const initialData: CollectionPluginData = {
        probability: "",
        whitelistKey: null,
        whitelistAmount: null,
        whitelistPhaseEnd: null,
        mintOnly: false,
        listings: [],
    };

    return collection.plugins.reduce((acc, plugin) => {
        switch (plugin["__kind"]) {
            case "MintProbability":
                acc.probability = `${plugin["mint_prob"]}% mint chance`;
                break;
            case "Whitelist":
                acc.whitelistKey = plugin["key"];
                acc.whitelistAmount = plugin["amount"];
                acc.whitelistPhaseEnd = new Date(bignum_to_num(plugin["phase_end"]));
                break;
            case "MintOnly":
                acc.mintOnly = true;
                break;
            case "Marketplace":
                acc.listings = plugin["listings"];
                break;
            default:
                break;
        }
        return acc;
    }, initialData);
}