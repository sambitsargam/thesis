"use client";

import {useRef, useState} from "react";

export interface Reserve {
  ticker: string;
  token: string;
  /** Balance in the token's own base units, exactly as the chain returns it. */
  raw: string;
  /** The same number, scaled to whole tokens. */
  amount: string;
}

interface Props {
  basket: string;
  symbol: string;
  reserves: Reserve[];
  blockNumber: string;
  rpcUrl: string;
  explorerBase: string;
}

/**
 * Copies text, falling back to a selection-based copy.
 *
 * `navigator.clipboard` needs a secure context and permission, and throws in enough
 * browsers that a verification affordance cannot depend on it alone.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(field);
      return ok;
    } catch {
      return false;
    }
  }
}

type CopyState = "idle" | "copied" | "selected";

function Copyable({label, command}: {label: string; command: string}) {
  const [state, setState] = useState<CopyState>("idle");
  const code = useRef<HTMLPreElement>(null);

  /** Selects the command, so a blocked clipboard still leaves something to press ⌘C on. */
  function selectCommand() {
    const node = code.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  return (
    <div className="verify">
      <div className="verify-head">
        <span>{label}</span>
        <button
          className="ghost small"
          onClick={async () => {
            if (await copyText(command)) {
              setState("copied");
              setTimeout(() => setState("idle"), 1800);
              return;
            }
            // Never fail silently: the point of this block is that you can run it.
            selectCommand();
            setState("selected");
          }}
        >
          {state === "copied" ? "Copied" : state === "selected" ? "Press ⌘C" : "Copy"}
        </button>
      </div>
      <pre className="verify-code" ref={code}>
        {command}
      </pre>
    </div>
  );
}

/**
 * The basket's actual token balances, and how to check them without trusting this page.
 *
 * Thesis holds the real equities, so the balances are the proof — there is no published
 * NAV to believe and no oracle in the path. Everything here is a plain `balanceOf` that
 * anyone can repeat against a public node and get the same answer.
 */
export default function ProofOfReserve(props: Props) {
  const first = props.reserves[0];

  return (
    <section className="section">
      <div className="section-head">
        <h2>Proof of reserve</h2>
        <span className="note">
          Read at block <span className="tnum">{props.blockNumber}</span>
        </span>
      </div>

      <div className="card">
        <p className="card-theme" style={{marginBottom: 16}}>
          Every {props.symbol} share is a claim on the tokens below, held by the basket
          contract itself. These are balances, not valuations: no oracle, no price feed and
          no number we publish stands between you and the holdings.
        </p>

        {props.reserves.map((reserve) => (
          <div className="reserve" key={reserve.token}>
            <div className="reserve-head">
              <span className="reserve-ticker">{reserve.ticker}</span>
              <span className="tnum reserve-amount">{Number(reserve.amount).toFixed(9)}</span>
            </div>
            <div className="reserve-foot">
              <a className="mono link" href={`${props.explorerBase}token/${reserve.token}`}>
                {reserve.token}
              </a>
              {/* Base units as well: the scaled figure above is this number, divided. */}
              <span className="mono tnum reserve-raw">{reserve.raw}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginTop: 12}}>
        <div className="row">
          <span>Verify this yourself</span>
          <a className="link" href={`${props.explorerBase}address/${props.basket}`}>
            Open the basket on OKLink →
          </a>
        </div>

        {/*
          Folded away by default. The commands are the point of this panel, but most
          people will check the balances on the explorer, and an open block of shell
          sits heavily on the page for the few who want it.
        */}
        <details className="verify-details">
          <summary>Or read it from a node yourself</summary>

          {first && (
            <Copyable
              label={`What the basket holds of ${first.ticker}`}
              command={`cast call ${first.token} "balanceOf(address)(uint256)" ${props.basket} --rpc-url ${props.rpcUrl}`}
            />
          )}

          <Copyable
            label="Every constituent it is supposed to hold"
            command={`cast call ${props.basket} "constituents()(address[])" --rpc-url ${props.rpcUrl}`}
          />
        </details>
      </div>

      <div className="card" style={{marginTop: 12}}>
        <div className="row">
          <span>Why this matters</span>
          <span>
            A Thesis basket is a plain ERC-20 whose backing is readable on chain. Any
            lending market on X Layer can price it as collateral without integrating with
            us, and without taking our word for what it holds.
          </span>
        </div>
      </div>
    </section>
  );
}
