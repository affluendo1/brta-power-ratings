"""Publish changed current section results without scraping the entire season."""
from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from zlib import crc32
from zoneinfo import ZoneInfo

from requests import RequestException

from . import sync_trols as source

SECTIONS = source.OUT / "sections"
MELBOURNE = ZoneInfo("Australia/Melbourne")
LATE_RESULTS_DAYS = 4
DISCIPLINES = {"singles": source.SINGLES_FIELDS, "doubles": source.DOUBLES_FIELDS}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def due(meta: dict, directory: Path, now: datetime) -> bool:
    """Prioritize match day and outstanding results for four days after play."""
    today = now.date()
    fixtures = source.read_csv(directory / "fixtures.csv")
    resolved = {"Completed", "Bye", "Wash Out", "Forfeit", "Walkover"}
    settled = {
        (row["round"], row["home_team"], row["away_team"])
        for row in fixtures if row["status"] in resolved or "Forfeit" in row["status"]
    }
    recent_pending = False
    draw = source.read_csv(directory / "draw.csv")
    candidates = [*draw, *fixtures, *meta.get("calendar_events", [])]
    for row in candidates:
        if not row.get("date"):
            continue
        try:
            age = (today - datetime.strptime(row["date"], "%d %b %y").date()).days
        except ValueError:
            continue
        if age == 0 and 8 <= now.hour < 23:
            return True
        if 0 <= age <= LATE_RESULTS_DAYS:
            slot = (row.get("round"), row.get("home_team"), row.get("away_team"))
            recent_pending |= slot not in settled
    if recent_pending and 8 <= now.hour < 23:
        return True
    interval = 6 if recent_pending else 12
    bucket = int(now.timestamp()) // 300
    return bucket % interval == crc32(meta["section_code"].encode()) % interval


def signature(row: dict) -> tuple[str, ...]:
    return tuple(str(row.get(field, "")) for field in source.FIXTURE_FIELDS)


def merge(meta: dict, directory: Path) -> dict | None:
    old = source.read_csv(directory / "fixtures.csv")
    section = source._section_results(meta)
    fixtures = section["fixtures"]
    if not fixtures and old:
        raise RuntimeError("Results page was unexpectedly empty")
    before = {row["fixture_id"]: signature(row) for row in old}
    after = {row["fixture_id"]: signature(row) for row in fixtures}
    if len(after) != len(fixtures):
        raise RuntimeError("Duplicate fixture IDs in results page")
    if before == after:
        return None

    completed = {row["fixture_id"]: row for row in fixtures if row["status"] == "Completed"}
    changed = {fid for fid in completed if before.get(fid) != after[fid]}
    for kind in DISCIPLINES:
        section[kind] = [
            row for row in source.read_csv(directory / f"{kind}.csv")
            if row["fixture_id"] in completed and row["fixture_id"] not in changed
        ]
    for fid in sorted(changed):
        _, singles, doubles = source._scorecard(
            completed[fid], meta["season_id"], meta["format"] == "rubbers", meta["season_label"]
        )
        section["singles"].extend(singles)
        section["doubles"].extend(doubles)
    for kind in DISCIPLINES:
        section[kind].sort(key=lambda row: (int(row["round"]), row["fixture_id"], row["position"]))

    for message in source.validate_saved_results(section, directory):
        print(message)
    section["source_warnings"] = source.validate_dataset(
        fixtures, section["singles"], section["doubles"], meta["section_code"],
        green_ball=meta.get("green_ball", False), allow_total_discrepancies=True,
    )
    section["draw"] = source.attach_draw_ids(source.read_csv(directory / "draw.csv"), fixtures)
    if meta["competition_code"] not in {"AA", "UA"}:
        from .backfill_history import parse_official_ladder

        ladder = source._get(source.BASE + "p_ladders.php", params={
            "daytime": meta["competition_code"], "season": meta["season_id"],
            "section": meta["section_code"], "style": "",
        })
        section["official_standings"] = parse_official_ladder(ladder.text)
        if meta.get("official_standings") and not section["official_standings"]:
            raise RuntimeError("Official ladder was unexpectedly empty")
        section["competition_rules"] = source.observed_rules(section)
    print(f"{meta['section_code']}: results changed, fetched {len(changed)} scorecards", flush=True)
    return section


