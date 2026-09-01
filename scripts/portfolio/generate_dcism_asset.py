#!/usr/bin/env python3
"""Build the compact DC-ISM data used by the portfolio's Plotly views.

The committed JSON carries hourly facility demand and unit-capacity solar
profiles. The browser can then dispatch user-selected solar and battery sizes
without shipping the Python model or a large matrix of precomputed cases.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np


REPOSITORY = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPOSITORY.parent / "resume-system/evidence/software/dcism"
DEFAULT_OUTPUT = REPOSITORY / "static/portfolio/data/dcism.json"

FACILITIES = {
    "meta_rsc": {
        "name": "Meta RSC",
        "detail": "Phase 1 public-scale preset",
        "server_model_key": "NVIDIA_DGX_A100",
        "server_count": 760,
        "chart_color": "#2980b9",
    },
    "h100_reference": {
        "name": "H100 Reference",
        "detail": "20 MW design-study preset",
        "server_model_key": "NVIDIA_DGX_H100",
        "server_count": 2_000,
        "chart_color": "#27ae60",
    },
    "colossus_scale": {
        "name": "Colossus Scale",
        "detail": "100k-H100 validation preset",
        "server_model_key": "NVIDIA_DGX_H100",
        "server_count": 12_500,
        "chart_color": "#c0392b",
    },
    "stargate_phase_1": {
        "name": "Stargate Phase 1",
        "detail": "public-scale GB200 proxy",
        "server_model_key": "NVIDIA_GB200_NVL72",
        "server_count": 5_556,
        "chart_color": "#f1c40f",
    },
}

SITES = {
    "permian_basin_tx": "Permian Basin, TX",
    "northern_virginia": "Northern Virginia",
    "reno_nv": "Reno, NV",
    "phoenix_az": "Phoenix, AZ",
    "stockholm_se": "Stockholm, Sweden",
}

WORKLOADS = (
    {
        "key": "llama2_7b", "name": "Llama 2 7B", "kind": "dense",
        "parameters": 7e9, "active_parameters": 7e9, "tokens": 2e12,
        "source": "https://arxiv.org/abs/2307.09288",
    },
    {
        "key": "llama2_70b", "name": "Llama 2 70B", "kind": "dense",
        "parameters": 70e9, "active_parameters": 70e9, "tokens": 2e12,
        "source": "https://arxiv.org/abs/2307.09288",
    },
    {
        "key": "gpt3_175b", "name": "GPT-3 175B", "kind": "dense",
        "parameters": 175e9, "active_parameters": 175e9, "tokens": 300e9,
        "source": "https://arxiv.org/abs/2005.14165",
    },
    {
        "key": "llama31_405b", "name": "Llama 3.1 405B", "kind": "dense",
        "parameters": 405e9, "active_parameters": 405e9, "tokens": 15e12,
        "source": "https://ai.meta.com/blog/meta-llama-3-1/",
    },
    {
        "key": "deepseek_v3", "name": "DeepSeek-V3", "kind": "moe",
        "parameters": 671e9, "active_parameters": 37e9, "tokens": 14.8e12,
        "source": "https://arxiv.org/abs/2412.19437",
    },
)

STARGATE_SOURCE = "https://cdn.openai.com/global-affairs/f9361fe7-e452-4c78-94dc-e6946c73c858/openai-south-korea-economic-blueprint-october-2025.pdf"


def rounded(values: np.ndarray, digits: int = 3) -> list[float]:
    return [round(float(value), digits) for value in values]


def build(source: Path) -> dict:
    sys.path.insert(0, str(source / "src"))
    from dcism.analysis import estimate_training_time
    from dcism.energy_systems import OnsiteSolar
    from dcism.engine import Engine, ScenarioSpec
    from dcism.workloads import MoETransformerTrainingWorkload, TransformerTrainingWorkload

    engine = Engine(source / "data")
    facilities = {}
    for key, definition in FACILITIES.items():
        cluster = engine.library.catalog.create_cluster(
            definition["server_model_key"], definition["server_count"]
        )
        facilities[key] = {
            "name": definition["name"],
            "detail": definition["detail"],
            "serverModel": definition["server_model_key"],
            "serverCount": definition["server_count"],
            "gpu": cluster.server_prototype.gpu_prototype.name,
            "gpuCount": cluster.total_gpu_count,
            "itNameplateMw": round(cluster.total_it_power_mw, 2),
            "chartColor": definition["chart_color"],
            "source": STARGATE_SOURCE if key == "stargate_phase_1" else "DC-ISM hardware preset",
        }

    demand = {}
    facility_components = {}
    for facility_key, definition in FACILITIES.items():
        demand[facility_key] = {}
        for site_index, site_key in enumerate(SITES):
            result = engine.evaluate(ScenarioSpec(
                name=f"portfolio_{facility_key}_{site_key}",
                server_model_key=definition["server_model_key"],
                server_count=definition["server_count"],
                cooling_archetype="dlc",
                location_key=site_key,
                workload_kind="training",
                goodput=0.90,
                redundancy="N+1",
                year=2026,
            ))
            if site_index == 0:
                facility_components[facility_key] = {
                    "itMw": rounded(np.asarray(result.demand_case.it_mw)),
                    "houseMw": round(float(result.demand_case.house_mw[0]), 4),
                }
            demand[facility_key][site_key] = {
                "powerMw": rounded(np.asarray(result.demand_case.total_mw)),
                "coolingMw": rounded(np.asarray(result.demand_case.cooling_mw)),
                "pue": round(result.average_pue, 4),
                "peakMw": round(result.peak_mw, 3),
                "energyGwh": round(result.energy_gwh, 3),
                "waterM3": round(result.water_m3, 1),
                "weather": result.weather_provenance,
            }

    solar = {}
    for site_key in SITES:
        location = engine.locations.get(site_key)
        weather = location.get_weather_for_year(2026)
        model = OnsiteSolar(
            name="1 MWdc reference PV",
            capacity_mw_dc=1.0,
            dc_ac_ratio=1.3,
            performance_ratio=0.85,
            sqm_per_mw_dc=20_234.3,
        )
        solar[site_key] = {
            "name": SITES[site_key],
            "unitPowerMw": rounded(model.get_supply_profile(weather), 5),
            "weather": weather.provenance,
        }

    training = {}
    for facility_key, definition in FACILITIES.items():
        cluster = engine.library.catalog.create_cluster(
            definition["server_model_key"], definition["server_count"]
        )
        training[facility_key] = {}
        for workload in WORKLOADS:
            if workload["kind"] == "moe":
                model = MoETransformerTrainingWorkload(
                    workload["name"], workload["parameters"],
                    workload["active_parameters"], workload["tokens"], 8,
                )
            else:
                model = TransformerTrainingWorkload(
                    workload["name"], workload["parameters"], workload["tokens"], 8,
                )
            days, bottleneck = estimate_training_time(cluster, model, "bf16", 0.40)
            training[facility_key][workload["key"]] = {
                "days": round(days, 5),
                "bottleneck": bottleneck,
                "flops": model.total_compute_flops,
            }

    return {
        "schemaVersion": 2,
        "model": "DC-ISM",
        "year": 2026,
        "hours": 8_760,
        "energyAssumptions": {
            "cooling": "Direct liquid cooling",
            "workload": "training",
            "goodput": 0.90,
            "redundancy": "N+1",
            "solarDcAcRatio": 1.3,
            "solarPerformanceRatio": 0.85,
            "batteryRoundTripEfficiency": 0.85,
            "weather": "location-specific synthetic climate normals",
        },
        "trainingAssumptions": {
            "precision": "dense BF16",
            "modelFlopsUtilization": 0.40,
            "method": "DC-ISM 6NDT compute and coarse communication roofline",
        },
        "facilities": facilities,
        "sites": {key: {"name": name} for key, name in SITES.items()},
        "workloads": list(WORKLOADS),
        "facilityComponents": facility_components,
        "demand": demand,
        "solar": solar,
        "training": training,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if not (args.source / "src/dcism").is_dir():
        raise SystemExit(f"DC-ISM source not found: {args.source}")
    payload = build(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {args.output} ({args.output.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
