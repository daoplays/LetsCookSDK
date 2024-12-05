import { bignum } from "@metaplex-foundation/beet";
import BN from "bn.js";

export function bignum_to_num(bn: bignum): number {
    let value = new BN(bn).toNumber();

    return value;
}