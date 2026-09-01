#!/usr/bin/env python3
"""Build compact, mobile-oriented Plotly data for the portfolio.

The current site exports are the canonical visual inputs.  This script extracts
their Plotly arguments, removes generated defaults and duplicated presentation
data, and writes small data-only JSON files.  Plotly itself is deliberately not
embedded in any generated asset: portfolio v2 supplies one shared runtime.

Only display precision is changed.  Packed float64 arrays become float32, which
retains sub-metre map precision and far more precision than a rendered pixel for
the engineering plots.  FORGE's two interpolated well-path lines are uniformly
sampled for display; all stage boundaries and microseismic events are retained.
"""

from __future__ import annotations

import base64
import gzip
import html
import io
import json
import math
from pathlib import Path
from typing import Any, Iterable

import numpy as np


REPO = Path(__file__).resolve().parents[2]
SOURCE_EXPORTS = REPO / "scripts" / "portfolio" / "source_exports"
OUTPUT = REPO / "static" / "portfolio"
DATA = OUTPUT / "data"
POSTERS = OUTPUT / "posters"
FALLBACKS = OUTPUT / "fallbacks"

SOURCES = {
    "basin": SOURCE_EXPORTS / "components" / "basin_plot.html",
    "nevada": SOURCE_EXPORTS / "components" / "cnn_map.html",
    "forge": SOURCE_EXPORTS / "components" / "forge_3d_plot.html",
    "monte_carlo": SOURCE_EXPORTS / "assets" / "monte_carlo_bell_curve.html",
    "tornado": SOURCE_EXPORTS / "assets" / "tornado_chart.html",
    "sierra": SOURCE_EXPORTS / "components" / "sierra_model.html",
}

FLOAT_DTYPES = {"f8": "<f8", "f4": "<f4"}
INTEGER_DTYPES = {
    "i1": "<i1",
    "i2": "<i2",
    "i4": "<i4",
    "i8": "<i8",
    "u1": "<u1",
    "u2": "<u2",
    "u4": "<u4",
    "u8": "<u8",
}
DTYPES = {**FLOAT_DTYPES, **INTEGER_DTYPES}

PALETTE = {
    "blue": "#1c7ed6",
    "green": "#27ae60",
    "red": "#c0392b",
    "gold": "#f08c00",
}


def extract_plotly_call(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    """Read the final Plotly.newPlot call from a generated HTML export."""

    source = path.read_text(encoding="utf-8", errors="replace")
    call_at = source.rfind("Plotly.newPlot(")
    if call_at < 0:
        raise ValueError(f"No Plotly.newPlot call found in {path}")

    decoder = json.JSONDecoder()
    cursor = source.find(",", call_at) + 1  # skip graph div id
    cursor = skip_json_separator(source, cursor, allow_comma=False)
    traces, cursor = decoder.raw_decode(source, cursor)
    cursor = skip_json_separator(source, cursor)
    layout, cursor = decoder.raw_decode(source, cursor)
    cursor = skip_json_separator(source, cursor)
    config, _ = decoder.raw_decode(source, cursor)
    return traces, layout, config


def skip_json_separator(source: str, cursor: int, *, allow_comma: bool = True) -> int:
    while cursor < len(source):
        char = source[cursor]
        if char.isspace() or (allow_comma and char == ","):
            cursor += 1
            continue
        break
    return cursor


def unpack(packed: dict[str, str]) -> np.ndarray:
    dtype_name = packed["dtype"]
    if dtype_name not in DTYPES:
        raise ValueError(f"Unsupported Plotly dtype {dtype_name!r}")
    raw = base64.b64decode(packed["bdata"])
    return np.frombuffer(raw, dtype=np.dtype(DTYPES[dtype_name]))


def pack(values: Iterable[float] | np.ndarray, dtype_name: str = "f4") -> dict[str, str]:
    values_array = np.asarray(values, dtype=np.dtype(DTYPES[dtype_name]))
    return {
        "dtype": dtype_name,
        "bdata": base64.b64encode(values_array.tobytes(order="C")).decode("ascii"),
    }


def compact_packed_arrays(value: Any, precision: list[dict[str, float]]) -> Any:
    """Recursively convert Plotly float64 binary arrays to float32."""

    if isinstance(value, dict):
        if set(value) >= {"dtype", "bdata"} and value["dtype"] in DTYPES:
            array = unpack(value)
            if value["dtype"] == "f8":
                compact = array.astype("<f4")
                finite = np.isfinite(array)
                error = float(np.max(np.abs(array[finite] - compact[finite]))) if finite.any() else 0.0
                precision.append({"count": int(array.size), "max_abs_error": error})
                return pack(compact, "f4")
            return value
        return {key: compact_packed_arrays(item, precision) for key, item in value.items()}
    if isinstance(value, list):
        return [compact_packed_arrays(item, precision) for item in value]
    return value


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json_bytes(value))


def base_config() -> dict[str, Any]:
    return {
        "responsive": True,
        "displaylogo": False,
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": "reset+autosize",
    }


