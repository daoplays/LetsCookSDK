import { PublicKey, TransactionInstruction, Keypair, AccountMeta, Connection } from "@solana/web3.js";
import { getTransferHook, resolveExtraAccountMeta, ExtraAccountMetaAccountDataLayout } from "@solana/spl-token";
import { PROGRAM, SYSTEM_KEY, SOL_ACCOUNT_SEED } from "../../components/constants";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { BeetStruct, FixableBeetStruct, array, u8, uniformFixedSizeArray } from "@metaplex-foundation/beet";
import { publicKey } from "@metaplex-foundation/beet-solana";
import { LaunchInstruction } from "../../state/common/enums";
import { CollectionData, getCollectionPlugins } from "../../state/collections";
import { CollectionKeys } from "../../state/collections/enums";
import { toast } from "react-toastify";
import { getNetworkConfig, uInt32ToLEBytes } from "../../utils";
import { getMintData } from "../../utils/tokens";

class OraoRandomnessResponse {
    constructor(
        readonly pubkey: PublicKey,
        readonly randomness: number[],
    ) {}

    static readonly struct = new FixableBeetStruct<OraoRandomnessResponse>(
        [
            ["pubkey", publicKey],
            ["randomness", uniformFixedSizeArray(u8, 64)],
        ],
        (args) => new OraoRandomnessResponse(args.pubkey!, args.randomness!),
        "OraoRandomnessResponse",
    );
}

export class OraoRandomness {
    constructor(
        readonly seed: number[],
        readonly randomness: number[],
        readonly responses: OraoRandomnessResponse[],
    ) {}

    static readonly struct = new FixableBeetStruct<OraoRandomness>(
        [
            ["seed", uniformFixedSizeArray(u8, 32)],
            ["randomness", uniformFixedSizeArray(u8, 64)],
            ["responses", array(OraoRandomnessResponse.struct)],
        ],
        (args) => new OraoRandomness(args.seed!, args.randomness!, args.responses!),
        "OraoRandomness",
    );
}

function serialise_claim_nft_instruction(seed: number[]): Buffer {
    const data = new ClaimNFT_Instruction(LaunchInstruction.claim_nft, seed);

    const [buf] = ClaimNFT_Instruction.struct.serialize(data);

    return buf;
}

class ClaimNFT_Instruction {
    constructor(
        readonly instruction: number,
        readonly seed: number[],
    ) {}

    static readonly struct = new BeetStruct<ClaimNFT_Instruction>(
        [
            ["instruction", u8],
            ["seed", uniformFixedSizeArray(u8, 32)],
        ],
        (args) => new ClaimNFT_Instruction(args.instruction!, args.seed!),
        "ClaimNFT_Instruction",
    );
}

