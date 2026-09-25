# Thesis

**Describe an investment theme in plain language. Get a tradeable, fully backed
basket of tokenized equities on X Layer — deployed and minted in one transaction.**

**Live app → [thesisindex.vercel.app](https://thesisindex.vercel.app)**
**Demo video → [youtu.be/3p_6OKx7yOE](https://youtu.be/3p_6OKx7yOE)**

Built for OKX Dev Day 2026 · Build a Market track · everything below is live on
X Layer mainnet (chain 196).

---

## The problem

X Layer carries **639 tokenized equities**, **44 of them with live DEX liquidity
today** — and they are sold one at a time.
Expressing a view — *"semiconductor supply chain"*, *"nuclear power and grid
modernisation"* — means many swaps, many fees, manual weighting and manual
rebalancing forever. Every index product in traditional finance exists because this
problem is real. On-chain it should be one click.

## What Thesis does

```
"nuclear power and grid modernisation"
        │
        ├─ the agent searches the open web and cites what it read
        ├─ picks NEEx · DUKx · EXCx · PWRx · GEVx from the live catalogue
        │
        ▼
   a new ERC-20, deployed by anyone, owned by nobody
        │
   mint with USD₮0 ──► the contract buys all five through Onchain OS Trade
        │
   hold one token ──► backed 1:1 by real equities, redeemable any time
        │
   sell ──► take the equities out, or cash out to USD₮0 in one transaction
```

---

## Live on X Layer mainnet

| Contract | Address | |
| --- | --- | --- |
| `ThesisFactory` | `0xB8b2d90DB14aa4D3964bC1c6a6821c2739f1254e` | [OKLink](https://www.oklink.com/xlayer/address/0xB8b2d90DB14aa4D3964bC1c6a6821c2739f1254e) |
| `OkxTradeRouter` | `0x2f0e2561283b0953B87C0069590DdE6fDD2766d9` | [OKLink](https://www.oklink.com/xlayer/address/0x2f0e2561283b0953B87C0069590DdE6fDD2766d9) |
| `ThesisZap` | `0x42FF891cd488fAA984aad9c981aE0ADE792960A0` | [OKLink](https://www.oklink.com/xlayer/address/0x42FF891cd488fAA984aad9c981aE0ADE792960A0) |
| `THESIS-TECH` (demo basket) | `0x728896dBB0Dd3c75313e2238AB4F3Fb3Daf5d1BB` | [OKLink](https://www.oklink.com/xlayer/address/0x728896dBB0Dd3c75313e2238AB4F3Fb3Daf5d1BB) |

**Proof it works end to end** — mint transaction
[`0x798d56e0…c4d52a43`](https://www.oklink.com/xlayer/tx/0x798d56e069a1b1893612d8d5282d59f7da01dc884c1ec4c54ed89874c4d52a43)
(block 71543715): 1.200000 USD₮0 in, 1.200000 THESIS-TECH out, backed by real NVDAx,
TSLAx and SPYx, with the ERC-8021 Builder Code appended to the calldata. OKX aggregator
quote → `OkxTradeRouter` → OKX `DexRouter` → measured fills → shares minted at exactly
`minSharesOut`.

Decoded from that transaction's own calldata:

```
33647767667a69766765623462397967 10 00 80218021802180218021802180218021
└ "3dwgfzivgeb4b9yg"              │  │  └ ERC-8021 marker
                                  │  └ schema id
                                  └ code length, 16 bytes
```

Baskets are quoted in [USD₮0](https://www.oklink.com/xlayer/address/0x779Ded0c9e1022225f8E0630b35a9b54bE713736)
(`0x779Ded0c…`, 6 decimals).

---

## How the OKX integration actually works

**Onchain OS Trade is quoted off-chain.** The aggregator returns ready-made calldata,
and no contract can call an HTTP API mid-transaction. So `mint` takes one calldata
blob per constituent, fetched by the caller, and `OkxTradeRouter` forwards each to the
OKX `DexRouter` — after approving `DexTokenApprove`, the two-contract pattern OKX
requires, where approving the router directly silently fails.

**The adapter never trusts that calldata.** It measures its own balance before and
after each call and enforces `minAmountOut` against the difference, never against
anything the blob claims. Calldata that diverts the output elsewhere yields a measured
fill of zero and reverts the whole transaction — `test_RevertWhen_CalldataDivertsTheOutput`
proves it. Unspent input is refunded in the same call.

| OKX contract | Address on X Layer |
| --- | --- |
| `DexRouter` | `0x7c5bEE2a8091C3ef39072f64F18Fac913060AEaF` |
| `DexTokenApprove` | `0x8b773D83bc66Be128c60e07E17C8901f7a64F000` |

### Builder Code

Every transaction the app sends carries the X Layer Builder Code **`3dwgfzivgeb4b9yg`**,
minted from the [OKX developer portal](https://web3.okx.com/onchainos/dev-portal). The
[ERC-8021](https://eip.tools/eip/8021) suffix is built by `ox` and set as `dataSuffix`
on the viem wallet client, so it rides on *every* call — approvals included — rather
than only the ones that remembered to add it:

```
3dwgfzivgeb4b9yg  10  00  80218021802180218021802180218021
└ code, 16 bytes  │   │   └ ERC-8021 marker, 16 bytes
                  │   └ schema id
                  └ code length                    = 34 bytes
```

Contracts need no changes — the decoder ignores trailing calldata, proven against the
real `mint` selector by `test_MintAcceptsTrailingBuilderCodeCalldata`.

---

## The agent

### Deep research

Type a theme and the agent **searches the open web** before choosing anything, in two
deliberately separate passes:

1. **Search** — a model with web search reads current coverage and writes a briefing,
   keeping every page it cites.
2. **Select** — a second pass turns that briefing into constituents, constrained to the
   44 equities that can actually be traded on X Layer, with one reason per holding.

Splitting them matters. Research is open-ended; selection is not. The second pass only
ever sees the real catalogue and unknown tickers are discarded — **a basket is
immutable once deployed, so a single hallucinated ticker would be permanently
unmintable.** The UI shows the outlook, the risks, the reason behind each holding and
every source, so the reasoning can be checked rather than trusted.

```bash
pnpm --filter @thesis/agent research "nuclear power and grid modernisation"
#  → NEEx, DUKx, EXCx, PWRx, GEVx   (7 sources cited)
```

### Rebalancing

Equal weight is a statement about *value*, so a basket drifts as its holdings move.
The planner prices every constituent from executable OKX routes, computes drift against
the target, pairs the most overweight against the most underweight, and returns
ready-to-sign legs. Below 25 bps it declines to trade, because the spread would cost
more than the correction is worth.

The agent submits the plan; the contract enforces its own invariants regardless — only
the agent may call it, every leg must carry a floor price, and the basket must end
holding no quote token. **A rebalance can trade badly. It can never move value out.**

---

## Guarantees

| | |
| --- | --- |
| **Fully backed** | Every share is a claim on real tokenized equities held by the contract. Nothing synthetic, no leverage, no oracle |
| **No owner** | No pause switch, no upgrade path, no admin key. The creator of a basket gains no power over it |
| **Redeemable** | Burn shares, receive the underlying pro rata. Needs no price and no venue, so it cannot fail on slippage or a missing route |
| **Value cannot leak** | The trade adapter verifies every fill by balance delta; the rebalance must end with no quote token; the zap returns anything unsold in kind |

The share maths is oracle-free. The first mint prices one share per whole quote token;
every later mint prices off the **scarcest leg actually received**, so a bad fill
dilutes the minter and never the existing holders —
`test_MintAfterAppreciationGivesFewerShares` pins this down.

---

## Repository

| Path | Contents |
| --- | --- |
| `contracts/` | Foundry — 5 contracts, 661 lines of Solidity, **73 tests** |
| `shared/` | ABIs, addresses, the OKX client, the AI agent, the equity catalogue |
| `agent/` | CLI — `mint`, `resolve`, `research` |
| `web/` | Next.js app on Vercel |

### Contracts

- **`ThesisBasket`** — ERC-20 for one basket. Mint, redeem in kind, agent rebalance
- **`ThesisFactory`** — permissionless deployment and registry. Holds no funds, has no owner
- **`OkxTradeRouter`** — adapter to Onchain OS Trade. Stateless, verifies every fill
- **`ThesisZap`** — sells a whole position back to USD₮0 in one transaction
- **`ITradeRouter`** — the seam between baskets and the venue

### Development

Requirements: Node 20+, pnpm 8+, Foundry.

```bash
pnpm install
cp .env.example .env     # fill in locally; never commit
pnpm check               # forge build + 73 tests + typecheck across every package
```

| Command | Does |
| --- | --- |
| `pnpm check` | Everything: contracts, tests, types |
| `pnpm --filter @thesis/web dev` | Run the web app |
| `pnpm --filter @thesis/agent research "<theme>"` | Deep research from the terminal |
| `pnpm --filter @thesis/agent mint --amount=2` | Dry-run a mint (add `--send` to submit) |

### Deploying

```bash
forge script contracts/script/DeployThesis.s.sol --root contracts \
  --rpc-url https://rpc.xlayer.tech --account <keystore> --broadcast
```

Every address is read from the environment — nothing is hardcoded, because a wrong
constituent baked into a script is a wrong basket on mainnet. The script writes
`deployments/<chainId>.json`, which the app reads at runtime.

The web app is a read-and-sign client: it holds **no private key**, and every
transaction is signed in the visitor's own wallet.

---

## Network

| | X Layer mainnet |
| --- | --- |
| Chain ID | 196 |
| RPC | `https://rpc.xlayer.tech` |
| Gas token | OKB (a full deployment cost 0.000114 OKB) |
| Explorer | [OKLink](https://www.oklink.com/xlayer) |

## License

MIT — see [LICENSE](LICENSE).