def formation_control(trace_names: list[str]) -> dict[str, Any]:
    return {
        "kind": "multi-toggle-search",
        "label": "Visible formations",
        "searchLabel": "Find a formation",
        "actions": ["show-all", "hide-all"],
        "defaultVisible": "all",
        "items": [
            {"traceIndex": index, "label": name}
            for index, name in enumerate(trace_names)
        ],
    }


def build_basin() -> tuple[dict[str, Any], dict[str, Any]]:
    traces, old_layout, _ = extract_plotly_call(SOURCES["basin"])
    precision: list[dict[str, float]] = []
    traces = compact_packed_arrays(traces, precision)

    for trace in traces:
        trace["showlegend"] = False
        trace["hovertemplate"] = (
            "<b>%{fullData.name}</b><br>"
            "Longitude %{x:.4f}°<br>Latitude %{y:.4f}°<br>"
            "TVD %{z:,.0f} ft<extra></extra>"
        )

    scene = old_layout["scene"]
    for axis_name in ("xaxis", "yaxis", "zaxis"):
        scene[axis_name]["showspikes"] = False
        scene[axis_name]["tickfont"] = {"size": 10}
        scene[axis_name]["title"]["font"] = {"size": 11}

    layout = {
        "template": "plotly_white",
        "autosize": True,
        "showlegend": False,
        "uirevision": "basin-v2",
        "margin": {"l": 0, "r": 0, "b": 0, "t": 4},
        "scene": scene,
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(0,0,0,0)",
    }

    names = [trace["name"] for trace in traces]
    output = {
        "schemaVersion": 1,
        "id": "basin",
        "kind": "plotly",
        "title": "Delaware Basin formation tops",
        "description": (
            "Three-dimensional well-top observations for 45 named formations; "
            "true vertical depth increases downward."
        ),
        "traces": traces,
        "layout": layout,
        "config": base_config(),
        "controls": formation_control(names),
        "mobile": {"minHeight": 430, "preferredHeight": 560, "fullscreen": True},
        "fallback": {
            "poster": "/portfolio/posters/basin.webp",
            "summary": "/portfolio/fallbacks/basin-summary.html",
        },
    }
    audit = {
        "trace_count": len(traces),
        "point_count": sum(packed_length(trace["x"]) for trace in traces),
        "float32_max_abs_error": max(item["max_abs_error"] for item in precision),
    }
    return output, audit


def packed_length(packed_value: dict[str, str]) -> int:
    return int(unpack(packed_value).size)


def downsample_trace(trace: dict[str, Any], maximum: int) -> tuple[dict[str, Any], int, int]:
    """Uniformly sample a smoothly interpolated 3D line, keeping both ends."""

    x = unpack(trace["x"])
    count_before = int(x.size)
    if count_before <= maximum:
        return trace, count_before, count_before

    indexes = np.unique(np.linspace(0, count_before - 1, maximum, dtype=np.int64))
    for key in ("x", "y", "z"):
        trace[key] = pack(unpack(trace[key])[indexes], "f4")
    # Some generated line traces carry point-wise text; retain matching entries.
    if isinstance(trace.get("text"), list) and len(trace["text"]) == count_before:
        trace["text"] = [trace["text"][int(index)] for index in indexes]
    return trace, count_before, int(indexes.size)


