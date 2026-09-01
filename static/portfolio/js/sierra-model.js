/** Mobile-first Sierra Solutions finance model.
 *
 * API:
 *   const controller = mountSierra(host, window.Plotly)
 *   controller.reset() / recompute() / resize() / destroy() / getParams()
 *
 * The parent owns Plotly. No runtime is imported or embedded here.
 */

const ASSET_VERSION = new URL(import.meta.url).searchParams.get("v");
export const SIERRA_STYLESHEET = `/portfolio/css/sierra-model.css${ASSET_VERSION ? `?v=${encodeURIComponent(ASSET_VERSION)}` : ""}`;

const PALETTE = Object.freeze({
  blue: "#1c7ed6",
  green: "#27ae60",
  red: "#c0392b",
  gold: "#f08c00",
  muted: "#6d7d8e",
});

const TURBINE_CONFIGURATION = Object.freeze({
  unitNetPowerMw: 2.25,
  capacityFactor: 0.96,
  redundantUnits: 2,
});

const BASE_PARAMS = Object.freeze({
  cap_rate: 22.5,
  en_rate: 0.055,
  var_om: 17.5,
  waha_price: 1.5,
  henry_price: 6,
  waha_weight: 0.95,
  transport_fee: 0.6,
  capex: 31029075,
  debt_share: 0.65,
  interest_rate: 0.085,
  tax_rate: 0.21,
  dsra: 1355000,
  prop_tax_rate: 0.025,
  tax_decline: 0.05,
  cpi_esc: 1.025,
  ppa_esc: 1.025,
  gas_esc: 1.03,
  labor_esc: 1.03,
  mw_delivered: 15,
  const_years: 1.4976043805612593,
  degradation: 1.005,
  hr: 8.114,
  staff_base: 923000,
  ins_base: 232718.0625,
  adm_base: 75000,
  disc_rate: 0.12,
});

