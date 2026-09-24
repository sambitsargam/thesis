import {resolveTheme} from "@thesis/shared/ai";

/**
 * Resolves a plain-language theme into tokenized equities.
 *
 * Usage: pnpm resolve "semiconductor supply chain"
 */
async function main(): Promise<void> {
  const themes = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (themes.length === 0) {
    console.error('usage: pnpm resolve "your investment theme"');
    process.exit(1);
  }

  for (const theme of themes) {
    const result = await resolveTheme(theme);
    console.log(`\n"${theme}"`);
    console.log(`  basket    ${result.name} · THESIS-${result.symbol}`);
    console.log(`  model     ${result.model}`);
    console.log(`  picks     ${result.tickers.join(", ")}`);
    console.log(`  weight    ${(100 / result.constituents.length).toFixed(2)}% each`);
    console.log(`  rationale ${result.rationale}`);
    for (const c of result.constituents) {
      console.log(`            ${c.ticker.padEnd(8)} ${c.address}  ${c.name}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
