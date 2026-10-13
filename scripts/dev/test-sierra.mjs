import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modulePath = new URL("../../static/portfolio/js/sierra-model.js", import.meta.url);
const source = await readFile(modulePath, "utf8");
assert.match(
  source,
  /value="\$\{params\[item\.key\]\}" step="\$\{item\.step\}"/,
  "assumption inputs use their configured spinner increments",
);
assert.doesNotMatch(source, /step="any"/, "assumption inputs do not use the browser's fallback increment");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const {
  SIERRA_BASE_PARAMS,
  deriveSierraGeneration,
  runSierraModel,
} = await import(moduleUrl);

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`,
  );
};

const generation = deriveSierraGeneration(SIERRA_BASE_PARAMS);
assert.equal(generation.activeTurbines, 7, "active turbine count");
assert.equal(generation.totalTurbines, 9, "N+2 turbine count");
closeTo(generation.annualGenerationMwh, 132451.2, 1e-6, "annual generation (MWh)");

const result = runSierraModel(SIERRA_BASE_PARAMS);
closeTo(result.irr, 19.980012741977024, 1e-6, "equity IRR (%)");
closeTo(result.npv, 6922771.70877206, 0.01, "project NPV (USD)");
closeTo(result.initialEquity, 8209972.030942527, 0.01, "initial equity (USD)");
closeTo(result.minDscr, 1.5026226224522428, 1e-9, "minimum DSCR");
closeTo(result.dsra, 1810813.123770105, 0.01, "DSRA, 6 months of debt service (USD)");

console.log(
  `Sierra parity passed: ${generation.activeTurbines} active / ${generation.totalTurbines} total turbines, `
  + `${generation.annualGenerationMwh.toFixed(1)} MWh, ${result.irr.toFixed(2)}% IRR, `
  + `$${result.npv.toFixed(2)} NPV.`,
);