def forge_control_groups(traces: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups = [
        ("wells", "Well paths", range(0, 2)),
        ("stages", "Well stages", range(2, 15)),
        ("events", "Microseismic stages", range(15, len(traces))),
    ]
    return [
        {
            "id": group_id,
            "label": label,
            "defaultVisible": True,
            "items": [
                {"traceIndex": index, "label": traces[index]["name"]}
                for index in indexes
            ],
        }
        for group_id, label, indexes in groups
    ]


def build_forge() -> tuple[dict[str, Any], dict[str, Any]]:
    traces, old_layout, _ = extract_plotly_call(SOURCES["forge"])
    line_sampling: list[dict[str, Any]] = []

    # These two traces are smooth interpolation products (~11k points apiece),
    # not extra measurements.  A 700-point display line is still sub-pixel at
    # portfolio dimensions while avoiding expensive mobile WebGL uploads.
    for index in (0, 1):
        traces[index], before, after = downsample_trace(traces[index], 700)
        line_sampling.append({"trace": traces[index]["name"], "before": before, "after": after})
    # Retain every stage boundary and every microseismic event.  The longest
    # stage overlay is also an interpolated line and can be rendered at 500 pts.
    for index in range(2, 15):
        traces[index], before, after = downsample_trace(traces[index], 500)
        if before != after:
            line_sampling.append({"trace": traces[index]["name"], "before": before, "after": after})

    precision: list[dict[str, float]] = []
    traces = compact_packed_arrays(traces, precision)
    for trace in traces:
        trace["showlegend"] = False
        if trace.get("mode") == "markers":
            trace["hovertemplate"] = (
                "<b>%{fullData.name}</b><br>Rel. easting %{x:,.0f} ft<br>"
                "Rel. northing %{y:,.0f} ft<br>TVD %{z:,.0f} ft<extra></extra>"
            )
        else:
            trace["hovertemplate"] = (
                "<b>%{fullData.name}</b><br>Rel. easting %{x:,.0f} ft<br>"
                "Rel. northing %{y:,.0f} ft<br>TVD %{z:,.0f} ft<extra></extra>"
            )

    scene = old_layout["scene"]
    for axis_name in ("xaxis", "yaxis", "zaxis"):
        scene[axis_name]["showspikes"] = False
        scene[axis_name]["tickfont"] = {"size": 10}
        scene[axis_name]["title"]["font"] = {"size": 11}

    layout = {
        "template": "plotly_white",
        "autosize": True,
        "showlegend": False,
        "uirevision": "forge-v2",
        "margin": {"l": 0, "r": 0, "b": 0, "t": 4},
        "scene": scene,
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(0,0,0,0)",
    }
    output = {
        "schemaVersion": 1,
        "id": "forge",
        "kind": "plotly",
        "title": "Utah FORGE wells and microseismicity",
        "description": (
            "Well 16A and 16B trajectories, stimulation intervals, and "
            "microseismic events shown relative to the Well 16A head."
        ),
        "traces": traces,
        "layout": layout,
        "config": base_config(),
        "controls": {
            "kind": "grouped-multi-toggle",
            "label": "Visible FORGE data",
            "actions": ["show-all", "reset"],
            "groups": forge_control_groups(traces),
        },
        "mobile": {"minHeight": 430, "preferredHeight": 580, "fullscreen": True},
        "fallback": {
            "poster": "/portfolio/posters/forge.webp",
            "summary": "/portfolio/fallbacks/forge-summary.html",
        },
    }
    event_count = sum(packed_length(trace["x"]) for trace in traces[15:])
    audit = {
        "trace_count": len(traces),
        "microseismic_event_count": event_count,
        "line_sampling": line_sampling,
        "float32_max_abs_error": max(item["max_abs_error"] for item in precision),
    }
    return output, audit


def build_nevada() -> tuple[dict[str, Any], dict[str, Any]]:
    traces, _, _ = extract_plotly_call(SOURCES["nevada"])
    lat = unpack(traces[0]["lat"])
    lon = unpack(traces[0]["lon"])
    for trace in traces[1:]:
        if not np.array_equal(lat, unpack(trace["lat"])) or not np.array_equal(lon, unpack(trace["lon"])):
            raise ValueError("Nevada layer coordinates are no longer shared")

    precision: list[dict[str, float]] = []
    coordinates = compact_packed_arrays({"lat": traces[0]["lat"], "lon": traces[0]["lon"]}, precision)
    layers = []
    for index, trace in enumerate(traces):
        values = compact_packed_arrays(trace["marker"]["color"], precision)
        marker = trace["marker"]
        label = ["Prediction", "Ground Truth (PFA)", "Difference"][index]
        layer = {
            "id": ["prediction", "ground-truth", "difference"][index],
            "label": label,
            "valueLabel": label,
            "values": values,
            "colorscale": marker["colorscale"],
            "range": [0, 1] if index < 2 else [-1, 1],
            "colorbarTitle": label,
        }
        layers.append(layer)

    layout = {
        "autosize": True,
        "showlegend": False,
        "uirevision": "nevada-map-v1",
        "dragmode": "pan",
        "map": {
            "style": "carto-positron",
            "center": {"lat": float(np.mean(lat)), "lon": float(np.mean(lon))},
            "zoom": 6.25,
            "bearing": 0,
            "pitch": 0,
        },
        "margin": {"l": 0, "r": 0, "b": 0, "t": 0},
        "paper_bgcolor": "rgba(0,0,0,0)",
    }
    output = {
        "schemaVersion": 1,
        "id": "nevada",
        "kind": "shared-coordinate-map-layers",
        "title": "Nevada geothermal favorability",
        "description": (
            "CNN-predicted favorability, source PFA values, and their signed "
            "difference at 17,436 common Nevada grid points."
        ),
        "coordinates": coordinates,
        "layers": layers,
        "defaultLayer": "prediction",
        "traceDefaults": {
            "type": "scattermap",
            "mode": "markers",
            "marker": {"size": 6, "opacity": 0.62, "showscale": True},
        },
        "layout": layout,
        "config": base_config(),
        "controls": {
            "kind": "single-select-segmented",
            "label": "Map layer",
            "items": [{"id": layer["id"], "label": layer["label"]} for layer in layers],
        },
        "mobile": {"minHeight": 420, "preferredHeight": 540, "fullscreen": True},
        "fallback": {
            "poster": "/portfolio/posters/nevada.webp",
            "summary": "/portfolio/fallbacks/nevada-summary.html",
        },
    }
    audit = {
        "grid_point_count": int(lat.size),
        "coordinate_copies_before": len(traces),
        "coordinate_copies_after": 1,
        "hover_strings_removed": sum(len(trace["text"]) for trace in traces),
        "float32_max_abs_error": max(item["max_abs_error"] for item in precision),
        "difference_range_corrected": [-1, 1],
    }
    return output, audit


def build_monte_carlo() -> tuple[dict[str, Any], dict[str, Any]]:
    traces, old_layout, _ = extract_plotly_call(SOURCES["monte_carlo"])
    samples = np.asarray(traces[0]["x"], dtype=np.float64)
    counts, edges = np.histogram(samples, bins=100)
    centers = (edges[:-1] + edges[1:]) / 2
    widths = edges[1:] - edges[:-1]
    percentile_values = np.quantile(samples, [0.1, 0.5, 0.9])
    # Preserve the project's exceedance-probability nomenclature.
    percentiles = [
        {"label": "P90", "value": float(percentile_values[0]), "color": PALETTE["red"]},
        {"label": "P50", "value": float(percentile_values[1]), "color": PALETTE["blue"]},
        {"label": "P10", "value": float(percentile_values[2]), "color": PALETTE["green"]},
    ]
    shapes = [
        {
            "type": "line",
            "xref": "x",
            "yref": "paper",
            "x0": item["value"],
            "x1": item["value"],
            "y0": 0,
            "y1": 1,
            "line": {
                "color": item["color"],
                "dash": "solid" if item["label"] == "P50" else "dash",
                "width": 2,
            },
        }
        for item in percentiles
    ]
    output = {
        "schemaVersion": 1,
        "id": "monte-carlo",
        "kind": "plotly",
        "title": "Probability distribution of project IRR",
        "description": "A 100-bin summary of 10,000 simulated internal rates of return.",
        "traces": [
            {
                "type": "bar",
                "name": "Simulated IRRs",
                "x": centers.round(6).tolist(),
                "y": counts.astype(int).tolist(),
                "width": widths.round(6).tolist(),
                "marker": {"color": PALETTE["green"], "line": {"width": 0}},
                "hovertemplate": "IRR %{x:.2f}%<br>%{y:,} simulations<extra></extra>",
            }
        ],
        "layout": {
            "template": "plotly_white",
            "autosize": True,
            "showlegend": False,
            "margin": {"t": 8, "b": 50, "l": 54, "r": 10},
            "bargap": 0.02,
            "shapes": shapes,
            "xaxis": {"title": {"text": "Internal rate of return (%)"}, "automargin": True},
            "yaxis": {"title": {"text": "Simulations"}, "automargin": True, "rangemode": "tozero"},
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
        },
        "config": base_config(),
        "summary": {
            "simulationCount": int(samples.size),
            "mean": float(np.mean(samples)),
            "minimum": float(np.min(samples)),
            "maximum": float(np.max(samples)),
            "percentiles": percentiles,
            "convention": "P-values use exceedance probability: P90 is the conservative outcome.",
        },
        "controls": {"kind": "stat-cards", "items": percentiles},
        "mobile": {"minHeight": 330, "preferredHeight": 390, "fullscreen": False},
        "fallback": {
            "poster": "/portfolio/posters/monte-carlo.svg",
            "summary": "/portfolio/fallbacks/monte-carlo-summary.html",
        },
    }
    audit = {
        "samples_before": int(samples.size),
        "bins_after": int(counts.size),
        "count_preserved": int(counts.sum()) == int(samples.size),
        "percentiles": {item["label"]: item["value"] for item in percentiles},
    }
    return output, audit


def build_tornado() -> tuple[dict[str, Any], dict[str, Any]]:
    traces, old_layout, _ = extract_plotly_call(SOURCES["tornado"])
    base_irr = float(traces[0]["base"])
    for trace in traces:
        trace["hovertemplate"] = (
            "%{y}<br>Base IRR: " + f"{base_irr:.2f}%" +
            "<br>Change: %{x:+.2f} pp<extra>%{fullData.name}</extra>"
        )
    traces[0]["marker"]["color"] = PALETTE["red"]
    traces[1]["marker"]["color"] = PALETTE["green"]
    output = {
        "schemaVersion": 1,
        "id": "tornado",
        "kind": "plotly",
        "title": "IRR sensitivity tornado",
        "description": (
            f"Seven-variable one-at-a-time sensitivity around a {base_irr:.2f}% base IRR."
        ),
        "traces": traces,
        "layout": {
            "template": "plotly_white",
            "autosize": True,
            "showlegend": False,
            "barmode": "overlay",
            "margin": {"t": 8, "b": 52, "l": 116, "r": 12},
            "shapes": old_layout["shapes"],
            "xaxis": {
                "title": {"text": "Internal rate of return (%)"},
                "automargin": True,
                "zeroline": False,
            },
            "yaxis": {"automargin": True},
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
        },
        "config": base_config(),
        "summary": {
            "baseIrr": base_irr,
            "variables": [
                {
                    "name": name,
                    "downsideChange": float(traces[0]["x"][index]),
                    "upsideChange": float(traces[1]["x"][index]),
                    "downsideIrr": base_irr + float(traces[0]["x"][index]),
                    "upsideIrr": base_irr + float(traces[1]["x"][index]),
                }
                for index, name in enumerate(traces[0]["y"])
            ],
        },
        "controls": {
            "kind": "external-legend",
            "items": [
                {"label": "Downside", "color": PALETTE["red"]},
                {"label": "Upside", "color": PALETTE["green"]},
                {"label": "Base IRR", "color": "#111827", "lineStyle": "dash"},
            ],
        },
        "mobile": {"minHeight": 390, "preferredHeight": 440, "fullscreen": False},
        "fallback": {
            "poster": "/portfolio/posters/tornado.svg",
            "summary": "/portfolio/fallbacks/tornado-summary.html",
        },
    }
    audit = {"variable_count": len(traces[0]["y"]), "base_irr": base_irr}
    return output, audit


def svg_escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def write_monte_svg(asset: dict[str, Any]) -> None:
    trace = asset["traces"][0]
    values = trace["y"]
    width, height = 960, 500
    left, right, top, bottom = 68, 28, 54, 70
    plot_w, plot_h = width - left - right, height - top - bottom
    max_count = max(values)
    bars = []
    for index, count in enumerate(values):
        x = left + index * plot_w / len(values)
        bar_w = plot_w / len(values) + 0.35
        bar_h = count / max_count * plot_h
        bars.append(
            f'<rect x="{x:.2f}" y="{top + plot_h - bar_h:.2f}" '
            f'width="{bar_w:.2f}" height="{bar_h:.2f}" fill="{PALETTE["green"]}"/>'
        )
    x_min, x_max = min(trace["x"]), max(trace["x"])
    lines = []
    for item in asset["summary"]["percentiles"]:
        x = left + (item["value"] - x_min) / (x_max - x_min) * plot_w
        dash = "" if item["label"] == "P50" else ' stroke-dasharray="8 6"'
        lines.append(
            f'<line x1="{x:.2f}" x2="{x:.2f}" y1="{top}" y2="{top + plot_h}" '
            f'stroke="{item["color"]}" stroke-width="3"{dash}/>'
            f'<text x="{x:.2f}" y="{top - 12}" text-anchor="middle" font-size="18" '
            f'font-weight="700" fill="{item["color"]}">{item["label"]} {item["value"]:.2f}%</text>'
        )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">Probability distribution of project IRR</title>
  <desc id="desc">Histogram of 10,000 simulations. P90 is {asset["summary"]["percentiles"][0]["value"]:.2f} percent, P50 is {asset["summary"]["percentiles"][1]["value"]:.2f} percent, and P10 is {asset["summary"]["percentiles"][2]["value"]:.2f} percent.</desc>
  <rect width="100%" height="100%" fill="#ffffff" rx="16"/>
  <text x="{left}" y="30" font-size="22" font-weight="700" fill="#172033">Probability distribution of project IRR</text>
  {''.join(bars)}
  {''.join(lines)}
  <line x1="{left}" x2="{left + plot_w}" y1="{top + plot_h}" y2="{top + plot_h}" stroke="#4b5563"/>
  <text x="{left + plot_w / 2}" y="{height - 22}" text-anchor="middle" font-size="18" fill="#374151">Internal rate of return (%)</text>
  <text x="18" y="{top + plot_h / 2}" text-anchor="middle" font-size="18" fill="#374151" transform="rotate(-90 18 {top + plot_h / 2})">Simulations</text>
</svg>'''
    (POSTERS / "monte-carlo.svg").write_text(svg, encoding="utf-8")


def write_tornado_svg(asset: dict[str, Any]) -> None:
    variables = asset["summary"]["variables"]
    base = asset["summary"]["baseIrr"]
    low = min(item["downsideIrr"] for item in variables) - 0.7
    high = max(item["upsideIrr"] for item in variables) + 0.7
    width, height = 960, 520
    left, right, top, bottom = 176, 35, 55, 55
    plot_w = width - left - right
    row_h = (height - top - bottom) / len(variables)
    scale = lambda value: left + (value - low) / (high - low) * plot_w
    rows = []
    for index, item in enumerate(variables):
        y = top + index * row_h + row_h * 0.18
        h = row_h * 0.64
        base_x = scale(base)
        down_x = scale(item["downsideIrr"])
        up_x = scale(item["upsideIrr"])
        rows.append(
            f'<text x="{left - 12}" y="{y + h * .72:.2f}" text-anchor="end" font-size="16" fill="#273142">{svg_escape(item["name"])}</text>'
            f'<rect x="{down_x:.2f}" y="{y:.2f}" width="{base_x - down_x:.2f}" height="{h:.2f}" fill="{PALETTE["red"]}" rx="2"/>'
            f'<rect x="{base_x:.2f}" y="{y:.2f}" width="{scale(item["upsideIrr"]) - base_x:.2f}" height="{h:.2f}" fill="{PALETTE["green"]}" rx="2"/>'
        )
    base_x = scale(base)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">IRR sensitivity tornado</title>
  <desc id="desc">Seven one-at-a-time sensitivities around a base IRR of {base:.2f} percent. Energy rate has the largest downside and upside range.</desc>
  <rect width="100%" height="100%" fill="#ffffff" rx="16"/>
  <text x="{left}" y="30" font-size="22" font-weight="700" fill="#172033">IRR sensitivity tornado</text>
  {''.join(rows)}
  <line x1="{base_x:.2f}" x2="{base_x:.2f}" y1="{top - 5}" y2="{height - bottom + 4}" stroke="#111827" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="{base_x:.2f}" y="{height - 18}" text-anchor="middle" font-size="17" fill="#111827">Base {base:.2f}%</text>
  <rect x="{width - 245}" y="18" width="14" height="14" fill="{PALETTE["red"]}"/><text x="{width - 224}" y="31" font-size="15">Downside</text>
  <rect x="{width - 132}" y="18" width="14" height="14" fill="{PALETTE["green"]}"/><text x="{width - 111}" y="31" font-size="15">Upside</text>
</svg>'''
    (POSTERS / "tornado.svg").write_text(svg, encoding="utf-8")


def render_raster_posters(basin: dict[str, Any], forge: dict[str, Any], nevada: dict[str, Any]) -> None:
    """Generate compact WebP fallbacks with matplotlib and Pillow."""

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    # Debian's split matplotlib package does not eagerly register 3D axes.
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    from PIL import Image

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})

    def mpl_color(value: Any) -> Any:
        """Translate Plotly's CSS rgb()/rgba() strings for older matplotlib."""
        if not isinstance(value, str) or not value.startswith(("rgb(", "rgba(")):
            return value
        channels = value[value.find("(") + 1:value.rfind(")")].split(",")
        red, green, blue = (float(channel.strip()) / 255 for channel in channels[:3])
        if len(channels) == 4:
            return red, green, blue, float(channels[3].strip())
        return red, green, blue

    def save_webp(fig: Any, path: Path) -> None:
        png = io.BytesIO()
        fig.savefig(png, format="png", dpi=150, bbox_inches="tight", facecolor="white")
        plt.close(fig)
        png.seek(0)
        image = Image.open(png).convert("RGB")
        image.save(path, "WEBP", quality=78, method=6)

    # Basin: render all 45 formations with the same trace colors.
    fig = plt.figure(figsize=(9.6, 5.4))
    ax = fig.add_subplot(111, projection="3d")
    for trace in basin["traces"]:
        x, y, z = (unpack(trace[key]) for key in ("x", "y", "z"))
        if len(x) > 900:
            indexes = np.linspace(0, len(x) - 1, 900, dtype=int)
            x, y, z = x[indexes], y[indexes], z[indexes]
        ax.scatter(x, y, z, s=1.0, alpha=0.72, c=trace["marker"]["color"], depthshade=False)
    ax.set_xlabel("Longitude", labelpad=8)
    ax.set_ylabel("Latitude", labelpad=8)
    ax.set_zlabel("TVD (ft)", labelpad=8)
    ax.invert_zaxis()
    ax.view_init(elev=11, azim=92)
    ax.set_title("Delaware Basin formation tops · 45 formations", loc="left", fontsize=13, fontweight="bold")
    fig.tight_layout()
    save_webp(fig, POSTERS / "basin.webp")

    # FORGE: retain trace colors, widths, and marker sizes at poster scale.
    fig = plt.figure(figsize=(9.6, 5.4))
    ax = fig.add_subplot(111, projection="3d")
    for trace in forge["traces"]:
        x, y, z = (unpack(trace[key]) for key in ("x", "y", "z"))
        if trace.get("mode") == "markers":
            marker = trace.get("marker", {})
            color = marker.get("color", "#64748b")
            if isinstance(color, dict):
                color = trace.get("marker", {}).get("colorscale", [[0, "#64748b"]])[0][1]
            ax.scatter(x, y, z, s=3.2, alpha=float(marker.get("opacity", 0.55)), c=[mpl_color(color)], depthshade=False)
        else:
            line = trace.get("line", {})
            ax.plot(x, y, z, color=mpl_color(line.get("color", "#334155")), linewidth=max(0.6, float(line.get("width", 2)) * 0.55), alpha=0.9)
    ax.set_xlabel("Rel. easting (ft)")
    ax.set_ylabel("Rel. northing (ft)")
    ax.set_zlabel("TVD (ft)")
    ax.invert_zaxis()
    ax.view_init(elev=19, azim=-48)
    ax.set_title("Utah FORGE wells and microseismicity", loc="left", fontsize=13, fontweight="bold")
    fig.tight_layout()
    save_webp(fig, POSTERS / "forge.webp")

    # Nevada: the default prediction layer used by the draggable live map.
    lat = unpack(nevada["coordinates"]["lat"])
    lon = unpack(nevada["coordinates"]["lon"])
    values = unpack(nevada["layers"][0]["values"])
    fig, ax = plt.subplots(figsize=(9.6, 5.4))
    points = ax.scatter(lon, lat, c=values, s=3.2, cmap="viridis", vmin=0, vmax=1, linewidths=0)
    colorbar = fig.colorbar(points, ax=ax, fraction=0.035, pad=0.025)
    colorbar.set_label("CNN prediction")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_aspect("equal", adjustable="box")
    ax.set_title("Nevada geothermal favorability · CNN prediction", loc="left", fontsize=13, fontweight="bold")
    ax.grid(color="#e5e7eb", linewidth=0.55)
    fig.tight_layout()
    save_webp(fig, POSTERS / "nevada.webp")