const MACRS_TABLE = Object.freeze([
  0, 0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

const GROUPS = Object.freeze([
  {
    title: "Project inputs",
    open: true,
    fields: [
      field("const_years", "Construction period", 0.1, "years", 0.1, 5),
      fixed("Operation period", "15 years"),
      derived("Delivered power", (p) => `${p.mw_delivered.toFixed(2)} MW`),
      derived("Annual generation", (p) => `${formatNumber(deriveGeneration(p).annualGenerationMwh, 1)} MWh`),
      field("disc_rate", "Discount rate", 0.005, "fraction", 0, 1),
    ],
  },
  {
    title: "Finance model",
    open: true,
    fields: [
      field("debt_share", "Debt share", 0.05, "fraction", 0, 1),
      derived("Equity share", (p) => (1 - p.debt_share).toFixed(3)),
      field("interest_rate", "Loan interest", 0.005, "fraction", 0, 1),
      field("dsra", "Debt-service reserve", 50000, "USD", 0),
      field("capex", "Hard CAPEX", 500000, "USD", 0),
      derived("Initial loan", (p) => formatMoney((p.capex + p.dsra) * p.debt_share)),
      field("prop_tax_rate", "Property-tax rate", 0.005, "fraction", 0, 1),
      field("tax_decline", "Property-tax decline", 0.01, "fraction", 0, 1),
    ],
  },
  {
    title: "Fuel supply and escalation",
    fields: [
      field("waha_price", "Waha gas price", 0.1, "USD/MMBtu", 0),
      field("henry_price", "Henry Hub gas price", 0.1, "USD/MMBtu", 0),
      field("waha_weight", "Waha share", 0.01, "fraction", 0, 1),
      derived("Henry Hub share", (p) => (1 - p.waha_weight).toFixed(2)),
      field("transport_fee", "Transport fee", 0.05, "USD/MMBtu", 0),
      field("cpi_esc", "CPI escalation factor", 0.005, "factor", 0.5, 2),
      field("ppa_esc", "PPA escalation factor", 0.005, "factor", 0.5, 2),
      field("gas_esc", "Gas escalation factor", 0.005, "factor", 0.5, 2),
      field("labor_esc", "Wage escalation factor", 0.005, "factor", 0.5, 2),
    ],
  },
  {
    title: "Revenue and operating cost",
    fields: [
      field("cap_rate", "Capacity rate", 0.5, "USD/kW-month", 0),
      field("en_rate", "Energy rate", 0.005, "USD/kWh", 0),
      field("tax_rate", "Income-tax rate", 0.01, "fraction", 0, 1),
      field("ins_base", "Base insurance", 5000, "USD", 0),
      field("adm_base", "Base administration", 5000, "USD", 0),
      field("staff_base", "Base staffing", 25000, "USD", 0),
      field("var_om", "Variable O&M", 0.5, "USD/MWh", 0),
    ],
  },
  {
    title: "Power generation",
    fields: [
      derived("Active turbines", (p) => String(deriveGeneration(p).activeTurbines)),
      derived("Total turbines (N+2)", (p) => String(deriveGeneration(p).totalTurbines)),
      fixed("Unit net power", "2.25 MW"),
      fixed("Capacity factor", "0.96"),
      field("hr", "Heat rate", 0.1, "MMBtu/MWh", 0),
      field("degradation", "Heat-rate degradation", 0.001, "factor", 0.5, 2),
    ],
  },
]);

let instanceCounter = 0;

function field(key, label, step, unit, min, max) {
  return { type: "input", key, label, step, unit, min, max };
}

function fixed(label, value) {
  return { type: "fixed", label, value };
}

function derived(label, compute) {
  return { type: "derived", label, compute };
}

function formatMoney(value) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value, maximumFractionDigits = 0) {
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

function deriveGeneration(p) {
  const activeTurbines = Math.ceil(p.mw_delivered / TURBINE_CONFIGURATION.unitNetPowerMw);
  return {
    activeTurbines,
    totalTurbines: activeTurbines + TURBINE_CONFIGURATION.redundantUnits,
    annualGenerationMwh: activeTurbines
      * TURBINE_CONFIGURATION.unitNetPowerMw
      * TURBINE_CONFIGURATION.capacityFactor
      * 8760,
  };
}

export function deriveSierraGeneration(p) {
  return deriveGeneration(p);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ppmt(rate, period, periods, principal) {
  if (Math.abs(rate) < 1e-12) return -principal / periods;
  const payment = -rate * principal / (1 - Math.pow(1 + rate, -periods));
  const balanceBeforePeriod = principal * Math.pow(1 + rate, period - 1)
    + payment * (Math.pow(1 + rate, period - 1) - 1) / rate;
  const interestPayment = -balanceBeforePeriod * rate;
  return payment - interestPayment;
}

function irr(cashflows) {
  let rate = 0.1;
  for (let iteration = 0; iteration < 200; iteration += 1) {
    let npv = 0;
    let derivative = 0;
    for (let year = 0; year < cashflows.length; year += 1) {
      npv += cashflows[year] / Math.pow(1 + rate, year);
      if (year > 0) {
        derivative -= year * cashflows[year] / Math.pow(1 + rate, year + 1);
      }
    }
    if (Math.abs(npv) < 1e-9) return rate;
    if (Math.abs(derivative) < 1e-15) return Number.NaN;
    const nextRate = rate - npv / derivative;
    if (Math.abs(nextRate - rate) < 1e-12) return nextRate;
    rate = nextRate < -0.99 ? -0.5 : nextRate;
  }
  return rate;
}

export function runSierraModel(inputParams) {
  const generation = deriveGeneration(inputParams);
  const p = { ...inputParams, gen_mwh: generation.annualGenerationMwh };
  const weightedHub = p.waha_weight * p.waha_price + (1 - p.waha_weight) * p.henry_price;
  const totalUses = p.capex + p.dsra;
  const initialLoanDraw = totalUses * p.debt_share;
  const initialEquity = totalUses * (1 - p.debt_share);
  const firstFullOperationsYear = Math.ceil(p.const_years) + 1;
  const table = [];
  let currentLoanBalance = initialLoanDraw;
  let balloonBalance = 0;

  for (let year = 0; year < 18; year += 1) {
    const rampFactor = year > 0 ? Math.max(0, Math.min(1, year - p.const_years)) : 0;
    const timeIndex = rampFactor > 0
      ? (Math.max(year - 1, p.const_years) + year) / 2
      : 0;
    const energyRevenue = p.gen_mwh * 1000 * p.en_rate * Math.pow(p.gas_esc, timeIndex) * rampFactor;
    const capacityRevenue = p.mw_delivered * 1000 * p.cap_rate * 12
      * Math.pow(p.ppa_esc, timeIndex) * rampFactor;
    const totalRevenue = energyRevenue + capacityRevenue;
    const fuel = p.gen_mwh * p.hr * Math.pow(p.degradation, timeIndex)
      * (weightedHub * Math.pow(p.gas_esc, timeIndex) + p.transport_fee) * rampFactor;
    const variableOperations = p.gen_mwh * p.var_om * Math.pow(p.cpi_esc, timeIndex) * rampFactor;
    const staff = p.staff_base * Math.pow(p.labor_esc, timeIndex) * rampFactor;
    const statutoryOn = year > 0 ? 1 : 0;
    const insurance = rampFactor > 0
      ? p.ins_base * Math.pow(p.cpi_esc, timeIndex)
      : p.ins_base * statutoryOn;
    const administration = rampFactor > 0
      ? p.adm_base * Math.pow(p.cpi_esc, timeIndex)
      : p.adm_base * statutoryOn;
    const propertyTax = p.capex * p.prop_tax_rate
      * Math.pow(1 - p.tax_decline, Math.max(0, year - 2)) * statutoryOn;
    const ebitda = totalRevenue
      - (fuel + variableOperations + staff + insurance + administration + propertyTax);
    const interest = year > 0 ? currentLoanBalance * p.interest_rate : 0;
    const interestDuringConstruction = year > 0 ? interest * (1 - rampFactor) : 0;
    if (year === Math.floor(p.const_years + 1)) {
      balloonBalance = currentLoanBalance + interestDuringConstruction;
    }
    let principalPayment = 0;
    if (year >= firstFullOperationsYear) {
      const amortizationPeriod = year - (firstFullOperationsYear - 1);
      if (amortizationPeriod <= 15) {
        principalPayment = -ppmt(p.interest_rate, amortizationPeriod, 15, balloonBalance);
      }
    }
    const depreciation = year >= 2 ? p.capex * MACRS_TABLE[year - 1] : 0;
    const taxableIncome = ebitda - (interest - interestDuringConstruction) - depreciation;
    const taxPaid = Math.max(0, taxableIncome * p.tax_rate);
    const debtService = principalPayment + interest - interestDuringConstruction;
    const dscr = debtService > 0.001 ? (ebitda - taxPaid) / debtService : null;
    let leveredCashFlow = ebitda - taxPaid - debtService;
    if (year === 0) leveredCashFlow = -initialEquity;
    currentLoanBalance = currentLoanBalance + interestDuringConstruction - principalPayment;
    table.push({
      year,
      revenue: totalRevenue,
      ebitda,
      taxPaid,
      debtService,
      dscr,
      leveredCashFlow,
      loanBalance: currentLoanBalance,
    });
  }

  const cashflows = table.map((row) => row.leveredCashFlow);
  const irrValue = irr(cashflows) * 100;
  let npv = cashflows[0];
  for (let index = 1; index < cashflows.length; index += 1) {
    npv += cashflows[index] / Math.pow(1 + p.disc_rate, index);
  }
  const dscrs = table.map((row) => row.dscr).filter((value) => value !== null);
  return {
    irr: irrValue,
    npv,
    initialEquity,
    minDscr: dscrs.length ? Math.min(...dscrs) : null,
    generation,
    table,
  };
}

function ensureStylesheet() {
  if (document.querySelector('link[href*="/portfolio/css/sierra-model.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = SIERRA_STYLESHEET;
  link.dataset.sierraStylesheet = "";
  document.head.append(link);
}

function fieldMarkup(item, params, prefix) {
  if (item.type === "input") {
    const id = `${prefix}-${item.key}`;
    const min = item.min === undefined ? "" : ` min="${item.min}"`;
    const max = item.max === undefined ? "" : ` max="${item.max}"`;
    return `<div class="sierra-field">
      <label for="${id}">${escapeHtml(item.label)}</label>
      <input id="${id}" name="${item.key}" type="number" inputmode="decimal"
        value="${params[item.key]}" step="any" data-step="${item.step}"${min}${max}
        aria-describedby="${id}-unit">
      <span class="sierra-field__hint" id="${id}-unit">${escapeHtml(item.unit)}</span>
    </div>`;
  }
  const derivedKey = `${prefix}-derived-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const value = item.type === "derived" ? item.compute(params) : item.value;
  return `<div class="sierra-field">
    <span class="sierra-field__label">${escapeHtml(item.label)}</span>
    <output class="sierra-field__value" id="${derivedKey}" data-derived-label="${escapeHtml(item.label)}">${escapeHtml(value)}</output>
  </div>`;
}

function legendMarkup(items) {
  return `<ul class="sierra-chart__legend" aria-label="Chart legend">${items.map((item) =>
    `<li><span class="sierra-chart__swatch" style="--swatch:${item.color}" aria-hidden="true"></span>${escapeHtml(item.label)}</li>`
  ).join("")}</ul>`;
}

function kpiMarkup(className = "sierra-kpis") {
  return `<dl class="${className}" aria-live="polite" aria-atomic="true">
    <div><dt>Project IRR</dt><dd data-sierra-kpi="irr">—</dd></div>
    <div><dt>NPV</dt><dd data-sierra-kpi="npv">—</dd></div>
    <div><dt>Initial equity</dt><dd data-sierra-kpi="equity">—</dd></div>
    <div><dt>Minimum DSCR</dt><dd data-sierra-kpi="dscr">—</dd></div>
  </dl>`;
}

function modelMarkup(params, prefix) {
  return `<section class="sierra-model" aria-labelledby="${prefix}-title">
    <header class="sierra-model__header">
      <div>
        <h4 class="sierra-model__heading" id="${prefix}-title">Sierra Solutions Project Finance Model</h4>
        <p class="sierra-model__intro">The 18-year project cash flow, loan schedule, and investment metrics update together.</p>
      </div>
      <button class="sierra-model__edit" type="button" data-sierra-edit>Edit assumptions</button>
    </header>
    ${kpiMarkup()}
    <div class="sierra-charts">
      <section class="sierra-chart" aria-labelledby="${prefix}-cashflow-title">
        <h5 id="${prefix}-cashflow-title">Annual cash-flow composition</h5>
        ${legendMarkup([
          { label: "EBITDA", color: PALETTE.green },
          { label: "Debt service", color: PALETTE.red },
          { label: "Tax paid", color: PALETTE.gold },
          { label: "Levered cash flow", color: PALETTE.blue },
        ])}
        <div class="sierra-chart__plot" data-sierra-chart="cashflow" aria-label="Annual EBITDA, debt service, tax, and levered cash flow by project year"></div>
        <p class="sierra-chart__summary" data-sierra-summary="cashflow"></p>
      </section>
      <section class="sierra-chart" aria-labelledby="${prefix}-loan-title">
        <h5 id="${prefix}-loan-title">Loan balance over project life</h5>
        ${legendMarkup([{ label: "Outstanding loan", color: PALETTE.green }])}
        <div class="sierra-chart__plot" data-sierra-chart="loan" aria-label="Outstanding loan balance by project year"></div>
        <p class="sierra-chart__summary" data-sierra-summary="loan"></p>
      </section>
    </div>
    <p class="sierra-model__note">Illustrative project-finance model. Results respond to assumptions and are not investment advice.</p>
    <dialog class="sierra-settings" data-sierra-settings aria-labelledby="${prefix}-settings-title">
      <div class="sierra-settings__header">
        <div>
          <h5 id="${prefix}-settings-title">Model assumptions</h5>
          <p>Changes update the live model immediately.</p>
        </div>
        <button class="sierra-settings__close" type="button" data-sierra-close aria-label="Close assumptions">×</button>
      </div>
      <div class="sierra-settings__live">
        ${kpiMarkup("sierra-kpis sierra-kpis--compact")}
      </div>
      <div class="sierra-settings__tabs" role="tablist" aria-label="Assumption category">
        ${GROUPS.map((group, index) => `<button type="button" role="tab" id="${prefix}-tab-${index}" aria-controls="${prefix}-panel-${index}" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}" data-sierra-tab="${index}">${escapeHtml(group.title)}</button>`).join("")}
      </div>
      <form class="sierra-model__parameters" data-sierra-parameters>
        ${GROUPS.map((group, index) => `<section class="sierra-group" role="tabpanel" id="${prefix}-panel-${index}" aria-labelledby="${prefix}-tab-${index}" data-sierra-panel="${index}"${index === 0 ? "" : " hidden"}>
          <div class="sierra-group__fields">
            ${group.fields.map((item) => fieldMarkup(item, params, prefix)).join("")}
          </div>
        </section>`).join("")}
      </form>
      <div class="sierra-settings__actions">
        <button class="sierra-model__reset" type="button" data-sierra-reset>Reset base case</button>
        <button class="sierra-settings__done" type="button" data-sierra-close>Done</button>
      </div>
    </dialog>
  </section>`;
}

function cashflowFigure(table) {
  const years = table.map((row) => row.year);
  const data = [
    { x: years, y: table.map((row) => row.ebitda / 1e6), name: "EBITDA", type: "bar", marker: { color: PALETTE.green }, hovertemplate: "Year %{x}<br>EBITDA $%{y:.2f}M<extra></extra>" },
    { x: years, y: table.map((row) => -row.debtService / 1e6), name: "Debt service", type: "bar", marker: { color: PALETTE.red }, hovertemplate: "Year %{x}<br>Debt service −$%{customdata:.2f}M<extra></extra>", customdata: table.map((row) => row.debtService / 1e6) },
    { x: years, y: table.map((row) => -row.taxPaid / 1e6), name: "Tax paid", type: "bar", marker: { color: PALETTE.gold }, hovertemplate: "Year %{x}<br>Tax paid −$%{customdata:.2f}M<extra></extra>", customdata: table.map((row) => row.taxPaid / 1e6) },
    { x: years, y: table.map((row) => row.leveredCashFlow / 1e6), name: "Levered cash flow", type: "scatter", mode: "lines+markers", line: { color: PALETTE.blue, width: 2.5 }, marker: { size: 6 }, hovertemplate: "Year %{x}<br>Levered cash flow $%{y:.2f}M<extra></extra>" },
  ];
  return { data, layout: chartLayout({ barmode: "relative", yTitle: "USD (millions)" }) };
}

function loanFigure(table) {
  const data = [{
    x: table.map((row) => row.year),
    y: table.map((row) => row.loanBalance / 1e6),
    type: "scatter",
    mode: "lines",
    fill: "tozeroy",
    line: { color: PALETTE.green, width: 2 },
    fillcolor: "rgba(47,125,74,0.2)",
    name: "Loan balance",
    hovertemplate: "Year %{x}<br>Outstanding $%{y:.2f}M<extra></extra>",
  }];
  return { data, layout: chartLayout({ yTitle: "Outstanding (USD millions)", rangemode: "tozero" }) };
}

function chartLayout({ barmode, yTitle, rangemode }) {
  return {
    template: "plotly_white",
    autosize: true,
    showlegend: false,
    ...(barmode ? { barmode } : {}),
    margin: { l: 50, r: 10, t: 8, b: 48 },
    xaxis: { title: { text: "Project year", font: { size: 11 } }, tickfont: { size: 10 }, automargin: true, fixedrange: true },
    yaxis: { title: { text: yTitle, font: { size: 11 } }, tickfont: { size: 10 }, automargin: true, zeroline: true, zerolinecolor: PALETTE.muted, ...(rangemode ? { rangemode } : {}) },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    transition: { duration: 0 },
  };
}

const PLOT_CONFIG = Object.freeze({
  responsive: true,
  displayModeBar: false,
  displaylogo: false,
  scrollZoom: false,
});

function setKpi(host, key, text, tone = "") {
  for (const output of host.querySelectorAll(`[data-sierra-kpi="${key}"]`)) {
    output.textContent = text;
    if (tone) output.dataset.tone = tone;
    else delete output.dataset.tone;
  }
}

function updateDerived(host, params) {
  for (const item of GROUPS.flatMap((group) => group.fields)) {
    if (item.type !== "derived") continue;
    const output = [...host.querySelectorAll("[data-derived-label]")]
      .find((candidate) => candidate.dataset.derivedLabel === item.label);
    if (output) output.value = item.compute(params);
  }
}

/** Mount the responsive model into `[data-sierra-demo]` or any empty host. */
export function mountSierra(host, Plotly = globalThis.Plotly) {
  if (!(host instanceof HTMLElement)) {
    throw new TypeError("mountSierra requires an HTMLElement host.");
  }
  ensureStylesheet();
  const prefix = `sierra-${++instanceCounter}`;
  let params = { ...BASE_PARAMS };
  let destroyed = false;
  let updateFrame = 0;
  let plotsReady = false;
  let renderGeneration = 0;
  let renderSequence = Promise.resolve();
  const canPlot = Boolean(Plotly && typeof Plotly.newPlot === "function");

  host.innerHTML = modelMarkup(params, prefix);
  const form = host.querySelector("[data-sierra-parameters]");
  const resetButton = host.querySelector("[data-sierra-reset]");
  const editButton = host.querySelector("[data-sierra-edit]");
  const settings = host.querySelector("[data-sierra-settings]");
  const closeButtons = [...host.querySelectorAll("[data-sierra-close]")];
  const tabButtons = [...host.querySelectorAll("[data-sierra-tab]")];
  const panels = [...host.querySelectorAll("[data-sierra-panel]")];
  const cashflowHost = host.querySelector('[data-sierra-chart="cashflow"]');
  const loanHost = host.querySelector('[data-sierra-chart="loan"]');

  function selectTab(index, { focus = false } = {}) {
    tabButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      panels[buttonIndex].hidden = !active;
    });
    if (focus) tabButtons[index]?.focus();
  }

  function openSettings() {
    if (!settings.open) settings.showModal();
    tabButtons.find((button) => button.getAttribute("aria-selected") === "true")?.focus();
  }

  function closeSettings() {
    if (settings.open) settings.close();
    editButton.focus();
  }

  function onTabClick(event) {
    const button = event.target.closest("[data-sierra-tab]");
    if (button) selectTab(Number(button.dataset.sierraTab));
  }

  function onTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = tabButtons.indexOf(event.target);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? tabButtons.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length;
    selectTab(next, { focus: true });
  }

  async function renderChartsNow(result) {
    const figures = [cashflowFigure(result.table), loanFigure(result.table)];
    const plotHosts = [cashflowHost, loanHost];
    if (!canPlot) {
      for (const plotHost of plotHosts) {
        plotHost.className = "sierra-chart__error";
        plotHost.textContent = "Interactive charts are unavailable, but all calculated metrics remain visible.";
      }
      return;
    }
    try {
      for (let index = 0; index < plotHosts.length; index += 1) {
        if (plotsReady) {
          await Plotly.react(plotHosts[index], figures[index].data, figures[index].layout, PLOT_CONFIG);
        } else {
          await Plotly.newPlot(plotHosts[index], figures[index].data, figures[index].layout, PLOT_CONFIG);
        }
      }
      plotsReady = true;
    } catch (error) {
      console.error("Sierra chart rendering failed", error);
      for (const plotHost of plotHosts) {
        if (!plotHost.data) {
          plotHost.className = "sierra-chart__error";
          plotHost.textContent = "The chart could not be rendered. Calculated metrics remain available above.";
        }
      }
    }
  }

  function renderCharts(result) {
    const generation = ++renderGeneration;
    renderSequence = renderSequence.then(() => {
      if (destroyed || generation !== renderGeneration) return undefined;
      return renderChartsNow(result);
    });
    return renderSequence;
  }

  function recompute() {
    if (destroyed) return null;
    const result = runSierraModel(params);
    setKpi(host, "irr", Number.isFinite(result.irr) ? `${result.irr.toFixed(2)}%` : "n/a", result.irr >= 12 ? "good" : result.irr < 0 ? "bad" : "");
    setKpi(host, "npv", `${result.npv < 0 ? "−" : ""}${formatMoney(Math.abs(result.npv))}`, result.npv >= 0 ? "good" : "bad");
    setKpi(host, "equity", formatMoney(result.initialEquity));
    setKpi(host, "dscr", result.minDscr === null || !Number.isFinite(result.minDscr) ? "n/a" : `${result.minDscr.toFixed(2)}×`, result.minDscr >= 1.2 ? "good" : result.minDscr < 1 ? "bad" : "");
    updateDerived(host, params);

    const positiveCashflows = result.table.filter((row) => row.leveredCashFlow > 0).length;
    host.querySelector('[data-sierra-summary="cashflow"]').textContent =
      `${positiveCashflows} of ${result.table.length} modeled years have positive levered cash flow; project IRR is ${Number.isFinite(result.irr) ? `${result.irr.toFixed(2)}%` : "not available"}.`;
    const peakLoan = Math.max(...result.table.map((row) => row.loanBalance));
    const endingLoan = result.table.at(-1).loanBalance;
    host.querySelector('[data-sierra-summary="loan"]').textContent =
      `Peak modeled loan balance is ${formatMoney(peakLoan)}; ending balance is ${formatMoney(Math.max(0, endingLoan))}.`;

    void renderCharts(result);
    host.dispatchEvent(new CustomEvent("sierra:model-change", {
      bubbles: true,
      detail: { params: { ...params }, result },
    }));
    return result;
  }

  function scheduleRecompute() {
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(recompute);
  }

  function onInput(event) {
    const input = event.target.closest("input[name]");
    if (!input || !form.contains(input) || !input.validity.valid || input.value === "") return;
    const value = Number.parseFloat(input.value);
    if (!Number.isFinite(value)) return;
    params[input.name] = value;
    scheduleRecompute();
  }

  function reset() {
    params = { ...BASE_PARAMS };
    for (const input of form.querySelectorAll("input[name]")) {
      input.value = params[input.name];
    }
    return recompute();
  }

  function resize() {
    if (!canPlot || !plotsReady) return;
    Plotly.Plots.resize(cashflowHost);
    Plotly.Plots.resize(loanHost);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    renderGeneration += 1;
    cancelAnimationFrame(updateFrame);
    form.removeEventListener("input", onInput);
    resetButton.removeEventListener("click", reset);
    editButton.removeEventListener("click", openSettings);
    tabButtons.forEach((button) => {
      button.removeEventListener("click", onTabClick);
      button.removeEventListener("keydown", onTabKeydown);
    });
    closeButtons.forEach((button) => button.removeEventListener("click", closeSettings));
    resizeObserver?.disconnect();
    if (canPlot && plotsReady) {
      Plotly.purge(cashflowHost);
      Plotly.purge(loanHost);
    }
    host.replaceChildren();
  }

  form.addEventListener("input", onInput);
  resetButton.addEventListener("click", reset);
  editButton.addEventListener("click", openSettings);
  tabButtons.forEach((button) => {
    button.addEventListener("click", onTabClick);
    button.addEventListener("keydown", onTabKeydown);
  });
  closeButtons.forEach((button) => button.addEventListener("click", closeSettings));
  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(() => resize())
    : null;
  resizeObserver?.observe(host);
  recompute();

  return {
    reset,
    recompute,
    resize,
    destroy,
    getParams: () => ({ ...params, ...deriveGeneration(params) }),
  };
}

export const mountSierraModel = mountSierra;
export { BASE_PARAMS as SIERRA_BASE_PARAMS };
