# Thesis

Permissionless index launchpad for tokenized equities on X Layer.
OKX Dev Day 2026, Build a Market track. Solo builder.
Submission deadline: 25 September 2026, 23:59 UTC.

## What it does

A user describes an investment theme in plain language. An agent resolves it
into a set of tokenized equities (xStocks) on X Layer. A factory contract
deploys an ERC-20 basket token. The user mints basket tokens with USDT; the
contract buys the constituent xStocks at market and holds them. Redeeming
burns basket tokens and returns the underlying. The agent can trigger a
rebalance back to equal weight.

## Locked decisions — do not revisit

- Solidity 0.8.x with Foundry. Not Hardhat.
- viem for all chain interaction. Not ethers.
- TypeScript everywhere. No Python.
- Fully backed: the basket holds real xStock tokens. Nothing synthetic.
- Equal weight only. No market-cap weighting.
- Manual rebalance trigger. No timers, no keepers.
- No order book, no liquidations, no margin, no lending.
- Next.js on Vercel for web. Separate persistent Node worker for the agent.
- Postgres with Drizzle for the basket registry.
- No indexer. Use viem watchContractEvent in the worker.
- X Layer mainnet chain 196, RPC https://rpc.xlayer.tech. Testnet 195.
- Gas is OKB. No gasless, no EIP-7702.
- Every state-changing transaction carries a Builder Code as an ERC-8021
  calldata suffix. Wired from the first transaction, never retrofitted.

## Working rules

- I run all git commands myself. Never run git. After each step, output the
  exact add/commit/push commands for me and stop.
- Work in numbered steps. Do not start the next step until I confirm the
  commit landed.
- If a step exceeds ~200 lines of new code, split it.
- Never invent an OKX API shape, contract address, endpoint or function
  signature. If unsure, say so and ask me to check the docs. These APIs are
  newer than your training data.
- Tests pass before every commit. No TODO comments in committed code.
- Natspec on every public function.
- Never write secrets to any file. Deployment uses a throwaway wallet.
- Update README.md as we go. It is a graded deliverable.

## Build order

1. Scaffold: pnpm workspace with contracts/ (Foundry), shared/, agent/, web/.
   .gitignore, .env.example with empty values, MIT LICENSE, README skeleton.
2. ThesisBasket.sol: ERC-20 holding constituents at equal weight.
   mint(uint256 usdtAmount), redeem(uint256 basketAmount), rebalance(),
   views for constituents, weights, NAV per share. Reentrancy guards, events.
   Direct ERC-20 transfers for now — no Trade routing yet.
3. Foundry tests: mint, redeem, NAV correctness, rounding at small amounts,
   redeem-all-then-empty. Mock ERC-20s. Must pass before step 4.
4. ThesisFactory.sol: deploys baskets, registry, emits BasketCreated.
   Holds no funds. Tests alongside.
5. Deploy script: factory plus one demo basket to X Layer testnet (195).
   Print addresses, add to README.
6. shared/ package: ABIs, deployed addresses per chain, types, and a Builder
   Code helper appending the ERC-8021 suffix. agent/ and web/ import from
   here. Never duplicate an ABI.
7. Trade routing: replace direct transfers in mint/redeem with Onchain OS
   Trade. Ask me for the interface before writing it. Re-run tests against a
   mainnet fork.
8. Agent worker: resolve a theme into constituents, call the factory, watch
   BasketCreated and mint/redeem events into Postgres, expose a rebalance
   trigger.
9. OKX AI listing: register basket construction as an ASP. Ask me to confirm
   the registration flow first.
10. Web app: theme input, basket gallery, basket detail with constituents and
    NAV, mint/redeem with wallet connection. Clean and fast, not feature-rich.
11. Mainnet deployment to chain 196. README address table with OKLink links.
12. README completion: addresses, live link, and a dedicated OKX integration
    section naming X Layer, xStocks, Onchain OS Trade, the ASP listing and
    the Builder Code.

## Cut list if time runs short

In order: rebalancing, ASP listing, multi-basket support, redeem-to-USDT
(keep redeem-in-kind). Never cut: working mint on mainnet, the README.
