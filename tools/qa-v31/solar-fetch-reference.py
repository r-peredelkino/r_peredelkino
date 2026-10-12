#!/usr/bin/env python3
"""Refresh independent NASA/JPL solar controls; never imports our solar implementation.

Output includes exact HTTP bodies and their SHA-256. The app itself is offline;
this read-only network request is only for deliberate reference refreshes.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import pathlib
import time
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent
SITE = {"latitude": 55.636552730942945, "longitude": 37.35292368617269, "heightKm": 0}
USER_SITE = {"latitude": 55.6367, "longitude": 37.3525, "heightKm": 0}
UTC = dt.timezone.utc
MOSCOW = ZoneInfo("Europe/Moscow")


def instant(day: str, minutes: int) -> dt.datetime:
    return (dt.datetime.fromisoformat(day).replace(tzinfo=MOSCOW) + dt.timedelta(minutes=minutes)).astimezone(UTC)


def fetch(site: dict, times: list[dt.datetime], output: pathlib.Path, label: str) -> tuple[list[dict], dict]:
    params = {
        "format": "json", "COMMAND": "'10'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'coord@399'", "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": "'%s,%s,%s'" % (site["longitude"], site["latitude"], site["heightKm"]),
        "TLIST": ",".join("'%.9f'" % (date.timestamp() / 86400 + 2440587.5) for date in times),
        "TLIST_TYPE": "'JD'", "QUANTITIES": "'4'", "REF_SYSTEM": "'ICRF'",
        "APPARENT": "'AIRLESS'", "TIME_TYPE": "'UT'", "TIME_DIGITS": "'SECONDS'",
        "CAL_FORMAT": "'BOTH'", "CSV_FORMAT": "'YES'", "EXTRA_PREC": "'YES'",
    }
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                raw = response.read()
            break
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(.5)
    obj = json.loads(raw)
    if obj.get("error"):
        raise RuntimeError(obj["error"])
    text = obj["result"]
    if "$$SOE" not in text or "$$EOE" not in text:
        raise RuntimeError("No ephemeris in the NASA/JPL response")
    path = output / f"solar-reference-{label}-raw.json"
    path.write_bytes(raw)
    rows = []
    for line in text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip().splitlines():
        fields = [value.strip() for value in line.split(",")]
        jd, azimuth, elevation = float(fields[1]), float(fields[4]), float(fields[5])
        time = min(times, key=lambda date: abs(date.timestamp() / 86400 + 2440587.5 - jd))
        if abs(time.timestamp() / 86400 + 2440587.5 - jd) > .000001:
            raise RuntimeError("Unexpected reference timestamp")
        rows.append({
            "utc": time.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "moscow": time.astimezone(MOSCOW).isoformat(timespec="seconds"),
            "latitude": site["latitude"], "longitude": site["longitude"], "observerHeightKm": site["heightKm"],
            "azimuth": azimuth, "airlessElevation": elevation,
        })
    if len(rows) != len(times):
        raise RuntimeError(f"Expected {len(times)} records, got {len(rows)}")
    return rows, {"file": path.name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "url": url, "parameters": params}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path, default=ROOT)
    parser.add_argument("--refresh", action="store_true", help="explicitly fetch new reference values from NASA/JPL")
    args = parser.parse_args()
    if not args.refresh:
        parser.error("Use --refresh to contact NASA/JPL and replace the reference fixture")
    args.output.mkdir(parents=True, exist_ok=True)
    times = []
    for year in (2024, 2026, 2030):
        for month in range(1, 13):
            for minutes in (0, 360, 720, 1080, 1439):
                times.append(instant(f"{year}-{month:02d}-21", minutes))
    for day in ("2024-02-29", "2026-10-11"):
        for minutes in (0, 360, 432, 540, 720, 900, 1080, 1439):
            times.append(instant(day, minutes))
    times = sorted(set(times))
    records, sources = [], []
    for batch, offset in enumerate(range(0, len(times), 30)):
        rows, source = fetch(SITE, times[offset:offset + 30], args.output, f"jpl-{batch + 1}")
        records.extend(rows); sources.append(source)
        print(f"Retrieved reference batch {batch + 1}: {len(rows)} samples", flush=True)
    rows, source = fetch(USER_SITE, [instant("2026-10-11", 432), instant("2026-10-11", 720)], args.output, "jpl-user-link")
    records.extend(rows); sources.append(source)
    result = {
        "provider": "NASA/JPL Horizons", "target": "Sun (10)", "retrievedUTC": dt.datetime.now(UTC).isoformat(),
        "documentation": ["https://ssd-api.jpl.nasa.gov/doc/horizons.html", "https://ssd.jpl.nasa.gov/horizons/manual.html#obsquan"],
        "referenceDefinition": "Apparent topocentric AZ/EL with AIRLESS atmospheric option; observer height 0 km above reference ellipsoid.",
        "azimuthConvention": "degrees clockwise from true north", "sampleCount": len(records),
        "sources": sources, "records": records,
    }
    target = args.output / "solar-reference-jpl.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"file": str(target), "sampleCount": len(records), "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
