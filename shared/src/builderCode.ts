import type {Hex} from "viem";

/**
 * Appends an ERC-8021 builder code to transaction calldata.
 *
 * The suffix sits after the ABI-encoded arguments. Solidity's decoder ignores
 * trailing bytes, so the call behaves identically while the code stays visible
 * on chain — proven by `test_MintAcceptsTrailingBuilderCodeCalldata`.
 */
export function appendBuilderCode(data: Hex, builderCode: string | undefined): Hex {
  if (!builderCode) return data;

  const suffix = builderCode.startsWith("0x") ? builderCode.slice(2) : builderCode;
  if (suffix.length === 0) return data;
  if (!/^[0-9a-fA-F]+$/.test(suffix) || suffix.length % 2 !== 0) {
    throw new Error(`BUILDER_CODE must be an even-length hex string, got "${builderCode}"`);
  }

  return `${data}${suffix.toLowerCase()}` as Hex;
}
