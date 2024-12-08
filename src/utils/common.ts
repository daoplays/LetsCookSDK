import { bignum } from "@metaplex-foundation/beet";
import { Connection } from "@solana/web3.js";
import BN from "bn.js";
import { DevNetConfig, ECLIPSE_GENESIS, EclipseMainNetConfig, MainNetConfig, NetworkConfig, SOLANA_DEVNET_GENESIS } from "../components/constants";

export function bignum_to_num(bn: bignum): number {
    const value = new BN(bn).toNumber();

    return value;
}

export function uInt8ToLEBytes(num: number): Buffer {
    const bytes = Buffer.alloc(1);
    bytes.writeUInt8(num);

    return bytes;
}

export function uInt16ToLEBytes(num: number): Buffer {
    const bytes = Buffer.alloc(2);
    bytes.writeUInt16LE(num);

    return bytes;
}

export function uInt32ToLEBytes(num: number): Buffer {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(num);

    return bytes;
}

export async function fetchWithTimeout(resource: string, timeout: number) {
    const options = { timeout: timeout };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
    });
    clearTimeout(id);

    return response;
}

export async function getGenesisHash(connection: Connection): Promise<string> {
    const genesisHash = await connection.getGenesisHash();

    return genesisHash;
}

export async function onEclipse(connection: Connection): Promise<boolean> {
    const genesis = await getGenesisHash(connection);
    if (genesis === ECLIPSE_GENESIS) return true;
    return false;
}

export async function getNetworkConfig(connection: Connection): Promise<NetworkConfig> {
    const hash = await getGenesisHash(connection);
    if (hash === ECLIPSE_GENESIS) return EclipseMainNetConfig;
    if (hash === SOLANA_DEVNET_GENESIS) return DevNetConfig;

    return MainNetConfig;
}
