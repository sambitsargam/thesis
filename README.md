# Thesis

**Permissionless index launchpad for tokenized equities on X Layer.**
Describe an investment theme in plain language and a tradeable basket of tokenized
equities is deployed on X Layer in one transaction.

Built for OKX Dev Day 2026 — Build a Market track.

---

## The problem

Tokenized stocks on X Layer are sold one at a time. Any diversified position means
multiple swaps, multiple fees, manual weighting and manual rebalancing forever.
There is no way to express a thematic view as a single holdable asset.

## How it works

1. A user describes a theme — *"semiconductor supply chain, equal weight"*.
2. The agent resolves it into a set of tokenized equities (xStocks) on X Layer.
3. `ThesisFactory` deploys a `ThesisBasket` ERC-20 for that theme.
4. The user mints basket tokens with USDT. The contract buys the constituents at
   market through Onchain OS Trade and holds them. The basket is fully backed.
5. Redeeming burns basket tokens and returns the underlying.
6. The agent can trigger a rebalance back to equal weight.

## Repository layout

| Path         | Contents                                                        |
| ------------ | --------------------------------------------------------------- |
| `contracts/` | Foundry project — `ThesisBasket`, `ThesisFactory`, tests, deploy |
| `shared/`    | ABIs, deployed addresses, chain config, builder-code helper       |
| `agent/`     | Persistent Node worker — theme resolution, event watching         |
| `web/`       | Next.js app — theme input, basket gallery, mint and redeem        |

## Deployed contracts

Addresses are added as each deployment lands.

| Contract        | Network              | Address | Explorer |
| --------------- | -------------------- | ------- | -------- |
| `ThesisFactory` | X Layer (196)        | _TBD_   | _TBD_    |
| `ThesisFactory` | X Layer Testnet (195)| _TBD_   | _TBD_    |

## OKX integration

Completed as the build lands — X Layer, xStocks, Onchain OS Trade, the OKX AI ASP
listing and the ERC-8021 Builder Code.

## Development

Requirements: Node 20+, pnpm 8+, Foundry.

```bash
pnpm install
cp .env.example .env   # fill in locally; never commit
pnpm check             # forge build + forge test + typecheck
```

| Command                | Does                                  |
| ---------------------- | ------------------------------------- |
| `pnpm build:contracts` | `forge build`                         |
| `pnpm test:contracts`  | `forge test`                          |
| `pnpm typecheck`       | TypeScript across every workspace     |
| `pnpm --filter @thesis/web dev`   | Run the web app            |
| `pnpm --filter @thesis/agent dev` | Run the agent worker       |

## Network

| | X Layer mainnet | X Layer testnet |
| --- | --- | --- |
| Chain ID | 196 | 195 |
| RPC | `https://rpc.xlayer.tech` | `https://testrpc.xlayer.tech` |
| Gas token | OKB | OKB |
| Explorer | [OKLink](https://www.oklink.com/xlayer) | [OKLink](https://www.oklink.com/xlayer-test) |

## License

MIT — see [LICENSE](LICENSE).
