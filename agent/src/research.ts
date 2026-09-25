import {deepResearch} from "@thesis/shared/research";

/** Usage: pnpm research "AI infrastructure buildout" */
async function main(): Promise<void> {
  const theme = process.argv.slice(2).join(" ").trim();
  if (!theme) {
    console.error('usage: pnpm research "your investment theme"');
    process.exit(1);
  }

  console.log(`researching "${theme}"…\n`);
  const r = await deepResearch(theme);

  console.log(`basket    ${r.basketName} · THESIS-${r.symbol}`);
  console.log(`searches  ${r.searches} web search${r.searches === 1 ? "" : "es"}`);
  console.log(`models    ${r.models.search} + ${r.models.select}`);
  console.log(`\noutlook   ${r.outlook}`);
  console.log(`risks     ${r.risks}`);
  console.log(`\npicks (${(100 / r.picks.length).toFixed(2)}% each):`);
  for (const p of r.picks) {
    console.log(`  ${p.ticker.padEnd(8)} ${p.name}`);
    console.log(`           ${p.reason}`);
  }
  console.log(`\nsources (${r.sources.length}):`);
  for (const s of r.sources.slice(0, 8)) console.log(`  ${s.title}\n    ${s.url}`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
