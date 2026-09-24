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

Live on **X Layer mainnet (chain 196)**, deployed 24 September 2026 in block 71491743.

| Contract | Address | Explorer |
| --- | --- | --- |
| `ThesisFactory` | `0xB8b2d90DB14aa4D3964bC1c6a6821c2739f1254e` | [OKLink](https://www.oklink.com/xlayer/address/0xB8b2d90DB14aa4D3964bC1c6a6821c2739f1254e) |
| `OkxTradeRouter` | `0x2f0e2561283b0953B87C0069590DdE6fDD2766d9` | [OKLink](https://www.oklink.com/xlayer/address/0x2f0e2561283b0953B87C0069590DdE6fDD2766d9) |
| `THESIS-TECH` basket | `0x728896dBB0Dd3c75313e2238AB4F3Fb3Daf5d1BB` | [OKLink](https://www.oklink.com/xlayer/address/0x728896dBB0Dd3c75313e2238AB4F3Fb3Daf5d1BB) |

### Proven on mainnet

The full path has executed end to end on chain 196 — OKX aggregator quote →
`OkxTradeRouter` → OKX `DexRouter` → measured fills → shares minted.

| | |
| --- | --- |
| Mint transaction | [`0xc9521156…e43f38f9`](https://www.oklink.com/xlayer/tx/0xc9521156d21981f52f94d005ccd5ffe805b3e39008df34ab04e3c24ae43f38f9) |
| Block | 71494224 |
| Paid in | 3.000000 USD₮0 |
| Received | 3.000000 THESIS-TECH |

The basket now holds real equities, redeemable in kind at any time:

| Constituent | Basket holds | Per whole share |
| --- | --- | --- |
| NVDAx | 0.004509688 | 0.001503229 |
| TSLAx | 0.002652390 | 0.000884130 |
| SPYx | 0.001307238 | 0.000435746 |

Shares were minted at exactly `minSharesOut`, so nothing was lost to slippage on
the way in.

### The demo basket

**Thesis US Megacaps** (`THESIS-TECH`) — *"US megacap equities, equal weight"*, three
constituents at a 3,333 bps target weight each.

| Constituent | Address |
| --- | --- |
| NVDAx | [`0xc845b2894dBddd03858fd2D643B4eF725fE0849d`](https://www.oklink.com/xlayer/address/0xc845b2894dBddd03858fd2D643B4eF725fE0849d) |
| TSLAx | [`0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0`](https://www.oklink.com/xlayer/address/0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0) |
| SPYx | [`0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48`](https://www.oklink.com/xlayer/address/0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48) |

Baskets are minted with [USD₮0](https://www.oklink.com/xlayer/address/0x779Ded0c9e1022225f8E0630b35a9b54bE713736)
(`0x779Ded0c9e1022225f8E0630b35a9b54bE713736`, 6 decimals).

## OKX integration

| Piece | How Thesis uses it |
| --- | --- |
| **X Layer** | Every contract is deployed to mainnet chain 196. Gas is OKB. |
| **xStocks** | Baskets hold real tokenized equities. Fully backed — no synthetic exposure. |
| **Onchain OS Trade** | `OkxTradeRouter` routes every mint swap through the OKX aggregator. |

### How the Trade integration works

Onchain OS Trade is quoted **off-chain**: the aggregator API returns ready-made
transaction calldata, which no contract can fetch mid-transaction. So `mint` takes one
calldata blob per constituent, obtained by the caller, and `OkxTradeRouter` forwards each
to the OKX `DexRouter` after approving `DexTokenApprove` — the two-contract pattern OKX
requires, where approving the router directly silently fails.

The adapter treats that calldata as **untrusted**. It measures its own balance before and
after each call and enforces `minAmountOut` against the difference, never against anything
the blob claims. Calldata that diverts the output elsewhere yields a measured fill of zero
and reverts the whole transaction. Unspent input is refunded in the same call, so the
adapter never holds a balance between swaps.

| OKX contract | Address on X Layer |
| --- | --- |
| `DexRouter` | `0x7c5bEE2a8091C3ef39072f64F18Fac913060AEaF` |
| `DexTokenApprove` | `0x8b773D83bc66Be128c60e07E17C8901f7a64F000` |

### Builder Code

Every state-changing call accepts an ERC-8021 builder code appended to its calldata.
`ThesisBasket` ignores the trailing bytes by design, proven by
`test_MintAcceptsTrailingBuilderCodeCalldata`.

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
