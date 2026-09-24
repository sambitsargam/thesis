import Link from "next/link";
import {deployment} from "../chain";
import {Reveal} from "../motion";
import LaunchForm from "./LaunchForm";

export const metadata = {title: "Launch a basket — Thesis"};

export default function LaunchPage() {
  return (
    <main>
      <section className="hero" style={{paddingBottom: 30}}>
        <Reveal>
          <Link className="chip" href="/" style={{marginBottom: 22, display: "inline-block"}}>
            ← All baskets
          </Link>
          <h1 style={{fontSize: "clamp(1.9rem, 5vw, 2.7rem)", maxWidth: "18ch"}}>
            Launch your own basket
          </h1>
          <p>
            Describe a theme, pick the equities behind it, and deploy a tradeable ERC-20 in
            one transaction. No approval, no listing process, no fee.
          </p>
        </Reveal>
      </section>

      <section className="section" style={{marginTop: 8}}>
        <LaunchForm factory={deployment.factory} />
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
