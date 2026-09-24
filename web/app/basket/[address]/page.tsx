import Link from "next/link";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {deployment, explorer, publicClient} from "../../chain";
import MintPanel from "./MintPanel";

export const revalidate = 15;

export default async function BasketPage({params}: {params: Promise<{address: string}>}) {
  const {address} = await params;
  const basket = address as `0x${string}`;

  const [name, symbol, theme, constituents, supply, nav] = await Promise.all([
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "name"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "symbol"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "theme"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "constituents"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "totalSupply"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "navPerShare"})
  ]);

  const symbols = await Promise.all(
    constituents.map((token) =>
      publicClient
        .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
        .catch(() => token.slice(0, 8))
    )
  );

  const [, units] = nav;
  const weight = Math.floor(10_000 / constituents.length);

  return (
    <main>
      <Link className="tag" href="/">
        ← all baskets
      </Link>
      <h1 style={{marginTop: 14}}>
        {name} · {symbol}
      </h1>
      <p className="lede">&ldquo;{theme}&rdquo;</p>

      <MintPanel
        basket={basket}
        symbol={symbol}
        quoteToken={deployment.quoteToken}
        constituents={constituents}
        supplyIsZero={supply === 0n}
        builderCode={process.env.BUILDER_CODE}
      />

      <h2>Holdings</h2>
      <div className="card">
        {constituents.map((token, i) => (
          <div className="row" key={token}>
            <span>
              {symbols[i]} · {(weight / 100).toFixed(2)}%
            </span>
            <a className="mono" href={explorer(`address/${token}`)}>
              {units[i] === undefined ? "—" : `${formatUnits(units[i], 18)} / share`}
            </a>
          </div>
        ))}
      </div>

      <h2>Basket</h2>
      <div className="card">
        <div className="row">
          <span>Shares outstanding</span>
          <span className="mono">{formatUnits(supply, 18)}</span>
        </div>
        <div className="row">
          <span>Weighting</span>
          <span className="mono">equal, {weight} bps each</span>
        </div>
        <div className="row">
          <span>Backing</span>
          <span className="mono">fully backed, redeemable in kind</span>
        </div>
        <div className="row">
          <span>Contract</span>
          <a className="mono" href={explorer(`address/${basket}`)}>
            {basket}
          </a>
        </div>
      </div>
    </main>
  );
}
