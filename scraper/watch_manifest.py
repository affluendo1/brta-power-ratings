"""Publish the small schedule index used by the external TROLS watcher."""
import json
from datetime import datetime
from pathlib import Path


def write_manifest(catalog, section_payloads, path=Path("data/site/trols-watch.json")):
    sections = []
    for meta in catalog:
        code = meta["section_code"]
        payload = section_payloads[code]
        dates = set()
        for group in payload.get("upcomingFixtures", []):
            for fixture in group["fixtures"]:
                if fixture["status"] not in {"Scheduled", "Missing Result"}:
                    continue
                date = fixture.get("date") or group.get("date")
                if date:
                    dates.add(datetime.strptime(date, "%d %b %y").date().isoformat())
        for event in meta.get("calendar_events", []):
            if "final" in event["label"].casefold() and event.get("date"):
                dates.add(datetime.strptime(event["date"], "%d %b %y").date().isoformat())
        if dates:
            sections.append([code, meta["competition_code"], meta["season_id"], sorted(dates)])
    path.write_text(json.dumps(sections, separators=(",", ":")) + "\n", encoding="utf-8")
