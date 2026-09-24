import Link from "next/link";
import {thesisBasketAbi, thesisFactoryAbi} from "@thesis/shared";
import {CHAIN_ID, deployment, explorer, publicClient} from "./chain";

export const revalidate = 15;

async function loadBaskets() {
  const addresses = await publicClient.readContract({
    address: deployment.factory,
    abi: thesisFactoryAbi,
    functionName: "baskets"
  });

  return Promise.all(
    addresses.map(async (address) => {
      const [name, symbol, theme, constituents] = await Promise.all([
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "name"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "symbol"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "theme"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "constituents"})
      ]);
      return {address, name, symbol, theme, count: constituents.length};
    })
  );
}

export default async function Home() {
  const baskets = await loadBaskets();

  return (
    <main>
      <span className="tag">X Layer · chain {CHAIN_ID}</span>
      <h1 style={{marginTop: 14}}>Thesis</h1>
      <p className="lede">
        Describe an investment theme. Get one tradeable basket of tokenized equities, fully
        backed and minted in a single transaction.
      </p>

      <h2>Baskets</h2>
      {baskets.length === 0 ? (
        <p className="lede">No baskets deployed yet.</p>
      ) : (
        baskets.map((basket) => (
          <Link key={basket.address} className="card" href={`/basket/${basket.address}`}>
            <div className="card-title">
              {basket.name} · {basket.symbol}
            </div>
            <div className="card-theme">
              &ldquo;{basket.theme}&rdquo; — {basket.count} constituents, equal weight
            </div>
          </Link>
        ))
      )}

      <h2>Contracts</h2>
      <div className="card">
        <div className="row">
          <span>Factory</span>
          <a className="mono" href={explorer(`address/${deployment.factory}`)}>
            {deployment.factory}
          </a>
        </div>
        <div className="row">
          <span>Trade adapter</span>
          <a className="mono" href={explorer(`address/${deployment.router}`)}>
            {deployment.router}
          </a>
        </div>
        <div className="row">
          <span>Quote token</span>
          <a className="mono" href={explorer(`address/${deployment.quoteToken}`)}>
            USD₮0
          </a>
        </div>
      </div>
    </main>
  );
}
