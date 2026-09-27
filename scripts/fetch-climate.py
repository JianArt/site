#!/usr/bin/env python3
"""Refresh assets/data/climate.json with ~252 S&P 500 daily closes.

The hero reads this file. Run after the US cash close, or on demand:

    python3 scripts/fetch-climate.py
"""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "climate.json"
WEATHER_OUT = ROOT / "assets" / "data" / "weather.json"
URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1y&interval=1d"
WEATHER_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=37.7749&longitude=-122.4194"
    "&current=temperature_2m,wind_speed_10m,cloud_cover,weather_code"
    "&timezone=America/Los_Angeles"
)


def main() -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "jianart-climate/1.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        payload = json.load(res)

    result = payload["chart"]["result"][0]
    stamps = result["timestamp"]
    closes_raw = result["indicators"]["quote"][0]["close"]
    pairs = [(t, float(c)) for t, c in zip(stamps, closes_raw) if c is not None][-252:]
    closes = [p[1] for p in pairs]
    rets = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]
    window = rets[-20:]
    mean = sum(window) / len(window)
    vol20 = (sum((x - mean) ** 2 for x in window) / len(window)) ** 0.5

    out = {
        "symbol": "GSPC",
        "name": "S&P 500",
        "asOf": datetime.fromtimestamp(pairs[-1][0], timezone.utc).strftime("%Y-%m-%d"),
        "sessions": len(closes),
        "closes": [round(x, 2) for x in closes],
        "lastReturn": round(rets[-1], 6),
        "vol20": round(vol20, 6),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}  {out['asOf']}  {out['sessions']} sessions")

    req = urllib.request.Request(WEATHER_URL, headers={"User-Agent": "jianart-climate/1.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        weather = json.load(res)
    WEATHER_OUT.write_text(json.dumps(weather, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {WEATHER_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
