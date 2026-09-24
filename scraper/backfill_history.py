"""Import TROLS Saturday/Sunday AM archive seasons into a reproducible store.

The current season remains owned by ``sync_trols.py``. This importer captures
every other season offered by TROLS' Past Results selectors, including its
official season IDs, published ladders, official team draw order and playoff
scorecards. It never invents dates for undated semifinal/final records.
"""
from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scraper import sync_trols as sync

BASE = sync.BASE
RESULTS_URL = sync.RESULTS_URL
FIXTURE_URL = sync.FIXTURE_URL
MATCH_URL = sync.MATCH_URL
LADDER_URL = urljoin(BASE, "p_ladders.php")
OUT = Path(os.getenv("TROLS_HISTORY_OUT", "data/archive"))
WORKERS = max(1, min(int(os.getenv("TROLS_HISTORY_WORKERS", "5")), 8))
ALLOW_SHRINK = os.getenv("TROLS_ALLOW_HISTORY_SHRINK") == "1"
DAYTIMES = {"AA": "Saturday AM", "UA": "Sunday AM"}
CURRENT_LABELS = {"current season", "current"}


def parse_official_ladder(html: str) -> list[dict]:
    """Parse the final TROLS ladder, retaining source order, points and %."""
    soup = BeautifulSoup(html, "html.parser")
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        header_index = None
        for i, row in enumerate(rows):
            cells = [sync.clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"], recursive=False)]
            lowered = [value.casefold().rstrip(".") for value in cells]
            if "pts" in lowered and ("%" in lowered or "percentage" in lowered):
                header_index = i
                break
        if header_index is None:
            continue
        entries = []
        for row in rows[header_index + 1:]:
            cells = [sync.clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"], recursive=False)]
            if len(cells) < 4 or not cells[0] or cells[0].casefold() in {"bye", "total"}:
                continue
            try:
                wins = float(cells[1])
                points = float(cells[2])
                percentage = float(cells[3].replace("%", ""))
            except ValueError:
                continue
            position = len(entries) + 1
            entries.append({
                "position": position,
                "team": sync.clean_team(cells[0]),
                "wins": int(wins) if wins.is_integer() else wins,
                "points": int(points) if points.is_integer() else points,
                "percentage": percentage,
                "marker": cells[4] if len(cells) > 4 else "",
            })
        if entries:
            return entries
    return []


def discover_seasons(daytime: str) -> list[dict]:
    response = sync._post(RESULTS_URL, {"which": "0", "style": "", "daytime": daytime})
    options = sync.select_options(BeautifulSoup(response.text, "html.parser"), "season")
    if not options:
        raise RuntimeError(f"TROLS exposed no past seasons for {daytime}")
    seasons = []
    seen = set()
    for label, season_id in options:
        if label.casefold() in CURRENT_LABELS:
            continue  # Spring 2026 current data is refreshed by the live sync.
        if season_id in seen:
            continue
        seen.add(season_id)
        seasons.append({"competition_code": daytime, "season_id": season_id, "season_label": label})
    return seasons


def discover_season_sections(daytime: str, season_id: str) -> list[dict]:
    response = sync._post(RESULTS_URL, {
        "which": "0", "style": "", "daytime": daytime, "season": season_id,
    })
    options = [(label, code) for label, code in sync.select_options(BeautifulSoup(response.text, "html.parser"), "section")
               if re.fullmatch(r"(?:AA|UA)\d{3}", code)]
    if not options:
        raise RuntimeError(f"TROLS exposed no sections for {daytime} season {season_id}")
    return [{"source_section_code": code, "section_label": label} for label, code in options]


def _results(meta: dict) -> dict:
    response = sync._post(RESULTS_URL, {
        "which": "1", "style": "", "daytime": meta["competition_code"],
        "season": meta["season_id"], "section": meta["source_section_code"],
    })
    fixtures, loaded = sync.parse_results_page(response.text, meta["source_section_code"])
    return {**meta, "fixtures": fixtures, "results_loaded_by_trols": loaded}


def _draw(meta: dict) -> list[dict]:
    response = sync._post(FIXTURE_URL, {
        "which": "1", "style": "", "daytime": meta["competition_code"],
        "season": meta["season_id"], "section": meta["source_section_code"],
    })
    teams = sync.select_options(BeautifulSoup(response.text, "html.parser"), "team")
    draw = []
    for team_label, team_code in teams:
        if not team_code:
            continue
        result = sync._post(FIXTURE_URL, {
            "which": "2", "style": "", "daytime": meta["competition_code"],
            "season": meta["season_id"], "section": meta["source_section_code"],
            "team": team_code,
        })
        draw.extend(sync.parse_draw_page(result.text, meta["source_section_code"]))
    unique = {(int(row["round"]), row["date"], row["home_team"], row["away_team"]): row for row in draw}
    return sorted(unique.values(), key=lambda row: (int(row["round"]), row["home_team"].casefold()))


def _result_draw_fallback(fixtures: list[dict]) -> list[dict]:
    """Use TROLS' own ordered Results rows if an old season has no draw page."""
    return [{
        "draw_id": str(row["fixture_id"]), "date": row.get("date", ""),
        "round": int(row["round"]), "stage": row.get("stage", "regular"),
        "round_label": row.get("round_label", ""), "home_team": row["home_team"],
        "away_team": row["away_team"], "fixture_id": row["fixture_id"],
    } for row in fixtures if row.get("home_team") != "Bye" and row.get("away_team") != "Bye"]


def _ladder(meta: dict) -> list[dict]:
    response = sync._get(LADDER_URL, params={
        "daytime": meta["competition_code"], "season": meta["season_id"],
        "section": meta["source_section_code"], "style": "",
    })
    return parse_official_ladder(response.text)


def _asset_id(meta: dict) -> str:
    return f"{meta['season_id']}-{meta['source_section_code']}"


def _safe_filename(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-")
    if not value:
        raise ValueError("Empty archive asset ID")
    return value


def _scorecards(section: dict) -> None:
    fixtures = section["fixtures"]
    singles, doubles = [], []
    done = 0
    for fixture in fixtures:
        if fixture["status"] != "Completed":
            continue
        response = sync._get(MATCH_URL, params={"matchid": fixture["fixture_id"], "seasonid": section["season_id"]})
        singles_rows, doubles_rows = sync.parse_scorecard(response.text, fixture)
        singles.extend(singles_rows)
        doubles.extend(doubles_rows)
        done += 1
    section["singles"], section["doubles"] = singles, doubles
    section["draw"] = sync.attach_draw_ids(section.get("draw", []), fixtures)
    draw_keys = {(int(x["round"]), x["home_team"], x["away_team"]) for x in section["draw"]}
    # TROLS' draw page normally contains regular fixtures only. Add actual
    # playoff fixtures directly from the published results page, preserving
    # official match IDs, team order, status and any date TROLS supplies.
    for fixture in fixtures:
        if fixture.get("stage") == "regular":
            continue
        key = (int(fixture["round"]), fixture["home_team"], fixture["away_team"])
        if key not in draw_keys:
            section["draw"].append({
                "draw_id": f"draw-{_safe_filename(section['asset_id']).lower()}-{fixture['fixture_id']}",
                "date": fixture.get("date", ""), "round": int(fixture["round"]),
                "stage": fixture.get("stage", "regular"), "round_label": fixture.get("round_label", ""),
                "home_team": fixture["home_team"], "away_team": fixture["away_team"],
                "fixture_id": fixture["fixture_id"],
            })
    section["draw"].sort(key=lambda row: (int(row["round"]), row["home_team"].casefold(), row["away_team"].casefold()))


def _fetch_section(meta: dict) -> dict:
    section = _results(meta)
    section["asset_id"] = _asset_id(meta)
    try:
        section["draw"] = _draw(meta)
        section["draw_source"] = "TROLS Fixtures"
    except RuntimeError as error:
        if "No official fixture table" not in str(error):
            raise
        section["draw"] = _result_draw_fallback(section["fixtures"])
        section["draw_source"] = "TROLS Results order (fixture page unavailable)"
    section["official_standings"] = _ladder(meta)
    _scorecards(section)
    sync.validate_dataset(
        section["fixtures"], section["singles"], section["doubles"],
        section["source_section_code"], green_ball=meta["green_ball"],
    )
    return section


def _load_all_sections() -> tuple[list[dict], list[dict]]:
    requests = []
    season_rows = []
    for daytime in DAYTIMES:
        for season in discover_seasons(daytime):
            season_rows.append(season)
            sections = discover_season_sections(daytime, season["season_id"])
            for section in sections:
                section.update(season)
                section.update({
                    "competition_label": f"{DAYTIMES[daytime]} - {season['season_label']}",
                    "format": "rubbers" if section["section_label"].casefold().startswith("rubbers") else "sets",
                    "green_ball": "green ball" in section["section_label"].casefold(),
                    "is_archive": True,
                })
                requests.append(section)
    required_earliest = {"UA": "spring 2009", "AA": "winter 2012"}
    for daytime, earliest in required_earliest.items():
        published = [row["season_label"].casefold() for row in season_rows if row["competition_code"] == daytime]
        if not published or earliest not in published:
            raise RuntimeError(f"TROLS archive coverage check failed for {DAYTIMES[daytime]}: expected {earliest}")
    if not requests:
        raise RuntimeError("No historical sections found on TROLS")
    print(f"Discovered {len(season_rows)} archive seasons and {len(requests)} sections")
    results = []
    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(_fetch_section, meta): meta for meta in requests}
        for index, future in enumerate(as_completed(futures), 1):
            meta = futures[future]
            try:
                item = future.result()
            except Exception as error:
                failures.append((meta, error))
                print(f"  [{index}/{len(requests)}] FAILED {_asset_id(meta)}: {error}")
                continue
            results.append(item)
            print(f"  [{index}/{len(requests)}] {item['asset_id']}: {len(item['fixtures'])} fixtures, {len(item['singles'])} singles")
    if failures:
        details = "\n".join(
            f"- {_asset_id(meta)} ({meta['competition_label']}): {error}"
            for meta, error in failures
        )
        raise RuntimeError(
            f"Historical import stopped: {len(failures)} of {len(requests)} sections failed; "
            f"no archive files were written. Failures:\n{details}"
        )
    results.sort(key=lambda item: (item["competition_code"], item["season_label"], item["source_section_code"]))
    return results, season_rows


def _write_section(section: dict) -> dict:
    asset = _safe_filename(section["asset_id"])
    folder = OUT / "sections" / asset
    old_fixture_count = sync.count_existing(folder / "fixtures.csv")
    old_single_count = sync.count_existing(folder / "singles.csv")
    old_double_count = sync.count_existing(folder / "doubles.csv")
    if not ALLOW_SHRINK and folder.exists():
        counts = (len(section["fixtures"]), len(section["singles"]), len(section["doubles"]))
        old = (old_fixture_count, old_single_count, old_double_count)
        if any(before and after < before for before, after in zip(old, counts)):
            raise RuntimeError(f"Historical dataset shrank. Manual review required: {asset} {old} -> {counts}")
    sync.write_csv(folder / "fixtures.csv", section["fixtures"], sync.FIXTURE_FIELDS)
    sync.write_csv(folder / "draw.csv", section["draw"], sync.DRAW_FIELDS)
    sync.write_csv(folder / "singles.csv", section["singles"], sync.SINGLES_FIELDS)
    sync.write_csv(folder / "doubles.csv", section["doubles"], sync.DOUBLES_FIELDS)
    meta = {key: section[key] for key in (
        "asset_id", "competition_code", "competition_label", "season_id", "season_label",
        "source_section_code", "section_label", "format", "green_ball", "is_archive",
        "results_loaded_by_trols", "official_standings",
    )}
    meta.update({
        "section_code": asset,
        "fixtures": len(section["fixtures"]),
        "completed_fixtures": sum(row["status"] == "Completed" for row in section["fixtures"]),
        "draw_fixtures": len(section["draw"]),
        "singles_rubbers": len(section["singles"]),
        "doubles_rubbers": len(section["doubles"]),
        "latest_round": max((int(row["round"]) for row in section["fixtures"]), default=0),
        "regular_season_rounds": 14,
        "validation": "passed",
        "source": "TROLS Past Results and Past Ladders",
        "draw_source": section.get("draw_source", "TROLS Fixtures"),
    })
    (folder / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta


def main() -> None:
    started = time.monotonic()
    sections, seasons = _load_all_sections()
    metadata = [_write_section(section) for section in sections]
    document = {
        "source": "https://www.trols.org.au/brta/p_results.php",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "season_count": len(seasons), "section_count": len(metadata),
        "fixture_count": sum(row["fixtures"] for row in metadata),
        "completed_fixtures": sum(row["completed_fixtures"] for row in metadata),
        "singles_rubbers": sum(row["singles_rubbers"] for row in metadata),
        "doubles_rubbers": sum(row["doubles_rubbers"] for row in metadata),
        "seasons": seasons,
        "sections": metadata,
        "validation": "passed",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "raw_catalog.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in document.items() if key not in {"seasons", "sections"}}, indent=2))
    print(f"Historical import completed in {time.monotonic() - started:.1f}s")


if __name__ == "__main__":
    main()
