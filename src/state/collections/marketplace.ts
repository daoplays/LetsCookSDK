import { PublicKey } from '@solana/web3.js';
import { BeetStruct, u32, u64, bignum } from '@metaplex-foundation/beet';
import { publicKey } from '@metaplex-foundation/beet-solana';

export class MarketplaceSummary {
   constructor(readonly num_listings: number) {}

   static readonly struct = new BeetStruct<MarketplaceSummary>(
       [["num_listings", u32]],
       (args) => new MarketplaceSummary(args.num_listings!),
       "MarketplaceSummary"
   );

   static deserialize(buffer: Buffer): MarketplaceSummary {
       return this.struct.deserialize(buffer)[0];
   }
}

export class NewNFTListingData {
   constructor(
       readonly collection: PublicKey,
       readonly asset: PublicKey,
       readonly seller: PublicKey,
       readonly price: bignum
   ) {}

   static readonly struct = new BeetStruct<NewNFTListingData>(
       [
           ["collection", publicKey],
           ["asset", publicKey],
           ["seller", publicKey],
           ["price", u64],
       ],
       (args) => new NewNFTListingData(args.collection!, args.asset!, args.seller!, args.price!),
       "NewNFTListingData"
   );

   static deserialize(buffer: Buffer): NewNFTListingData {
       return this.struct.deserialize(buffer)[0];
   }
}

export class NFTListingData {
   constructor(
       readonly asset: PublicKey,
       readonly seller: PublicKey,
       readonly price: bignum
   ) {}

   static readonly struct = new BeetStruct<NFTListingData>(
       [
           ["asset", publicKey],
           ["seller", publicKey],
           ["price", u64],
       ],
       (args) => new NFTListingData(args.asset!, args.seller!, args.price!),
       "NFTListingData"
   );

   static deserialize(buffer: Buffer): NFTListingData {
       return this.struct.deserialize(buffer)[0];
   }
}