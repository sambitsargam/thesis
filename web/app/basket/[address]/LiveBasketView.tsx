"use client";

import {useState} from "react";
import type {LiveBasket} from "../../api/basket/route";
import Allocation from "../../Allocation";
import {AnimatedNumber, Bar, Flash, Reveal} from "../../motion";
import {usd, usePrices} from "../../usePrices";
import {useLiveBasket} from "../../useLiveBasket";
import ActionPanel from "./ActionPanel";
import YourPosition from "./YourPosition";

interface Props {
  basket: `0x${string}`;
  symbol: string;
  quoteToken: `0x${string}`;
  constituents: readonly `0x${string}`[];
  initial: LiveBasket;
  explorerBase: string;
}

export default function LiveBasketView(props: Props) {
  const {data, pulse, refresh} = useLiveBasket(props.basket, props.initial);
  const {prices, ready: pricesReady} = usePrices();
  const [justMinted, setJustMinted] = useState(false);

  const supply = Number(data.supply);
  const weight = 100 / props.constituents.length;

  // Value the basket at executable OKX prices; there is no oracle on chain.
  const valued = data.holdings.map((holding) => ({
    ...holding,
    price: prices[holding.address.toLowerCase()] ?? 0,
    value: (prices[holding.address.toLowerCase()] ?? 0) * Number(holding.held)
  }));
  const totalValue = valued.reduce((sum, h) => sum + h.value, 0);
  const navPerShare = supply > 0 ? totalValue / supply : 0;
  const showUsd = pricesReady && totalValue > 0;

  return (
    <>
      <dl className={`stats ${pulse ? "pulsing" : ""}`}>
        <div className="stat">
          <dt>Symbol</dt>
          <dd>{props.symbol}</dd>
        </div>
        <div className="stat">
          <dt>Constituents</dt>
          <dd>
            <AnimatedNumber value={props.constituents.length} />
          </dd>
        </div>
        <div className="stat">
          <dt>Each weighted</dt>
          <dd>
            <AnimatedNumber value={weight} decimals={2} suffix="%" />
          </dd>
        </div>
        <div className="stat">
          <dt>Shares out</dt>
          <dd>
            <Flash watch={data.supply}>
              <AnimatedNumber value={supply} decimals={supply === 0 ? 0 : 3} />
            </Flash>
          </dd>
        </div>
        <div className="stat">
          <dt>NAV per share</dt>
          <dd>{showUsd ? <AnimatedNumber value={navPerShare} decimals={4} prefix="$" /> : "—"}</dd>
        </div>
        <div className="stat">
          <dt>Basket value</dt>
          <dd>{showUsd ? <AnimatedNumber value={totalValue} decimals={2} prefix="$" /> : "—"}</dd>
        </div>
      </dl>

      <div className="trade-row" style={{marginTop: 32}}>
      <section className="section" style={{marginTop: 0}}>
        <ActionPanel
          basket={props.basket}
          symbol={props.symbol}
          quoteToken={props.quoteToken}
          constituents={props.constituents}
          holdings={data.holdings}
          supplyIsZero={supply === 0}
          onChanged={() => {
            setJustMinted(true);
            void refresh();
            // The receipt lands before the node has indexed it; poll again.
            setTimeout(() => void refresh(), 2500);
            setTimeout(() => void refresh(), 6000);
          }}
        />
      </section>

      <YourPosition
        basket={props.basket}
        symbol={props.symbol}
        supply={data.supply}
        holdings={data.holdings}
        refreshKey={data.blockNumber}
      />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>What backs each share</h2>
          <span className="note">
            {supply === 0 ? (
              "Nothing minted yet"
            ) : (
              <>
                Basket composition · block <span className="tnum">{data.blockNumber}</span>
              </>
            )}
          </span>
        </div>

        {showUsd && (
          <Reveal>
            <div className="card" style={{marginBottom: 12}}>
              <Allocation
                slices={valued.map((h) => ({ticker: h.ticker, value: h.value, target: weight}))}
              />
            </div>
          </Reveal>
        )}

        <div className="card">
          {valued.map((holding, i) => (
            <Reveal key={holding.address} delay={i * 70}>
              <div className="holding">
                <div className="holding-top">
                  <span className="holding-name">
                    {holding.ticker}
                    {holding.price > 0 && (
                      <span className="holding-price">{usd(holding.price)}</span>
                    )}
                  </span>
                  <span className="holding-units">
                    <Flash watch={holding.perShare}>
                      {Number(holding.perShare) === 0
                        ? "—"
                        : Number(holding.perShare).toFixed(9)}
                    </Flash>
                  </span>
                </div>
                <Bar percent={weight} delay={i * 90} />
                <div className="holding-top" style={{marginTop: 8}}>
                  <span className="holding-units" style={{opacity: 0.7}}>
                    {weight.toFixed(2)}% target
                  </span>
                  <span className="holding-units" style={{opacity: 0.7}}>
                    basket holds{" "}
                    <Flash watch={holding.held}>{Number(holding.held).toFixed(9)}</Flash>
                    {holding.value > 0 && ` · ${usd(holding.value)}`}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {justMinted && (
          <p className="status done">Updated live — no reload needed.</p>
        )}
      </section>
    </>
  );
}