def write_fallback_summaries(
    basin: dict[str, Any], forge: dict[str, Any], nevada: dict[str, Any],
    monte: dict[str, Any], tornado: dict[str, Any], audits: dict[str, Any],
) -> None:
    summaries = {
        "basin-summary.html": f'''<figure class="plot-fallback">
  <img src="/portfolio/posters/basin.webp" alt="Oblique three-dimensional view of Delaware Basin formation-top observations colored by formation.">
  <figcaption>{audits["basin"]["point_count"]:,} well-top observations across 45 named formations. True vertical depth increases downward.</figcaption>
</figure>''',
        "forge-summary.html": f'''<figure class="plot-fallback">
  <img src="/portfolio/posters/forge.webp" alt="Three-dimensional view of Utah FORGE Well 16A and 16B paths, stimulation intervals, and microseismic events.">
  <figcaption>Two well paths, 13 stimulation-interval overlays, and {audits["forge"]["microseismic_event_count"]:,} catalogued microseismic events.</figcaption>
</figure>''',
        "nevada-summary.html": f'''<figure class="plot-fallback">
  <img src="/portfolio/posters/nevada.webp" alt="Nevada grid colored by CNN-predicted geothermal favorability from zero to one.">
  <figcaption>{audits["nevada"]["grid_point_count"]:,} common grid points support prediction, ground-truth PFA, and signed-difference layers.</figcaption>
</figure>''',
    }

    stats = monte["summary"]
    summaries["monte-carlo-summary.html"] = f'''<figure class="plot-fallback">
  <img src="/portfolio/posters/monte-carlo.svg" alt="Histogram of 10,000 simulated project IRRs with P90, P50, and P10 markers.">
  <figcaption>
    <table>
      <caption>Monte Carlo IRR outcomes (exceedance-probability convention)</caption>
      <thead><tr><th scope="col">Outcome</th><th scope="col">IRR</th></tr></thead>
      <tbody>{''.join(f'<tr><th scope="row">{item["label"]}</th><td>{item["value"]:.2f}%</td></tr>' for item in stats["percentiles"])}</tbody>
    </table>
  </figcaption>
</figure>'''

    rows = "".join(
        f'<tr><th scope="row">{svg_escape(item["name"])}</th>'
        f'<td>{item["downsideIrr"]:.2f}%</td><td>{item["upsideIrr"]:.2f}%</td></tr>'
        for item in tornado["summary"]["variables"]
    )
    summaries["tornado-summary.html"] = f'''<figure class="plot-fallback">
  <img src="/portfolio/posters/tornado.svg" alt="Horizontal sensitivity bars for seven project assumptions around the base IRR.">
  <figcaption>
    <table>
      <caption>IRR sensitivity around the {tornado["summary"]["baseIrr"]:.2f}% base case</caption>
      <thead><tr><th scope="col">Variable</th><th scope="col">Downside IRR</th><th scope="col">Upside IRR</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </figcaption>
</figure>'''

    for filename, source in summaries.items():
        (FALLBACKS / filename).write_text(source + "\n", encoding="utf-8")


