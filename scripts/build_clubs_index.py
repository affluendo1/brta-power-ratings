"""Build the Clubs tab's small participation index from published BRTA records."""

import gzip
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def build():
    archive = read("data/archive/clubs.json")
    history = read("data/archive/catalog.json")
    current = read("data/current/catalog.json")
    live_keys = {(row["competition_code"], row["season_id"]) for row in current["sections"]}
    seasons = {
        row["section_code"]: season["id"]
        for season in history["seasons"] if not season["is_current"]
        for row in season["sections"]
    }
    records = []
    for code, competition in archive["competitions"].items():
        for club in read(competition["path"])["clubs"]:
            for row in club["entries"]:
                if row["season_id"] == "current" or (code, row["season_id"]) in live_keys:
                    continue
                records.append({
                    **{key: row.get(key) for key in (
                        "season_id", "season_label", "season_order", "section_code",
                        "section_label", "team", "position", "played", "wins", "draws",
                        "losses", "games_for", "games_against", "points", "champion",
                        "finalist", "semifinalist"
                    )},
                    "club": club["name"], "competition": code,
                    "historyKey": seasons.get(row["section_code"]), "current": False,
                })
    for meta in current["sections"]:
        code = meta["section_code"]
        path = meta.get("data_path") or f"data/site/sections/{code}.json"
        payload = read(path)
        for index, row in enumerate(payload["standings"]):
            records.append({
                "club": row["team"], "team": row["team"], "competition": meta["competition_code"],
                "season_id": meta["season_id"], "season_label": meta["season_label"],
                "section_code": code, "section_label": meta["section_label"], "current": True,
                "position": row.get("officialPosition") or index + 1,
                "played": row.get("played"), "wins": row.get("officialWins", row.get("wins")),
                "draws": row.get("officialDraws", row.get("draws")),
                "losses": row.get("officialLosses", row.get("losses")),
                "games_for": row.get("gamesFor"), "games_against": row.get("gamesAgainst"),
                "points": row.get("points"),
            })
    groups = defaultdict(list)
    for row in records:
        groups[row["competition"]].append(row)
    dest = ROOT / "data/archive/club-participation"
    dest.mkdir(parents=True, exist_ok=True)
    for code, rows in groups.items():
        raw = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        (dest / f"{code}.json.gz").write_bytes(gzip.compress(raw, mtime=0))
    print(f"Indexed {len(records)} team entries across {len(groups)} competitions")


if __name__ == "__main__":
    build()
