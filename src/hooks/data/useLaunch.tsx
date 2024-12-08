import { useEffect, useState, useCallback, useRef } from "react";
import { PROGRAM } from "../../components/constants";
import { Connection, PublicKey } from "@solana/web3.js";
import { MintData } from "../../state/common/types";
import { getMintData } from "../../utils/tokens";
import { LaunchData, LaunchPluginData, getLaunchPlugins } from "../../state/launch";
import { ListingData } from "../../state/listing";

interface useLaunchProps {
    pageName: string | null;
    connection: Connection;
}

const useLaunch = (props: useLaunchProps) => {
    // State to store the token balance and any error messages
    const [launch, setLaunch] = useState<LaunchData | null>(null);
    const [listing, setListing] = useState<ListingData | null>(null);
    const [launchPlugins, setLaunchPlugins] = useState<LaunchPluginData | null>(null);
    const [tokenMint, setTokenMint] = useState<MintData | null>(null);
    const [whitelistMint, setWhitelistMint] = useState<MintData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkInitialLaunch = useRef<boolean>(true);

    // Ref to store the subscription ID, persists across re-renders
    const subscriptionRef = useRef<number | null>(null);

    const connection = props.connection;
    const pageName = props?.pageName || null;

    const getLaunchDataAccount = useCallback(() => {
        if (!pageName) {
            setLaunch(null);
            setError("No page name provided");
            return;
        }
        return PublicKey.findProgramAddressSync([Buffer.from(pageName), Buffer.from("Launchs")], PROGRAM)[0];
    }, [pageName]);

    // Function to fetch the current assignment data
    const fetchInitialLaunchData = useCallback(async () => {
        if (!checkInitialLaunch.current) {
            return;
        }

        let launchAccount = getLaunchDataAccount();

        if (!launchAccount) {
            setError(`Invalid Launch Account for ${pageName} not found`);
            return;
        }
        checkInitialLaunch.current = false;

        let launchData = await connection.getAccountInfo(launchAccount);

        if (launchData === null) {
            setError(`Launch data for ${pageName} not found`);

            return;
        }
        const [launch] = LaunchData.struct.deserialize(launchData.data);

        setLaunch(launch);

        let listingAddress = launch.listing;
        let listingData = await connection.getAccountInfo(listingAddress);

        if (!listingData) {
            setError(`Listing for ${pageName} not found`);
            return;
        }

        let [listing] = ListingData.struct.deserialize(listingData.data);
        setListing(listing);

        let token = await getMintData(connection, listing.mint.toString());

        if (!token) {
            setError(`Mint for ${pageName} not found`);
            return;
        }

        let plugins: LaunchPluginData = getLaunchPlugins(launch);
        //console.log("set plugins", plugins);
        setLaunchPlugins(plugins);
        setTokenMint(token);

        let whitelist = null;
        if (plugins.whitelistKey) {
            whitelist = await getMintData(connection, plugins.whitelistKey.toString());
            setWhitelistMint(whitelist);
        }
    }, [getLaunchDataAccount]);

    // Callback function to handle account changes
    const handleAccountChange = useCallback((accountInfo: any) => {
        let account_data = Buffer.from(accountInfo.data, "base64");

        if (account_data.length === 0) {
            setLaunch(null);
            return;
        }

        const [updated_data] = LaunchData.struct.deserialize(account_data);
        let updated_plugins: LaunchPluginData = getLaunchPlugins(updated_data);

        setLaunch(updated_data);
        setLaunchPlugins(updated_plugins);
    }, []);

    // Effect to set up the subscription and fetch initial data
    useEffect(() => {
        if (!pageName) {
            setLaunch(null);
            setError(null);
            return;
        }

        const launchAccount = getLaunchDataAccount();
        if (!launchAccount) return;

        // Fetch the initial account data
        fetchInitialLaunchData();

        // Only set up a new subscription if one doesn't already exist
        if (subscriptionRef.current === null) {
            subscriptionRef.current = connection.onAccountChange(launchAccount, handleAccountChange);
        }

        // Cleanup function to remove the subscription when the component unmounts
        // or when the dependencies change
        return () => {
            if (subscriptionRef.current !== null) {
                connection.removeAccountChangeListener(subscriptionRef.current);
                subscriptionRef.current = null;
            }
        };
    }, [connection, pageName, fetchInitialLaunchData, getLaunchDataAccount, handleAccountChange]);

    // Return the current token balance and any error message
    return { launch, listing, launchPlugins, tokenMint, whitelistMint, error };
};

export default useLaunch;
