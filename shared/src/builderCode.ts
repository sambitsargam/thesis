import {Attribution} from "ox/erc8021";
import type {Hex} from "viem";

/**
 * Builds the ERC-8021 data suffix for an X Layer Builder Code.
 *
 * X Layer Builder Codes are 16-character identifiers minted as ERC-721s in the
 * registry at 0xd6c426f9c077358735622ae5a83468dc0510823b. The suffix is produced
 * by `ox`, the library OKX documents for this, rather than hand-assembled: the
 * format carries a 16-byte marker and is parsed backwards, so an approximation
 * would sit on chain looking valid while no indexer ever detected it.
 *
 * Pass the result as `dataSuffix` on a viem wallet client and every transaction
 * that client sends carries attribution — approvals included — with no per-call
 * bookkeeping. Costs 16 gas per non-zero byte and never reaches contract logic.
 *
 * @param builderCode The code from the OKX developer portal, or undefined to opt out.
 * @returns The suffix, or undefined when no code is configured.
 */
export function builderCodeSuffix(builderCode: string | undefined): Hex | undefined {
  const code = builderCode?.trim();
  if (!code) return undefined;
  return Attribution.toDataSuffix({codes: [code]}) as Hex;
}
