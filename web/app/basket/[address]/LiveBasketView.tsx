"use client";

import {useState} from "react";
import type {LiveBasket} from "../../api/basket/route";
import {AnimatedNumber, Bar, Flash, Reveal} from "../../motion";
import {useLiveBasket} from "../../useLiveBasket";
import ActionPanel from "./ActionPanel";

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
  const [justMinted, setJustMinted] = useState(false);

  const supply = Number(data.supply);
  const weight = 100 / props.constituents.length;

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
          <dt>Shares outstanding</dt>
          <dd>
            <Flash watch={data.supply}>
              <AnimatedNumber value={supply} decimals={supply === 0 ? 0 : 3} />
            </Flash>
          </dd>
        </div>
      </dl>

      <section className="section" style={{marginTop: 32}}>
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

      <section className="section">
        <div className="section-head">
          <h2>Holdings</h2>
          <span className="note">
            {supply === 0 ? (
              "Nothing minted yet"
            ) : (
              <>
                Per whole share · block <span className="tnum">{data.blockNumber}</span>
              </>
            )}
          </span>
        </div>

        <div className="card">
          {data.holdings.map((holding, i) => (
            <Reveal key={holding.address} delay={i * 70}>
              <div className="holding">
                <div className="holding-top">
                  <span className="holding-name">{holding.ticker}</span>
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