def publish(catalog: dict, changes: dict[str, dict], now: datetime) -> None:
    from generate_site_data import main as generate

    checked = now.astimezone(timezone.utc).isoformat()
    for meta in catalog["sections"]:
        code = meta["section_code"]
        if code not in changes:
            continue
        section = changes[code]
        directory = SECTIONS / code
        source.write_csv(directory / "fixtures.csv", section["fixtures"], source.FIXTURE_FIELDS)
        source.write_csv(directory / "draw.csv", section["draw"], source.DRAW_FIELDS)
        for kind, fields in DISCIPLINES.items():
            source.write_csv(directory / f"{kind}.csv", section[kind], fields)
        warnings = section["source_warnings"]
        meta.update({
            "results_loaded_by_trols": section["results_loaded_by_trols"],
            "fixtures": len(section["fixtures"]),
            "completed_fixtures": sum(row["status"] == "Completed" for row in section["fixtures"]),
            "singles_rubbers": len(section["singles"]),
            "doubles_rubbers": len(section["doubles"]),
            "latest_round": max((int(row["round"]) for row in section["fixtures"]), default=0),
            "source_warnings": warnings,
            "validation": "source discrepancies" if warnings else "passed",
            "competition_rules": section.get("competition_rules"),
            "official_standings": section.get("official_standings", []),
        })
        write_json(directory / "metadata.json", meta)
    write_json(source.OUT / "catalog.json", {**catalog, "synced_at_utc": checked})

    status_path = source.OUT / "sync_status.json"
    status = read_json(status_path)
    previous_completed = status["completed_fixtures"]
    rows = catalog["sections"]
    for key in ("fixtures", "completed_fixtures", "singles_rubbers", "doubles_rubbers"):
        status[key] = sum(row[key] for row in rows)
    warnings = [
        {"section_code": meta["section_code"], "message": warning}
        for meta in rows for warning in meta.get("source_warnings", [])
    ]
    status.update(synced_at_utc=checked, source_warnings=warnings,
                  validation="source discrepancies" if warnings else "passed")
    write_json(status_path, status)
    check = {key: status[key] for key in (
        "sections", "fixtures", "completed_fixtures", "singles_rubbers", "doubles_rubbers", "validation"
    )}
    codes = sorted(changes)
    write_json(source.OUT / "last_check.json", {
        **check, "checked_at_utc": checked, "new_results": True, "changed_sections": codes,
        "last_positive": {"checked_at_utc": checked, "changed_sections": codes,
                          "previous_completed_fixtures": previous_completed,
                          "completed_fixtures": check["completed_fixtures"]},
    })
    generate(rebuild_sections=set(codes))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sections", help="Comma-separated sections for a targeted check")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    catalog = read_json(source.OUT / "catalog.json")
    now = datetime.now(MELBOURNE)
    explicit = set(args.sections.split(",")) if args.sections else None
    targets = [
        meta for meta in catalog["sections"]
        if (meta["section_code"] in explicit if explicit else due(meta, SECTIONS / meta["section_code"], now))
    ]
    if explicit and explicit != {meta["section_code"] for meta in targets}:
        parser.error("One or more selected sections do not exist")
    print(f"Checking {len(targets)} section result indexes", flush=True)
    changes = {}
    successes = 0
    with ThreadPoolExecutor(max_workers=3) as pool:
        for offset in range(0, len(targets), 3):
            batch = targets[offset:offset + 3]
            tasks = [(meta, pool.submit(merge, meta, SECTIONS / meta["section_code"])) for meta in batch]
            back_off = False
            for meta, task in tasks:
                try:
                    section = task.result()
                    successes += 1
                    if section is not None:
                        changes[meta["section_code"]] = section
                except (RequestException, RuntimeError) as error:
                    print(f"::warning::{meta['section_code']}: fast check skipped: {error}", flush=True)
                    back_off |= isinstance(error, RequestException)
            if back_off:
                break
    if explicit and successes != len(targets):
        raise SystemExit("Not all targeted sections could be checked; retry needed")
    if targets and not successes:
        raise SystemExit("No selected section could be checked successfully")
    if changes and not args.dry_run:
        publish(catalog, changes, datetime.now(MELBOURNE))
    print(f"Changed sections: {', '.join(sorted(changes)) or 'none'}")


if __name__ == "__main__":
    main()
