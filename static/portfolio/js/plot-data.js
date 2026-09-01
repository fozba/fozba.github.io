/**
 * Data adapter for portfolio v2 visualizations.
 *
 * Plotly is intentionally injected by the parent page.  This module contains
 * no runtime copy and performs no global network requests of its own.
 */

const DATA_ROOT = "/portfolio/data";
const ASSET_VERSION = new URL(import.meta.url).searchParams.get("v");
const versionedDataUrl = (id) =>
  `${DATA_ROOT}/${id}.json${ASSET_VERSION ? `?v=${encodeURIComponent(ASSET_VERSION)}` : ""}`;
const SUPPORTED_IDS = new Set([
  "basin",
  "nevada",
  "forge",
  "monte-carlo",
  "tornado",
]);

const typedArrayCache = new WeakMap();

const ARRAY_TYPES = {
  f4: Float32Array,
  f8: Float64Array,
  i1: Int8Array,
  i2: Int16Array,
  i4: Int32Array,
  u1: Uint8Array,
  u2: Uint16Array,
  u4: Uint32Array,
};

function assertPlotly(Plotly) {
  if (!Plotly || typeof Plotly.newPlot !== "function") {
    throw new TypeError("A shared Plotly runtime must be passed by the parent page.");
  }
}

function isPackedArray(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.dtype === "string" &&
    typeof value.bdata === "string"
  );
}

export function decodePackedArray(packed) {
  if (!isPackedArray(packed)) return packed;
  if (typedArrayCache.has(packed)) return typedArrayCache.get(packed);

  const Type = ARRAY_TYPES[packed.dtype];
  if (!Type) throw new TypeError(`Unsupported packed Plotly dtype: ${packed.dtype}`);

  const binary = atob(packed.bdata);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const typed = new Type(bytes.buffer);
  typedArrayCache.set(packed, typed);
  return typed;
}

function decodeDeep(value) {
  if (isPackedArray(value)) return decodePackedArray(value);
  if (Array.isArray(value)) return value.map(decodeDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decodeDeep(item)])
    );
  }
  return value;
}

export async function loadPlotSpec(id, { signal } = {}) {
  if (!SUPPORTED_IDS.has(id)) {
    throw new RangeError(`Unknown portfolio plot: ${id}`);
  }
  const response = await fetch(versionedDataUrl(id), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Unable to load ${id} plot data (${response.status}).`);
  }
  const spec = await response.json();
  if (spec.schemaVersion !== 1) {
    throw new Error(`Unsupported ${id} plot schema: ${spec.schemaVersion}`);
  }
  return spec;
}

function findMapLayer(spec, layerId) {
  const requested = layerId || spec.defaultLayer;
  const layer = spec.layers.find((candidate) => candidate.id === requested);
  if (!layer) throw new RangeError(`Unknown ${spec.id} layer: ${requested}`);
  return layer;
}

function createNevadaTrace(spec, layer) {
  const [cmin, cmax] = layer.range;
  const signedDifference = cmin < 0 && cmax > 0;
  return {
    ...decodeDeep(spec.traceDefaults),
    name: layer.label,
    lon: decodePackedArray(spec.coordinates.lon),
    lat: decodePackedArray(spec.coordinates.lat),
    marker: {
      ...decodeDeep(spec.traceDefaults.marker),
      color: decodePackedArray(layer.values),
      colorscale: layer.colorscale,
      cmin,
      cmax,
      ...(signedDifference ? { cmid: 0 } : {}),
      colorbar: {
        title: { text: layer.colorbarTitle, side: "right", font: { size: 11 } },
        thickness: 13,
        len: 0.62,
        x: 0.97,
        tickfont: { size: 10 },
        outlinewidth: 0,
        bgcolor: "rgba(255,255,255,0.82)",
      },
    },
    hovertemplate:
      `<b>${layer.valueLabel}</b>: %{marker.color:.3f}<br>` +
      "Latitude %{lat:.4f}°<br>Longitude %{lon:.4f}°<extra></extra>",
  };
}

/**
 * Convert a compact spec into Plotly's `{data, layout, config}` contract.
 * Nevada intentionally materializes one active geographic layer rather than uploading
 * three identical coordinate grids to the browser/GPU.
 */
export function createPlotFigure(spec, { layerId, viewportWidth } = {}) {
  if (!spec || spec.schemaVersion !== 1) {
    throw new TypeError("A schemaVersion 1 plot spec is required.");
  }

  if (spec.kind === "shared-coordinate-map-layers") {
    const layer = findMapLayer(spec, layerId);
    const trace = createNevadaTrace(spec, layer);
    const layout = decodeDeep(spec.layout);
    if (viewportWidth && viewportWidth < 600) {
      layout.map = { ...layout.map, zoom: 6 };
      trace.marker.colorbar = {
        ...trace.marker.colorbar,
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: 0.14,
        yanchor: "bottom",
        len: 0.62,
        thickness: 11,
        title: { text: "" },
      };
    }
    return {
      data: [trace],
      layout,
      config: decodeDeep(spec.config),
      activeLayer: layer.id,
    };
  }

  if (spec.kind !== "plotly") {
    throw new TypeError(`Unsupported plot kind: ${spec.kind}`);
  }
  return {
    data: decodeDeep(spec.traces),
    layout: decodeDeep(spec.layout),
    config: decodeDeep(spec.config),
  };
}

export async function renderPlot(host, spec, Plotly, { layerId } = {}) {
  assertPlotly(Plotly);
  if (!(host instanceof HTMLElement)) {
    throw new TypeError("renderPlot requires an HTMLElement host.");
  }
  const figure = createPlotFigure(spec, { layerId, viewportWidth: host.clientWidth });
  host.setAttribute("aria-label", spec.description);
  host.dataset.plotId = spec.id;
  if (figure.activeLayer) host.dataset.activeLayer = figure.activeLayer;
  await Plotly.newPlot(host, figure.data, figure.layout, figure.config);
  return host;
}

/** Replace Nevada's one active data layer while preserving the geographic viewport. */
export async function setMapLayer(host, spec, layerId, Plotly) {
  assertPlotly(Plotly);
  if (spec.kind !== "shared-coordinate-map-layers") {
    throw new TypeError(`${spec.id} does not expose map layers.`);
  }
  const figure = createPlotFigure(spec, { layerId, viewportWidth: host.clientWidth });
  host.dataset.activeLayer = figure.activeLayer;
  await Plotly.react(host, figure.data, figure.layout, figure.config);
  return figure.activeLayer;
}

export async function setTraceVisibility(host, traceIndex, visible, Plotly) {
  assertPlotly(Plotly);
  await Plotly.restyle(host, { visible: Boolean(visible) }, [traceIndex]);
}

export function resizePlot(host, Plotly) {
  assertPlotly(Plotly);
  if (host && host.data) Plotly.Plots.resize(host);
}

export function destroyPlot(host, Plotly) {
  assertPlotly(Plotly);
  if (host && host.data) Plotly.purge(host);
}
