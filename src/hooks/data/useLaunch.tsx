import { useEffect, useState, useCallback, useRef } from "react";
import { PROGRAM } from "../../components/constants";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import { MintData } from "../../state/common/types";
import { getMintData } from "../../utils/tokens";
import { JoinData, LaunchData, LaunchPluginData, getLaunchPlugins } from "../../state/launch";
import { ListingData } from "../../state/listing";

interface useLaunchProps {
    pageName: string | null;
    connection: Connection;
    user: PublicKey | null;
}

const useLaunch = (props: useLaunchProps) => {
    // State to store the token balance and any error messages
    const [launch, setLaunch] = useState<LaunchData | null>(null);
    const [listing, setListing] = useState<ListingData | null>(null);
    const [joinData, setJoinData] = useState<JoinData | null>(null);

    const [launchPlugins, setLaunchPlugins] = useState<LaunchPluginData | null>(null);
    const [tokenMint, setTokenMint] = useState<MintData | null>(null);
    const [whitelistMint, setWhitelistMint] = useState<MintData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkInitialLaunch = useRef<boolean>(true);

    // Ref to store the subscription ID, persists across re-renders
    const launchSubscriptionRef = useRef<number | null>(null);
    const joinSubscriptionRef = useRef<number | null>(null);

    const connection = props.connection;
    const pageName = props?.pageName || null;
    const user = props?.user || null;

    const getLaunchDataAccount = useCallback(() => {
        if (!pageName) {
            setLaunch(null);
            setError("No page name provided");
            return;
        }
        return PublicKey.findProgramAddressSync([Buffer.from(pageName), Buffer.from("Launchs")], PROGRAM)[0];
    }, [pageName]);

    const getJoinDataAccont = useCallback(() => {
        if (!user || !pageName) {
            setJoinData(null);
            return;
        }

        return PublicKey.findProgramAddressSync(
                [user.toBytes(), Buffer.from(pageName), Buffer.from("Joiner")],
                PROGRAM,
            )[0];
    }, [pageName, user]);

    const fetchInitiaJoinData = useCallback(async () => {
       
        const joinAccount = getJoinDataAccont();

        if (joinAccount) {
            const joinData = await connection.getAccountInfo(joinAccount);

            if (joinData) {
                const [join] = JoinData.struct.deserialize(joinData.data);
                setJoinData(join);
            }   
        }        
    }, [getJoinDataAccont, connection]);

    // Function to fetch the current assignment data
    const fetchInitialLaunchData = useCallback(async () => {
        if (!checkInitialLaunch.current) {
            return;
        }

        const launchAccount = getLaunchDataAccount();

        if (!launchAccount) {
            setError(`Invalid Launch Account for ${pageName} not found`);
            return;
        }
        checkInitialLaunch.current = false;

        const launchData = await connection.getAccountInfo(launchAccount);

        if (launchData === null) {
            setError(`Launch data for ${pageName} not found`);

            return;
        }
        const [launch] = LaunchData.struct.deserialize(launchData.data);

        setLaunch(launch);

        const listingAddress = launch.listing;
        const listingData = await connection.getAccountInfo(listingAddress);

        if (!listingData) {
            setError(`Listing for ${pageName} not found`);
            return;
        }

        const [listing] = ListingData.struct.deserialize(listingData.data);
        setListing(listing);

        await fetchInitiaJoinData();

        const token = await getMintData(connection, listing.mint.toString());

        if (!token) {
            setError(`Mint for ${pageName} not found`);
            return;
        }

        const plugins: LaunchPluginData = getLaunchPlugins(launch);
        //console.log("set plugins", plugins);
        setLaunchPlugins(plugins);
        setTokenMint(token);

        let whitelist = null;
        if (plugins.whitelistKey) {
            whitelist = await getMintData(connection, plugins.whitelistKey.toString());
            setWhitelistMint(whitelist);
        }
    }, [connection, pageName, getLaunchDataAccount, fetchInitiaJoinData]);



    // Callback function to handle account changes
    const handleAccountChange = useCallback((accountInfo: AccountInfo<Buffer>) => {
        const account_data = accountInfo.data;

        if (account_data.length === 0) {
            setLaunch(null);
            return;
        }

        const [updated_data] = LaunchData.struct.deserialize(account_data);
        const updated_plugins: LaunchPluginData = getLaunchPlugins(updated_data);

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
        if (launchSubscriptionRef.current === null) {
            launchSubscriptionRef.current = connection.onAccountChange(launchAccount, handleAccountChange);
        }

        const joinAccount = getJoinDataAccont();
        if (joinAccount && joinSubscriptionRef.current === null) {
            fetchInitiaJoinData();
            joinSubscriptionRef.current = connection.onAccountChange(joinAccount, handleAccountChange);
        }

        // Cleanup function to remove the subscription when the component unmounts
        // or when the dependencies change
        return () => {
            if (launchSubscriptionRef.current !== null) {
                connection.removeAccountChangeListener(launchSubscriptionRef.current);
                launchSubscriptionRef.current = null;
            }
            if (joinSubscriptionRef.current !== null) {
                connection.removeAccountChangeListener(joinSubscriptionRef.current);
                joinSubscriptionRef.current = null;
            }
        };
    }, [connection, pageName, user, fetchInitialLaunchData, getLaunchDataAccount, getJoinDataAccont, fetchInitiaJoinData, handleAccountChange]);

    // Return the current token balance and any error message
    return { launch, listing, joinData, launchPlugins, tokenMint, whitelistMint, error };
};

export default useLaunch;