export const GetClaimNFTInstruction = async (connection: Connection, collectionData: CollectionData, user: PublicKey) : Promise<TransactionInstruction | null> => {
    const nft_assignment_account = PublicKey.findProgramAddressSync(
        [user.toBytes(), collectionData.keys[CollectionKeys.CollectionMint].toBytes(), Buffer.from("assignment")],
        PROGRAM,
    )[0];

    if (collectionData.num_available === 0) {
        toast.error("No NFTs available");
        return null;
    }

    if (user.toString() == collectionData.keys[CollectionKeys.Seller].toString()) {
        alert("Launch creator cannot buy NFTs");
        return null;
    }

    if (collectionData === null) {
        return null;
    }

    const launch_data_account = PublicKey.findProgramAddressSync(
        [Buffer.from(collectionData.page_name), Buffer.from("Collection")],
        PROGRAM,
    )[0];

    const program_sol_account = PublicKey.findProgramAddressSync([uInt32ToLEBytes(SOL_ACCOUNT_SEED)], PROGRAM)[0];

    const token_mint = collectionData.keys[CollectionKeys.MintAddress];
    const mint_info = await getMintData(connection, collectionData.keys[CollectionKeys.MintAddress].toString());

    if (!mint_info) {
        toast.error("Mint not found");
        return null;
    }

    const mint_account = mint_info.mint;

    const user_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        user, // owner
        true, // allow owner off curve
        mint_info.token_program,
    );

    const pda_token_account_key = await getAssociatedTokenAddress(
        token_mint, // mint
        program_sol_account, // owner
        true, // allow owner off curve
        mint_info.token_program,
    );

    const token_destination_account = pda_token_account_key;

    const user_data_account = PublicKey.findProgramAddressSync([user.toBytes(), Buffer.from("User")], PROGRAM)[0];

    const transfer_hook = getTransferHook(mint_account);

    let transfer_hook_program_account: PublicKey | null = null;
    let transfer_hook_validation_account: PublicKey | null = null;
    const extra_hook_accounts: AccountMeta[] = [];
    if (transfer_hook !== null) {
        transfer_hook_program_account = transfer_hook.programId;
        transfer_hook_validation_account = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), collectionData.keys[CollectionKeys.MintAddress].toBuffer()],
            transfer_hook_program_account,
        )[0];

        // check if the validation account exists
        const hook_accounts = await connection.getAccountInfo(transfer_hook_validation_account);

        if (hook_accounts) {
            const extra_account_metas = ExtraAccountMetaAccountDataLayout.decode(Uint8Array.from(hook_accounts.data));
            for (let i = 0; i < extra_account_metas.extraAccountsList.count; i++) {
                const extra = extra_account_metas.extraAccountsList.extraAccounts[i];
                const meta = await resolveExtraAccountMeta(
                    connection,
                    extra,
                    extra_hook_accounts,
                    Buffer.from([]),
                    transfer_hook_program_account,
                );
                extra_hook_accounts.push(meta);
            }
        }
    }

    let orao_program = PROGRAM;
    const randomKey = new Keypair();
    const key_bytes = randomKey.publicKey.toBytes();

    const config = await getNetworkConfig(connection);

    if (config.NETWORK !== "eclipse") {
        orao_program = new PublicKey("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");
    }

    const orao_network = PublicKey.findProgramAddressSync([Buffer.from("orao-vrf-network-configuration")], orao_program)[0];

    const orao_random = PublicKey.findProgramAddressSync([Buffer.from("orao-vrf-randomness-request"), key_bytes], orao_program)[0];

    let orao_treasury: PublicKey = SYSTEM_KEY;
    if (config.NETWORK !== "eclipse") {
        const orao_network_data = await connection.getAccountInfo(orao_network);
        if (orao_network_data) {
            orao_treasury = new PublicKey(orao_network_data.data.slice(8, 40));
        }
    }

    // check if we have the whitelist plugin
    const whitelist_mint = PROGRAM;
    let whitelist_account = PROGRAM;
    let whitelist_token_program = PROGRAM;

    const collectionPlugins = getCollectionPlugins(collectionData);

    if (collectionPlugins.whitelistKey) {
        const whitelist = await getMintData(connection, whitelist_mint.toString());
        if (!whitelist) {
            toast.error("Whitelist mint not found");
            return null;
        }
        whitelist_account = await getAssociatedTokenAddress(
            whitelist_mint, // mint
            user, // owner
            true, // allow owner off curve
            whitelist.token_program,
        );

        whitelist_token_program = whitelist.token_program;
    }

    const instruction_data = serialise_claim_nft_instruction(Array.from(key_bytes));

    const account_vector = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: user_data_account, isSigner: false, isWritable: true },

        { pubkey: nft_assignment_account, isSigner: false, isWritable: true },
        { pubkey: launch_data_account, isSigner: false, isWritable: true },

        { pubkey: program_sol_account, isSigner: false, isWritable: true },

        { pubkey: token_mint, isSigner: false, isWritable: false },
        { pubkey: user_token_account_key, isSigner: false, isWritable: true },
        { pubkey: token_destination_account, isSigner: false, isWritable: true },

        { pubkey: collectionData.keys[CollectionKeys.CollectionMint], isSigner: false, isWritable: true },
        { pubkey: config.COOK_FEES, isSigner: false, isWritable: true },
        { pubkey: collectionData.keys[CollectionKeys.TeamWallet], isSigner: false, isWritable: true },

        { pubkey: SYSTEM_KEY, isSigner: false, isWritable: false },
        { pubkey: mint_info.token_program, isSigner: false, isWritable: false },

        { pubkey: orao_random, isSigner: false, isWritable: true },
        { pubkey: orao_treasury, isSigner: false, isWritable: true },
        { pubkey: orao_network, isSigner: false, isWritable: true },
        { pubkey: orao_program, isSigner: false, isWritable: false },

        { pubkey: whitelist_mint, isSigner: false, isWritable: true },
        { pubkey: whitelist_account, isSigner: false, isWritable: true },
        { pubkey: whitelist_token_program, isSigner: false, isWritable: false },
    ];

    if (transfer_hook_program_account && transfer_hook_validation_account) {
        account_vector.push({ pubkey: transfer_hook_program_account, isSigner: false, isWritable: true });
        account_vector.push({ pubkey: transfer_hook_validation_account, isSigner: false, isWritable: true });

        for (let i = 0; i < extra_hook_accounts.length; i++) {
            account_vector.push({
                pubkey: extra_hook_accounts[i].pubkey,
                isSigner: extra_hook_accounts[i].isSigner,
                isWritable: extra_hook_accounts[i].isWritable,
            });
        }
    }

    const list_instruction = new TransactionInstruction({
        keys: account_vector,
        programId: PROGRAM,
        data: instruction_data,
    });

    return list_instruction;
};
