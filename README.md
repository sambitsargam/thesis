# Thesis

**Permissionless index launchpad for tokenized equities on X Layer.**
Describe an investment theme in plain language and a tradeable basket of tokenized
equities is deployed on X Layer in one transaction.

**Live app: [thesis-xlayer.vercel.app](https://thesis-xlayer.vercel.app)**

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
| `ThesisZap` | `0x42FF891cd488fAA984aad9c981aE0ADE792960A0` | [OKLink](https://www.oklink.com/xlayer/address/0x42FF891cd488fAA984aad9c981aE0ADE792960A0) |

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

### Available constituents

X Layer carries **639 tokenized equities**, read from
`GET /api/v6/dex/aggregator/all-tokens?chainIndex=196` and cached in
`shared/src/xstocks.json`. All are 18 decimals. The launcher searches the whole
catalogue by ticker or company name; the list stays server-side so it never enters
the browser bundle.

Because constituents are fixed at deployment, the launcher quotes every selected
equity against USD₮0 **before** spending gas — a basket holding something the
aggregator cannot route could never be minted.

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

### Redeeming returns the underlying, not USD₮0

`redeem` burns shares and transfers each constituent pro rata. It needs no price and
no venue, so it cannot fail on slippage or a missing route — the claim is simply a
fraction of what the contract holds.

Tokenized equities are not in any wallet's default token list, so the balances arrive
invisibly unless the token is added. The app prompts the wallet to add them
(EIP-747 `wallet_watchAsset`) after both minting and redeeming.

Holders who want cash instead can sell through **`ThesisZap`**, which burns shares,
redeems in kind and sells every constituent through Onchain OS Trade in a single
transaction. It is a peripheral contract, deliberately not part of `ThesisBasket`:
baskets are immutable once deployed, and keeping the optional path outside them means
a routing failure can never block a basket's own redeem. The zap holds nothing between
calls, returns anything a route declined to take in kind, and refuses any basket whose
router differs from its own.

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

Transactions are attributed with the X Layer Builder Code **`3dwgfzivgeb4b9yg`**,
minted from the [OKX developer portal](https://web3.okx.com/onchainos/dev-portal)
against the registry at
[`0xd6c426f9…0510823b`](https://www.oklink.com/xlayer/address/0xd6c426f9c077358735622ae5a83468dc0510823b).

Attribution uses the [ERC-8021](https://eip.tools/eip/8021) data suffix, built by
`ox` and set as `dataSuffix` on the viem wallet client. Every transaction that
client sends carries it — the ERC-20 approval as well as the mint — rather than
only the calls that remembered to add it. The suffix is 34 bytes:

```
3dwgfzivgeb4b9yg  10  00  80218021802180218021802180218021
└ code, 16 bytes  │   │   └ ERC-8021 marker, 16 bytes
                  │   └ schema id
                  └ code length
```

Contracts need no changes: the decoder ignores trailing calldata, which
`test_MintAcceptsTrailingBuilderCodeCalldata` proves against the real `mint`
selector. Cost is 16 gas per non-zero byte.

Verify attribution on any transaction with the
[Builder Code checker](https://builder-code.vercel.app/checker), or read it beside
the txn hash on OKLink.

## Live app

**[thesis-xlayer.vercel.app](https://thesis-xlayer.vercel.app)** — deployed on Vercel
from this repository, served from Singapore (`sin1`). The web app is a read-and-sign client: it
holds **no private key**, and signing always happens in the visitor's wallet.

### Deploying

Vercel builds the whole workspace from the repository root, so `@thesis/shared` is
resolved the same way it is locally. Security and cache headers live in
`web/next.config.mjs`, because Vercel ignores `headers` from `vercel.json` on
Next.js projects.

```bash
vercel link          # once, to attach the project
vercel --prod        # deploy
```

Environment variables to set in the Vercel project:

| Variable | Why |
| --- | --- |
| `OKX_API_KEY` | Signs quote requests to Onchain OS Trade |
| `OKX_API_SECRET` | Same |
| `OKX_API_PASSPHRASE` | Same |
| `NEXT_PUBLIC_BUILDER_CODE` | ERC-8021 attribution, public by design |
| `XLAYER_RPC_URL` | Optional. Defaults to `https://rpc.xlayer.tech` |

**Never set `DEPLOYER_PRIVATE_KEY` on Vercel.** Nothing server-side signs a
transaction: quotes are fetched with the OKX credentials, chain reads are public,
and every write is signed by the visitor's own wallet.

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
