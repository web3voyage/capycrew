# CapyCrew Genesis NFT contract

Testnet ERC-721A contract for the fixed 10,000-token CapyCrew Genesis collection on Robinhood Chain Testnet.

## Contract behavior

- Public minting is one payable transaction: `mint(quantity)`.
- Public wallets may mint at most 5 tokens. Owner allocations remain outside that wallet allowance.
- Token IDs are minted sequentially.
- Artwork metadata is shuffled off-chain before upload. The shuffle script writes the final numbered sequence that is uploaded to IPFS.
- Before the collection is closed, every token returns the hidden metadata URI.
- Minting closes automatically at sellout or when the owner calls `closeMinting()`.
- After minting closes, anyone may call `revealMetadata()`. This only switches token URIs to the pre-shuffled IPFS sequence.
- The base and hidden URIs are constructor values and cannot be changed after deployment.

The pre-shuffle is deterministic and reproducible from the published seed commitment and later seed reveal. It prevents the operator from changing the order after minting, but it is not a source of on-chain randomness and the initial seed must be committed before minting.

## Pre-shuffle workflow

1. Prepare numbered source metadata files such as `1.json`, `2.json`, and so on.
2. Generate a random 32-byte seed and publish its SHA-256 commitment before minting.
3. Run:

   `npm.cmd run shuffle:metadata -- --input metadata/source --output metadata/shuffled --seed <64-hex-seed>`

4. Upload the contents of `metadata/shuffled` to IPFS. Use that directory CID as `BASE_TOKEN_URI`.
5. Keep the seed private until minting closes, then publish it so users can reproduce the manifest order.
6. Deploy the contract with `UNREVEALED_TOKEN_URI` pointing to `hidden.json`.
7. Enable public minting with `setPublicMintEnabled(true)`.
8. After sellout or the sale deadline, call `closeMinting()` if it did not close automatically.
9. Anyone calls `revealMetadata()`.

Never commit private keys, seed phrases, or the shuffle seed before the reveal.

## Local setup

1. Copy `.env.example` to `.env` and add a testnet-only deployer key.
2. Run `npm.cmd install`.
3. Run `npm.cmd test`.
4. Deploy with `npm.cmd run deploy:testnet`.

Robinhood Chain Testnet:

- Chain ID: 46630
- RPC: https://rpc.testnet.chain.robinhood.com
- Explorer: https://explorer.testnet.chain.robinhood.com

The deployment script writes `deployment/robinhoodTestnet.json`. Copy its address into `web3voyage/.env` as `MINT_CONTRACT_ADDRESS`.

## Full local browser test

Run `npm.cmd run node:local` in one terminal, then `npm.cmd run deploy:local` in another. The local deployment enables public minting and writes `deployment/localhost.json` for the web app test configuration.

