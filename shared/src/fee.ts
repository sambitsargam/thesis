/** Basis-point denominator, matching `ThesisBasket.BPS`. */
export const BPS = 10_000n;

/** The contract's own ceiling, mirrored here so a UI can validate before signing. */
export const MAX_FEE_BPS = 100n;

export interface FeeSplit {
  /** What the creator receives. */
  fee: bigint;
  /** What actually buys constituents — the basis for leg sizes and for shares. */
  net: bigint;
}

/**
 * Splits a deposit the way `ThesisBasket.mint` does.
 *
 * This exists in one place on purpose. The contract sizes each swap leg from the
 * net amount, while the venue calldata is fetched off-chain and encodes a fixed
 * amount per leg. If a caller quoted from the gross deposit instead, every leg
 * would ask for more than the contract approved and the mint would revert — so
 * both clients derive their legs from this, with the same integer rounding.
 */
export function splitFee(quoteAmount: bigint, feeBps: bigint): FeeSplit {
  if (feeBps <= 0n) return {fee: 0n, net: quoteAmount};
  const fee = (quoteAmount * feeBps) / BPS; // floors, as Solidity does
  return {fee, net: quoteAmount - fee};
}

/**
 * Sizes each leg exactly as `_buyConstituents` does: equal parts, with the
 * division dust going to the last leg so the whole net amount is deployed.
 */
export function legAmounts(net: bigint, legCount: number): bigint[] {
  const n = BigInt(legCount);
  const perLeg = net / n;
  return Array.from({length: legCount}, (_, i) =>
    i === legCount - 1 ? net - perLeg * (n - 1n) : perLeg
  );
}
