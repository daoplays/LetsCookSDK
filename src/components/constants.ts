import { PublicKey } from "@solana/web3.js";

export const firebaseConfig = {
    databaseURL: "https://letscooklistings-default-rtdb.firebaseio.com/",
};

export const METAPLEX_META = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const PROGRAM = new PublicKey("Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU");
export const SYSTEM_KEY = new PublicKey("11111111111111111111111111111111");
export const CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
export const WRAPPED_SOL = new PublicKey("So11111111111111111111111111111111111111112");

// account seeds
export const SOL_ACCOUNT_SEED = 59957379;
export const DATA_ACCOUNT_SEED = 7571427;

// genesis hashes for determining network
export const ECLIPSE_GENESIS = "EAQLJCV2mh23BsK2P9oYpV5CHVLDNHTxYss3URrNmg3s";
export const SOLANA_DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export interface NetworkConfig {
    PROD: boolean;
    NETWORK: string;
    FEES_KEY: PublicKey;
    RAYDIUM_FEES: PublicKey;
    COOK_FEES: PublicKey;
    // its useful to define a few strings and images here given we have eth on eclipse and sol on solana
    token: string;
    token_image: string;
    platform_fee: string;
}

export const EclipseMainNetConfig: NetworkConfig = {
    PROD: true,
    NETWORK: "eclipse",
    FEES_KEY: new PublicKey("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD"),
    RAYDIUM_FEES: new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"),
    COOK_FEES: new PublicKey("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD"),
    token: "ETH",
    token_image: "https://raw.githubusercontent.com/daoplays/LetsCookSDK/main/src/assets/images/eth.png",
    platform_fee: "0.0001",
};

export const DevNetConfig: NetworkConfig = {
    PROD: false,
    NETWORK: "devnet",
    FEES_KEY: new PublicKey("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD"),
    RAYDIUM_FEES: new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"),
    COOK_FEES: new PublicKey("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD"),
    token: "SOL",
    token_image: "https://raw.githubusercontent.com/daoplays/LetsCookSDK/main/src/assets/images/sol.png",
    platform_fee: "0.002",
};

export const MainNetConfig: NetworkConfig = {
    PROD: true,
    NETWORK: "mainnet",
    FEES_KEY: new PublicKey("HtszJ5ntXnwUFc2anMzp5RgaPxtvTFojL2qb5kcFEytA"),
    RAYDIUM_FEES: new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"),
    COOK_FEES: new PublicKey("HtszJ5ntXnwUFc2anMzp5RgaPxtvTFojL2qb5kcFEytA"),
    token: "SOL",
    token_image: "https://raw.githubusercontent.com/daoplays/LetsCookSDK/main/src/assets/images/sol.png",
    platform_fee: "0.002",
};
