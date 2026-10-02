"use client";

import {useState} from "react";
import type {LiveBasket} from "../../api/basket/route";
import {AnimatedNumber, Flash} from "../../motion";
import {usd, usePrices} from "../../usePrices";
import {useLiveBasket} from "../../useLiveBasket";
import ActionPanel from "./ActionPanel";
import RebalancePanel from "./RebalancePanel";
import YourPosition from "./YourPosition";

interface Props {
  basket: `0x${string}`;
  symbol: string;
  quoteToken: `0x${string}`;
  constituents: readonly `0x${string}`[];
  initial: LiveBasket;
  agent: `0x${string}`;
  feeBps: bigint;
  creator?: `0x${string}`;
  zap?: `0x${string}`;
  explorerBase: string;
}

export default function LiveBasketView(props: Props) {
  const {data, pulse, refresh} = useLiveBasket(props.basket, props.initial);
  const {prices, ready: pricesReady} = usePrices(
    props.initial.holdings.map((h) => h.address)
  );
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
      {/*
        What this screen is for: what the basket is worth. That number leads; the rest
        support it. "Symbol" and "each weighted" are gone — the title carries the symbol
        and the holdings table carries the weights.
      */}
      <div className="lead">
        <div className="lead-figure">
          <div className="figure">
            {showUsd ? <AnimatedNumber value={totalValue} decimals={2} prefix="$" /> : "—"}
          </div>
          <div className="figure-label">
            held by the contract, priced through the routes a purchase would use
          </div>
        </div>

        <dl className={`stats ${pulse ? "pulsing" : ""}`}>
          <div className="stat">
            <dt>Value per share</dt>
            <dd>{showUsd ? <AnimatedNumber value={navPerShare} decimals={4} prefix="$" /> : "—"}</dd>
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
            <dt>Holdings</dt>
            <dd>
              <AnimatedNumber value={props.constituents.length} />
            </dd>
          </div>
          <div className="stat">
            <dt>Creator fee</dt>
            <dd>{props.feeBps > 0n ? `${Number(props.feeBps) / 100}%` : "None"}</dd>
          </div>
        </dl>
      </div>

      <div className="trade-row" style={{marginTop: 32}}>
      <section className="section" style={{marginTop: 0}}>
        <ActionPanel
          basket={props.basket}
          symbol={props.symbol}
          quoteToken={props.quoteToken}
          constituents={props.constituents}
          holdings={data.holdings}
          zap={props.zap}
          feeBps={props.feeBps}
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

      <RebalancePanel
        basket={props.basket}
        agent={props.agent}
        tickerFor={Object.fromEntries(
          data.holdings.map((h) => [h.address.toLowerCase(), h.ticker])
        )}
        onRebalanced={() => {
          void refresh();
          setTimeout(() => void refresh(), 3000);
        }}
      />

      <section className="section">
        <div className="section-head">
          <h2>Holdings</h2>
          <span className="note">
            {supply === 0 ? (
              "Nothing bought yet"
            ) : (
              <>
                read from the contract at block{" "}
                <span className="tnum">{Number(data.blockNumber).toLocaleString("en-US")}</span>
              </>
            )}
          </span>
        </div>

        {/*
          One table, not a chart beside a list.
          
          Target is fixed at deployment; actual is what the market has done to it since.
          Drift between them is the whole argument for rebalancing, so it gets its own
          column and the only semantic colour on the page.
        */}
        <div className="board-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Holding</th>
                <th scope="col" className="col-num">Target</th>
                <th scope="col" className="col-num">Actual</th>
                <th scope="col" className="col-num">Drift</th>
                <th scope="col" className="col-num">Per share</th>
                <th scope="col" className="col-num">Held</th>
                <th scope="col" className="col-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {valued.map((holding) => {
                const actual = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
                const drift = actual - weight;
                const driftClass = !showUsd ? "" : drift >= 0 ? "up" : "down";

                return (
                  <tr key={holding.address}>
                    <th scope="row" className="ledger-ticker">
                      {holding.ticker}
                      {holding.price > 0 && (
                        <span className="ledger-price">{usd(holding.price)}</span>
                      )}
                    </th>
                    <td className="col-num">{weight.toFixed(2)}%</td>
                    <td className="col-num">{showUsd ? `${actual.toFixed(2)}%` : "—"}</td>
                    <td className={`col-num drift ${driftClass}`}>
                      {showUsd ? `${drift >= 0 ? "+" : "−"}${Math.abs(drift).toFixed(2)}` : "—"}
                    </td>
                    <td className="col-num mono">
                      {Number(holding.perShare) === 0 ? "—" : Number(holding.perShare).toFixed(9)}
                    </td>
                    <td className="col-num mono">
                      <Flash watch={holding.held}>{Number(holding.held).toFixed(9)}</Flash>
                    </td>
                    <td className="col-num ledger-amount">
                      {holding.value > 0 ? usd(holding.value) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {justMinted && (
          <p className="status done">Updated live — no reload needed.</p>
        )}
      </section>
    </>
  );
}
