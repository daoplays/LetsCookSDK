import { useEffect, useState, useCallback, useRef } from "react";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import { MarketplaceSummary, NFTListingData, NewNFTListingData } from "../../state/collections";

interface useMarketplaceProps {
    collectionAddress: PublicKey | null;
    connection: Connection;
}

const RATE_LIMIT_INTERVAL = 1000; // 1 second rate limit

// Collections are already streamed via _contexts so we dont need to have a websocket here aswell
const useMarketplace = (props: useMarketplaceProps) => {
    // State to store the token balance and any error messages
    const [error, setError] = useState<string | null>(null);
    const [marketplaceSummary, setMarketplaceSummary] = useState<MarketplaceSummary | null>(null);
    const [listedAssets, setListedAssets] = useState<NFTListingData[]>([]);

    const check_initial_collection = useRef<boolean>(true);

    // Ref to store the subscription ID, persists across re-renders
    const subscriptionRef = useRef<number | null>(null);

    const connection = props?.connection;
    const collectionAddress = props?.collectionAddress || null;

    // Rate limiting refs
    const lastFetchTime = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isExecutingRef = useRef<boolean>(false);

    const getMarketplaceAccount = useCallback(() => {
        if (!collectionAddress) {
            setMarketplaceSummary(null);
            setError("No page name provided");
            return;
        }
        return PublicKey.findProgramAddressSync(
            [collectionAddress.toBytes(), Buffer.from("Summary")],
            new PublicKey("288fPpF7XGk82Wth2XgyoF2A82YKryEyzL58txxt47kd"),
        )[0];
    }, [collectionAddress]);

    // Function to fetch the current nft balance
    const fetchListings = useCallback(async () => {
        console.log("fetching listings for ", collectionAddress?.toString(), timeoutRef.current, isExecutingRef.current);
        if (!collectionAddress) return;

        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTime.current;

        // If a fetch is already scheduled, don't schedule another one
        if (timeoutRef.current) return;

        // If we're currently executing a fetch, don't do anything
        if (isExecutingRef.current) return;

        // If we haven't waited long enough since the last fetch
        if (timeSinceLastFetch < RATE_LIMIT_INTERVAL) {
            console.log("waiting for rate limit", timeSinceLastFetch);
            // Schedule the next fetch
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;
                fetchListings();
            }, RATE_LIMIT_INTERVAL - timeSinceLastFetch);
            return;
        }

        // Mark that we're executing a fetch
        isExecutingRef.current = true;
        console.log("run GPA");
        try {
            const listings = await connection.getProgramAccounts(new PublicKey("288fPpF7XGk82Wth2XgyoF2A82YKryEyzL58txxt47kd"), {
                commitment: "confirmed",
                filters: [
                    {
                        dataSize: 104,
                    },
                    {
                        memcmp: {
                            offset: 0,
                            bytes: collectionAddress.toBase58(),
                        },
                    },
                ],
            });

            const mp_listings = [];
            for (const listing_data of listings) {
                const [listing] = NewNFTListingData.struct.deserialize(listing_data.account.data);
                const old_listing = new NFTListingData(listing.asset, listing.seller, listing.price);
                mp_listings.push(old_listing);
            }
            console.log("have listings", mp_listings);
            setListedAssets(mp_listings);
        } catch (err) {
            setError(err.message);
        } finally {
            // Update the last fetch time and reset executing status
            lastFetchTime.current = Date.now();
            isExecutingRef.current = false;
        }
    }, [connection, collectionAddress]);

    // Function to fetch the current assignment data
    const fetchInitialMarketData = useCallback(async () => {
        if (!check_initial_collection.current) {
            return;
        }

        const summary_account = getMarketplaceAccount();

        if (!summary_account) {
            return;
        }
        check_initial_collection.current = false;

        const marketplace_summary = await connection.getAccountInfo(summary_account);

        if (marketplace_summary === null) {
            return;
        }
        const [summary] = MarketplaceSummary.struct.deserialize(marketplace_summary.data);

        setMarketplaceSummary(summary);

        fetchListings();
    }, [connection, getMarketplaceAccount, fetchListings]);

    // Callback function to handle account changes
    const handleAccountChange = useCallback(
        (accountInfo: AccountInfo<Buffer>) => {
            const account_data = accountInfo.data;

            if (account_data.length === 0) {
                setMarketplaceSummary(null);
                return;
            }

            const [updated_data] = MarketplaceSummary.struct.deserialize(account_data);
            console.log("Have marketplace update");
            setMarketplaceSummary(updated_data);
            fetchListings();
        },
        [fetchListings],
    );

    // Effect to set up the subscription and fetch initial data
    useEffect(() => {
        if (!collectionAddress) {
            setMarketplaceSummary(null);
            setError(null);
            return;
        }

        const summaryAccount = getMarketplaceAccount();
        if (!summaryAccount) return;

        // Fetch the initial account data
        fetchInitialMarketData();

        // Only set up a new subscription if one doesn't already exist
        if (subscriptionRef.current === null) {
            subscriptionRef.current = connection.onAccountChange(summaryAccount, handleAccountChange);
        }

        // Cleanup function to remove the subscription when the component unmounts
        // or when the dependencies change
        return () => {
            if (subscriptionRef.current !== null) {
                connection.removeAccountChangeListener(subscriptionRef.current);
                subscriptionRef.current = null;
            }

            // Clean up any pending timeouts
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [connection, collectionAddress, fetchInitialMarketData, getMarketplaceAccount, handleAccountChange]);

    // Return the current token balance and any error message
    return { marketplaceSummary, listedAssets, error };
};

export default useMarketplace;
