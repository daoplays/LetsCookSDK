// src/hooks/data/useGetBalance.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

export interface BalanceResult {
  balance: number;
  error: string | null;
  isLoading: boolean;
}

export interface UseGetBalanceProps {
  publicKey: PublicKey | null;
  connection: Connection;
}

/**
 * Hook to get and subscribe to a Solana account's SOL balance
 * @param {UseGetBalanceProps} props - PublicKey and Connection to monitor
 * @returns {BalanceResult} Object containing balance, error state, and loading state
 */
export const useGetBalance = ({ 
  publicKey, 
  connection 
}: UseGetBalanceProps): BalanceResult => {
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const subscriptionRef = useRef<number | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / 1e9);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection]);

  const handleAccountChange = useCallback((updatedAccount: { lamports: number }) => {
    try {
      const newBalance = updatedAccount.lamports / 1e9;
      setBalance(newBalance);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update balance');
    }
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setBalance(0);
      setError(null);
      setIsLoading(false);
      return;
    }

    fetchBalance();

    if (subscriptionRef.current === null) {
      subscriptionRef.current = connection.onAccountChange(
        publicKey,
        handleAccountChange
      );
    }

    return () => {
      if (subscriptionRef.current !== null) {
        connection.removeAccountChangeListener(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [connection, publicKey, fetchBalance]);

  return { balance, error, isLoading };
};