def file_size_record(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    return {
        "path": str(path.relative_to(REPO)),
        "bytes": len(raw),
        "gzip_bytes": len(gzip.compress(raw, compresslevel=9)),
    }


def build_size_report(generated_json: list[Path], audits: dict[str, Any]) -> dict[str, Any]:
    before = {key: file_size_record(path) for key, path in SOURCES.items()}
    integration_paths = [
        OUTPUT / "js" / "plot-data.js",
        OUTPUT / "js" / "sierra-model.js",
        OUTPUT / "css" / "sierra-model.css",
    ]
    integration_paths = [path for path in integration_paths if path.exists()]
    after_paths = generated_json + integration_paths + sorted(POSTERS.glob("*")) + sorted(FALLBACKS.glob("*"))
    after = [file_size_record(path) for path in after_paths]
    plot_data = [file_size_record(path) for path in generated_json]
    return {
        "notes": [
            "Before sizes are current standalone HTML exports.",
            "After plot-data sizes exclude posters/fallbacks and the one shared parent Plotly runtime.",
            "No generated JSON, module, poster, or fallback embeds plotly.js.",
            "Sierra's old HTML references a CDN runtime rather than embedding one; its portfolio module also uses the parent runtime.",
        ],
        "before": before,
        "after_plot_data": plot_data,
        "after_integration_modules": [file_size_record(path) for path in integration_paths],
        "after_all_generated_assets": after,
        "totals": {
            "before_raw_bytes": sum(item["bytes"] for item in before.values()),
            "before_gzip_bytes": sum(item["gzip_bytes"] for item in before.values()),
            "after_plot_data_raw_bytes": sum(item["bytes"] for item in plot_data),
            "after_plot_data_gzip_bytes": sum(item["gzip_bytes"] for item in plot_data),
        },
        "audits": audits,
    }


def write_report_markdown(report: dict[str, Any]) -> None:
    def kib(value: int) -> str:
        return f"{value / 1024:.1f} KiB"

    lines = [
        "# Portfolio visualization asset report",
        "",
        "Generated by `scripts/portfolio/generate_plot_assets.py`.",
        "",
        "Plotly is not embedded in any portfolio asset. The page supplies one pinned shared runtime.",
        "",
        "| Experience | Before raw | Before gzip | After data raw | After data gzip |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    after_by_name = {Path(item["path"]).stem: item for item in report["after_plot_data"]}
    key_to_stem = {
        "basin": "basin",
        "nevada": "nevada",
        "forge": "forge",
        "monte_carlo": "monte-carlo",
        "tornado": "tornado",
    }
    for key, stem in key_to_stem.items():
        before = report["before"][key]
        after = after_by_name[stem]
        lines.append(
            f"| {stem} | {kib(before['bytes'])} | {kib(before['gzip_bytes'])} | "
            f"{kib(after['bytes'])} | {kib(after['gzip_bytes'])} |"
        )
    integration_by_name = {
        Path(item["path"]).name: item for item in report["after_integration_modules"]
    }
    sierra_before = report["before"]["sierra"]
    sierra_js = integration_by_name["sierra-model.js"]
    sierra_css = integration_by_name["sierra-model.css"]
    lines.append(
        f"| sierra model HTML → shared-runtime module | {kib(sierra_before['bytes'])} | "
        f"{kib(sierra_before['gzip_bytes'])} | {kib(sierra_js['bytes'] + sierra_css['bytes'])} | "
        f"{kib(sierra_js['gzip_bytes'] + sierra_css['gzip_bytes'])} |"
    )
    totals = report["totals"]
    lines.extend([
        "",
        "Data-only total (five exported figures): "
        f"**{kib(totals['after_plot_data_raw_bytes'])} raw / "
        f"{kib(totals['after_plot_data_gzip_bytes'])} gzip**.",
        "",
        "The old combined total includes three duplicate embedded Plotly runtimes. "
        "The compact total excludes the shared runtime because the parent downloads it once.",
        "The common data adapter is "
        f"**{kib(integration_by_name['plot-data.js']['bytes'])} raw / "
        f"{kib(integration_by_name['plot-data.js']['gzip_bytes'])} gzip** and is shared by all five plots.",
        "",
        "## Scientific/display transformations",
        "",
        f"- Basin retains all {report['audits']['basin']['point_count']:,} observations and all 45 formations.",
        f"- FORGE retains all {report['audits']['forge']['microseismic_event_count']:,} microseismic events and every stage trace; only smooth interpolated line samples are reduced.",
        f"- Nevada stores {report['audits']['nevada']['grid_point_count']:,} shared coordinates once and removes {report['audits']['nevada']['hover_strings_removed']:,} preformatted hover strings. Hover text is regenerated accessibly at runtime.",
        "- Nevada's signed prediction-minus-PFA layer uses a scientifically meaningful −1 to +1 diverging scale centered on zero; the old export clipped negative values with a 0 to 1 scale.",
        "- Monte Carlo retains exact P90/P50/P10 values and all 10,000 outcomes as counts across 100 bins; raw samples are not sent to the browser.",
        "- Tornado retains all seven variables and exact sensitivity values.",
        "- Float32 conversion affects display coordinates only; maximum absolute errors are recorded in `asset-size-report.json`.",
        "",
    ])
    (OUTPUT / "ASSET_REPORT.md").write_text("\n".join(lines), encoding="utf-8")


def assert_no_embedded_runtime(paths: Iterable[Path]) -> None:
    signatures = (b"plotly.js v", b"function plotly", b"plotly.js-dist")
    for path in paths:
        content = path.read_bytes().lower()
        for signature in signatures:
            if signature in content:
                raise AssertionError(f"Embedded Plotly signature {signature!r} in {path}")


def main() -> None:
    for directory in (DATA, POSTERS, FALLBACKS):
        directory.mkdir(parents=True, exist_ok=True)

    basin, basin_audit = build_basin()
    nevada, nevada_audit = build_nevada()
    forge, forge_audit = build_forge()
    monte, monte_audit = build_monte_carlo()
    tornado, tornado_audit = build_tornado()
    assets = {
        "basin": basin,
        "nevada": nevada,
        "forge": forge,
        "monte-carlo": monte,
        "tornado": tornado,
    }
    audits = {
        "basin": basin_audit,
        "nevada": nevada_audit,
        "forge": forge_audit,
        "monte-carlo": monte_audit,
        "tornado": tornado_audit,
    }

    generated_json = []
    for name, asset in assets.items():
        path = DATA / f"{name}.json"
        write_json(path, asset)
        generated_json.append(path)

    manifest = {
        "schemaVersion": 1,
        "runtime": {
            "name": "Plotly",
            "testedVersion": "3.4.0",
            "ownership": "parent-page",
            "embedded": False,
        },
        "adapter": "/portfolio/js/plot-data.js",
        "assets": {
            name: {
                "data": f"/portfolio/data/{name}.json",
                "title": asset["title"],
                "kind": asset["kind"],
                "poster": asset["fallback"]["poster"],
                "summary": asset["fallback"]["summary"],
            }
            for name, asset in assets.items()
        },
        "sierra": {
            "module": "/portfolio/js/sierra-model.js",
            "stylesheet": "/portfolio/css/sierra-model.css",
            "runtime": "parent-page",
        },
    }
    manifest_path = DATA / "manifest.json"
    write_json(manifest_path, manifest)
    generated_json.append(manifest_path)

    write_monte_svg(monte)
    write_tornado_svg(tornado)
    render_raster_posters(basin, forge, nevada)
    write_fallback_summaries(basin, forge, nevada, monte, tornado, audits)

    report = build_size_report(generated_json[:-1], audits)
    write_json(OUTPUT / "asset-size-report.json", report)
    write_report_markdown(report)
    assert_no_embedded_runtime(
        generated_json
        + list(POSTERS.glob("*"))
        + list(FALLBACKS.glob("*"))
    )

    print(json.dumps(report["totals"], indent=2))


if __name__ == "__main__":
    main()
