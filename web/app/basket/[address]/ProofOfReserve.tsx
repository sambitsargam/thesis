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
          read at block <span className="tnum">{Number(props.blockNumber).toLocaleString("en-US")}</span>
        </span>
      </div>

      <p className="claim">
        The holdings above are not a report of what this basket owns. They are its token
        balances, read from the chain — no valuation we publish, no oracle in the path.
        Here is the same thing in base units, and how to read it back yourself.
      </p>

      <div className="board-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">Holding</th>
              <th scope="col" className="col-num">Balance in base units</th>
              <th scope="col">Token contract</th>
            </tr>
          </thead>
          <tbody>
            {props.reserves.map((reserve) => (
              <tr key={reserve.token}>
                <th scope="row" className="ledger-ticker">
                  {reserve.ticker}
                </th>
                {/* Exactly what `balanceOf` returns. The whole-token figure in the
                    holdings table above is this number, divided. */}
                <td className="col-num mono">{reserve.raw}</td>
                <td>
                  <a className="mono link" href={`${props.explorerBase}token/${reserve.token}`}>
                    {reserve.token.slice(0, 10)}…{reserve.token.slice(-6)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="verify">
        <div className="verify-head">
          <span>Check it against the chain</span>
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

      <p className="claim-foot">
        Because the backing is readable on chain, a Thesis basket can be priced as
        collateral by any lending market on X Layer — with no integration on either side,
        and nobody taking our word for what it holds.
      </p>
    </section>
  );
}
