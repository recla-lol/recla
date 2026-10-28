# Recla

Recla shows what a wallet can really claim on Robinhood Chain. People are told they are "eligible" for things all the time, and the real claims — creator fees, token locks past their unlock time, Merkle distributions, vesting releases, refunds a protocol built in — sit in different contracts with different read paths. Recla asks each supported contract directly, shows its answer next to the contract and the view it called, and dry-runs the claim from your own address before your wallet signs anything.

Every Claim Has a Source. Claim discovery and eligibility intelligence for Web3.

## Read this before anything else

This repository is the working code behind https://recla.lol.

- **What runs today.** Claim check for the Pons creator fee escrow (ETH and pair tokens) and HoodLock token locks; a Merkle eligibility checker for any distributor with the user's own proof file (leaf and root computed in the browser); a vesting tracker for vesting wallets that expose `owner()` and `releasable()`; a refund explorer for contracts that state a refund through a view; a claim simulator (`eth_call` from the claimer's address; the wallet is offered only known claim calls — claim, claimToken, withdraw, release, claimRefund, the Merkle claim — on a built-in or registered source, while approvals, transfers, permits, batch calls and unknown calls are never offered for signing, and calldata arriving in a link is shown decoded with a warning); claim history from chain events; live verification facts per source; a safety quiz.
- **What reads live data.** Every amount comes from Robinhood Chain at the moment you look (through the site's read relay), the history from event logs read by the server, the verification facts from `eth_getCode` and Sourcify. Nothing is estimated: what cannot be read is shown as "—" or "not readable", with the reason.
- **The contract.** `ReclaSourceRegistry` lets any wallet register a claim source with a rules link and the hash of those rules; other wallets attest that the rules match the contract or flag it with a reason. It is written and tested but **not deployed yet**; until then the registry page runs in practice mode (signed messages kept in the browser, nothing sent).
- **Planned, not built.** Claim monitoring and alerts, premium analytics, a developer API, and $RECLA utility (analytics credits and access to those). They are labelled as planned on the site.
- **What nothing here claims.** Recla is not a tool to recover funds from a hacked wallet, cannot reverse a transaction and does not promise free assets. A readable or registered source is not a safe source. Recla never sends a transaction and never holds funds; every claim is signed by the user's own wallet. $RECLA has no promised value.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages and API routes (Next.js App Router): `/api/rpc` read relay, `/api/history` claim history, `/api/source` verification facts, `/api/chain` live chain snapshot. |
| `src/components/` | Interface components (claim check, simulator, registry, history, wallet dialog). |
| `src/config/` | `brand.ts` (name, ticker, token address, links), `contracts.ts` (registry address), `sources.ts` (built-in claim sources), `assets.ts` (every image path). |
| `src/lib/` | Claim adapters, Merkle proofs, simulator, history log walker, relay rules, and their tests. |
| `contracts/` | Solidity source (`src/`) and Foundry tests (`test/`, including a local-only mock escrow for end-to-end tests). |
| `scripts/` | `verify-deployment` and the contract artifact builder. |
| `public/` | Brand images and wallet logos. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
```

### What was checked for this snapshot

30 October 2026 (UTC), Node.js 25.8, forge 1.5.1 (solc 0.8.28): `npm run typecheck` and `npm run lint` exit 0; `npm test` 59 pass / 0 fail (signing gate, relay rules, Merkle proofs, registry input rules, simulator revert words, history log walker, rate limits, ABI vs artifact, verify-deployment); `npm run build` 32 routes; `forge test` 30 passed (27 unit and fuzz in `ReclaSourceRegistry.t.sol`, 3 invariants in `ReclaSourceRegistry.invariant.t.sol`, 1,024 fuzz runs, 64 x 48 invariant runs); fork test against Robinhood Chain 2 passed. Browser checks against a local chain (wallet dialog, register, attest, flag, claim, simulate) were run with Playwright and are not part of this repository.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:5920. Everything works with no configuration: chain reads use the public Robinhood Chain endpoints, rate limits are kept in memory. Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the WalletConnect option shows "Not configured on this site yet"; browser wallets still connect.

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| ReclaSourceRegistry | not deployed yet | — |

The registry records claim sources: the contract address, a kind (Merkle, vesting/lock, refund, fee escrow, other), an https rules link, the keccak256 of the rules text and a short label. One entry per wallet per source; one response (attest or flag with a reason) per wallet per entry, never by the entry's registrant. Counts are public and nothing is hidden. It has no owner, no admin, no fee, no upgrade path and no payable function, so it holds no funds. Deployment takes no constructor arguments (about 1,510,000 gas).

## Verify a deployment

```
npm run verify-deployment -- --registry <address> --registry-tx <creation tx hash>
```

The script compares the bytecode on Robinhood Chain with the build in this repository and prints MATCH or the first difference.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- Robinhood Chain RPC (official endpoint, then public mirrors) through the site's read relay. Calls to contracts a visitor names are relayed only with an explicit gas limit of at most 1,500,000 and count against a per-network and a site-wide budget.
- Claim history: event logs read by the server in 10,000,000-block windows (one topic value per position, which the official endpoint requires for wide ranges), newest first, up to 200 events per source; cached 10 minutes (30 seconds when a source failed).
- Verification facts: `eth_getCode` now, plus Sourcify (chain 4663) for verified source; "unknown" when Sourcify has no record.
- ETH / USD from the Chainlink feed on Robinhood Chain; token price, liquidity and volume from GeckoTerminal (network `robinhood`) once the token trades.
- Any read that fails shows "—" or "not readable" with the reason; nothing is filled in by guess.

## Token

$RECLA is the community token of Recla on Robinhood Chain. Contract address: announced on https://recla.lol at launch. It has no promised value. Analytics credits, premium monitoring and developer API access are planned uses, not live ones.

## Deploy your own

1. Import the repository into a Next.js host (framework preset Next.js, root `./`). No variable is required.
2. Optional environment variables (names and formats only):

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Server-side chain reads (relay, history, snapshot) | https URL |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Browser fallback RPC | https URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect option in the wallet dialog | 32 hex characters |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared rate-limit counters across server instances | https URL, opaque token |

3. Point the domain at the deployment, then check `/` (200) and `/api/chain` (JSON with a block number).
4. Contract: deploy `ReclaSourceRegistry` (no constructor arguments), put its address and block into `src/config/contracts.ts`, and run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The registry contract, the API routes, the read relay and the claim calldata the site builds are in scope; wallets, RPC providers, explorers, launchpads and the third-party claim contracts Recla reads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). The fonts (Archivo, Inter, JetBrains Mono) are served through `next/font` under the SIL Open Font License; wallet logos in `public/wallets/` belong to their projects and are used only to identify each wallet. The Recla name, logo and artwork belong to the project and are not licensed for reuse as a brand.
