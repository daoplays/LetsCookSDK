# @letscook/sdk

An SDK for interacting with the Let's Cook launchpad on either the Solana or Eclipse blockchain. This SDK provides a collection of hooks for streaming data from Let's Cook accounts, and interacting with the program on chain, making it easier to build decentralized applications.

## Installation

```bash
npm install @letscook/sdk
```

## Core Dependencies

This SDK has the following peer dependencies that you'll need in your project:

```json
{
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0",
    "@solana/web3.js": ">=1.87.0"
}
```

## Available Hooks

### Data Hooks

Data hooks are used for fetching and subscribing to on-chain data.

- [`useGetBalance`](./hooks/data/useGetBalance.mdx) - Subscribe to SOL balance changes for any account

## Usage Examples

Here's a quick example of using the SDK to display an account's balance:

```typescript
import { useGetBalance } from '@letscook/sdk';
import { Connection, PublicKey } from '@solana/web3.js';

function AccountBalance({ address }: { address: string }) {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const publicKey = new PublicKey(address);

  const { balance, error, isLoading } = useGetBalance({
    publicKey,
    connection
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Balance: {balance} SOL</div>;
}
```

## Documentation Structure

The documentation is organized to mirror the SDK's structure:

```
docs/
├── README.md           # This file
└── hooks/
    └── data/
        └── useGetBalance.mdx
```

Each hook has its own detailed documentation file that includes:

- Description
- Parameters
- Return values
- Usage examples
- Notes and caveats
