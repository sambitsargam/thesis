import Link from "next/link";
import {erc20Abi, thesisBasketAbi, type TokenizedEquity} from "@thesis/shared";
import {XSTOCK_CATALOG} from "@thesis/shared/catalog";
import {deployment, publicClient} from "../chain";
import {Reveal} from "../motion";
import LaunchForm, {type Fork} from "./LaunchForm";

export const metadata = {title: "Launch a basket — Thesis"};

/**
 * Resolves `?from=0x…` into a basket to copy.
 *
 * Anything that is not a readable basket resolves to nothing rather than an error: the
 * address comes from a URL, so it can be any contract at all, including one that is not
 * a basket. The form then simply opens empty.
 */
async function resolveFork(from?: string): Promise<Fork | undefined> {
  if (!from || !/^0x[0-9a-fA-F]{40}$/.test(from)) return undefined;
  const address = from as `0x${string}`;

  try {
    const [name, theme, constituents] = await Promise.all([
      publicClient.readContract({address, abi: thesisBasketAbi, functionName: "name"}),
      publicClient.readContract({address, abi: thesisBasketAbi, functionName: "theme"}),
      publicClient.readContract({address, abi: thesisBasketAbi, functionName: "constituents"})
    ]);

    const holdings: TokenizedEquity[] = await Promise.all(
      constituents.map(async (token) => {
        const listed = XSTOCK_CATALOG.find(
          (equity) => equity.address.toLowerCase() === token.toLowerCase()
        );
        if (listed) return listed;

        // Not in our catalogue — a basket forked from elsewhere can still name it.
        const ticker = await publicClient
          .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
          .catch(() => "?");
        return {address: token, ticker, name: ticker} as TokenizedEquity;
      })
    );

    return {address, name, theme, constituents: holdings};
  } catch {
    return undefined;
  }
}

export default async function LaunchPage({
  searchParams
}: {
  searchParams: Promise<{from?: string}>;
}) {
  const fork = await resolveFork((await searchParams).from);

  return (
    <main>
      <section className="hero" style={{paddingBottom: 30}}>
        <Reveal>
          <Link className="chip" href="/" style={{marginBottom: 22, display: "inline-block"}}>
            ← All baskets
          </Link>
          <h1 style={{fontSize: "clamp(1.9rem, 5vw, 2.7rem)", maxWidth: "18ch"}}>
            {fork ? `Fork ${fork.name}` : "Launch your own basket"}
          </h1>
          <p>
            Describe a theme, pick the equities behind it, and deploy a tradeable ERC-20 in
            one transaction. No approval, no listing process.
            {deployment.factoryV2 ? " You set the fee and you keep it." : " No fee beyond gas."}
          </p>
        </Reveal>
      </section>

      <section className="section" style={{marginTop: 8}}>
        <LaunchForm
          factory={deployment.factoryV2 ?? deployment.factory}
          feeCapable={Boolean(deployment.factoryV2)}
          fork={fork}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What you are deploying</h2>
        </div>
        <Reveal>
          <div className="card">
            <div className="row">
              <span>Contract</span>
              <span>A fresh `ThesisBasket` ERC-20, deployed by the factory</span>
            </div>
            <div className="row">
              <span>Weighting</span>
              <span>Equal across every constituent you pick, fixed at deployment</span>
            </div>
            <div className="row">
              <span>Your powers</span>
              <span>None. You are recorded as creator; you cannot pause or drain it</span>
            </div>
            {deployment.factoryV2 && (
              <div className="row">
                <span>Your earnings</span>
                <span>Your chosen share of every mint, capped at 1% and fixed at deployment</span>
              </div>
            )}
            <div className="row">
              <span>Who can mint</span>
              <span>Anyone. Baskets are public once deployed</span>
            </div>
            <div className="row">
              <span>Cost</span>
              <span>One transaction, roughly 0.00005 OKB in gas</span>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
