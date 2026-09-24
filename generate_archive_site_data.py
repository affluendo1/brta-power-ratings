"""Fit each archived TROLS season and publish its static site payloads."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from generate_site_data import build_section

ARCHIVE = Path("data/archive")
RAW_CATALOG = ARCHIVE / "raw_catalog.json"
ARCHIVE_SECTIONS = ARCHIVE / "sections"
SITE_SECTIONS = ARCHIVE / "site" / "sections"
CURRENT_CATALOG = Path("data/current/catalog.json")
CURRENT_SECTIONS = Path("data/site/sections")
SITE_CATALOG = ARCHIVE / "catalog.json"


def _season_sort_key(season: dict) -> tuple[int, int, str]:
    label = season.get("season_label", "")
    match = re.search(r"(Spring|Autumn|Winter)\s+(\d{4})", label, re.I)
    if not match:
        return (0, 0, str(season.get("season_id", "")))
    term, year = match.group(1).casefold(), int(match.group(2))
    term_order = {"spring": 3, "autumn": 2, "winter": 1}[term]
    return (year, term_order, str(season.get("season_id", "")))


def _current_seasons() -> list[dict]:
    current = json.loads(CURRENT_CATALOG.read_text(encoding="utf-8"))
    grouped: dict[str, list[dict]] = {}
    for item in current["sections"]:
        code = item["competition_code"]
        grouped.setdefault(code, []).append(item)
    seasons = []
    for code in ("AA", "UA"):
        sections = grouped.get(code, [])
        if not sections:
            continue
        competition = sections[0]["competition_label"].split(" - ", 1)[0]
        label = sections[0]["competition_label"].split(" - ", 1)[1]
        seasons.append({
            "id": f"{code}:current", "competition_code": code,
            "competition_label": competition, "season_id": "current",
            "season_label": label, "season_option_label": label,
            "is_current": True,
            "sections": [{
                **meta,
                "asset_id": meta["section_code"],
                "data_path": f"data/site/sections/{meta['section_code']}.json",
                "source_section_code": meta["section_code"],
                "is_archive": False,
            } for meta in sections],
        })
    return seasons


def build_catalog() -> dict:
    raw = json.loads(RAW_CATALOG.read_text(encoding="utf-8"))
    sections_by_season: dict[tuple[str, str], list[dict]] = {}
    for meta in raw["sections"]:
        key = (meta["competition_code"], meta["season_id"])
        sections_by_season.setdefault(key, []).append(meta)

    archive_seasons = []
    for season in raw["seasons"]:
        if season.get("season_label", "").casefold() in {"current season", "current"}:
            continue
        key = (season["competition_code"], season["season_id"])
        section_rows = sorted(
            sections_by_season.get(key, []),
            key=lambda row: (int(re.search(r"\d+", row["section_label"]).group()) if re.search(r"\d+", row["section_label"]) else 0,
                             row["section_label"].casefold()),
        )
        if not section_rows:
            continue
        competition = "Saturday AM" if season["competition_code"] == "AA" else "Sunday AM"
        same_label_count = sum(
            1 for other in raw["seasons"]
            if other["competition_code"] == season["competition_code"]
            and other["season_label"].casefold() == season["season_label"].casefold()
        )
        option_label = season["season_label"]
        if same_label_count > 1:
            option_label += f" · TROLS {season['season_id']}"
        archive_seasons.append({
            "id": f"{season['competition_code']}:{season['season_id']}",
            "competition_code": season["competition_code"],
            "competition_label": competition,
            "season_id": season["season_id"],
            "season_label": season["season_label"],
            "season_option_label": option_label,
            "is_current": False,
            "sections": [{
                "section_code": meta["section_code"],
                "asset_id": meta["asset_id"],
                "source_section_code": meta["source_section_code"],
                "section_label": meta["section_label"],
                "format": meta["format"],
                "green_ball": meta["green_ball"],
                "is_archive": True,
                "data_path": f"data/archive/site/sections/{meta['asset_id']}.json",
            } for meta in section_rows],
        })

    current = _current_seasons()
    seasons = current + sorted(archive_seasons, key=_season_sort_key, reverse=True)
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Official-as-entered TROLS archive. Ratings use the site's current V3 model.",
        "season_count": len(seasons),
        "section_count": sum(len(row["sections"]) for row in seasons),
        "seasons": seasons,
    }


def write_catalog() -> dict | None:
    if not RAW_CATALOG.exists():
        print("No historical archive is published yet; skipped the History catalogue refresh.")
        return None
    catalog = build_catalog()
    SITE_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    SITE_CATALOG.write_text(json.dumps(catalog, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    return catalog


def write_archive_payloads(raw: dict, *, missing_only: bool = False) -> int:
    SITE_SECTIONS.mkdir(parents=True, exist_ok=True)
    count = 0
    for meta in raw["sections"]:
        path = SITE_SECTIONS / f"{meta['asset_id']}.json"
        if missing_only and path.exists():
            continue
        payload = build_section(meta, sections_dir=ARCHIVE_SECTIONS)
        path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
        count += 1
        print(f"Wrote {meta['asset_id']}: {len(payload['results'])} results, {len(payload['singles'])} singles ratings")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Build static ratings payloads for TROLS history.")
    parser.add_argument("--catalog-only", action="store_true",
                        help="Refresh the current/past season picker without refitting archived sections.")
    parser.add_argument("--missing-only", action="store_true",
                        help="Build payloads only for newly imported historical sections, then refresh the picker.")
    args = parser.parse_args()
    if args.catalog_only and args.missing_only:
        parser.error("--catalog-only and --missing-only cannot be used together")

    count = 0
    if args.catalog_only:
        catalog = write_catalog()
        if catalog is None:
            return
    else:
        raw = json.loads(RAW_CATALOG.read_text(encoding="utf-8"))
        count = write_archive_payloads(raw, missing_only=args.missing_only)
        catalog = write_catalog()
        if catalog is None:
            return
    print(json.dumps({"generated_sections": count, "seasons": catalog["season_count"], "sections": catalog["section_count"]}, indent=2))


if __name__ == "__main__":
    main()
