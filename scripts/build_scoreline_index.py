"""Index completed scorelines without sending whole section payloads to browsers."""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCORE = re.compile(r"\[?\d{1,3}-\d{1,3}\]?(?: \[?\d{1,3}-\d{1,3}\]?)*")


def date_key(value):
    for layout in ("%d %b %y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, layout).date().isoformat()
        except (ValueError, TypeError):
            pass
    return ""


def build(paths, output):
    sections = []
    for path in sorted(paths):
        section = json.loads(path.read_text(encoding="utf-8"))
        meta = section["meta"]
        counts = {}
        for group in section.get("results", []):
            for fixture in group["fixtures"]:
                date = fixture.get("date") or group.get("date")
                key = date_key(date)
                for rubber in fixture.get("rubbers", []):
                    if (rubber.get("status") or fixture.get("status")) != "Completed":
                        continue
                    score = " ".join(str(rubber.get("score") or "").replace("–", "-").split())
                    if not SCORE.fullmatch(re.sub(r" \[TB [WL]\]$", "", score, flags=re.IGNORECASE)):
                        continue
                    tokens = re.findall(r"\[\d{1,3}-\d{1,3}\]|\d{1,3}-\d{1,3}", score)
                    for position, token in enumerate(tokens):
                        home, away = map(int, token.strip("[]").split("-"))
                        if home == away:
                            continue
                        deciding = token.startswith("[") or (position == 2 and max(home, away) >= 10)
                        normalized = f"{max(home, away)}-{min(home, away)}"
                        if deciding:
                            normalized = f"[{normalized}]"
                        item = counts.setdefault(normalized, [0, None, None])
                        item[0] += 1
                        if not key:
                            continue
                        example = [key, date, fixture.get("round", group["round"]), fixture.get("stage", group.get("stage")),
                                   fixture["home"], fixture["away"], fixture["fixtureId"]]
                        if item[1] is None or example[0] < item[1][0]:
                            item[1] = example
                        if item[2] is None or example[0] >= item[2][0]:
                            item[2] = example
        if counts:
            sections.append([meta["season_label"], meta["competition_code"], meta["section_label"],
                             sum(item[0] for item in counts.values()), counts])
    by_score = {}
    total = 0
    breakdown = {}
    competition_totals = {}
    for season, competition, section, size, counts in sections:
        total += size
        competition_totals[competition] = competition_totals.get(competition, 0) + size
        for score, (count, earliest, latest) in counts.items():
            entry = by_score.setdefault(score, [0, None, None, None])
            entry[0] += count
            by_competition = breakdown.setdefault(score, {})
            by_competition[competition] = by_competition.get(competition, 0) + count
            if earliest and (entry[1] is None or earliest[0] < entry[1][0]):
                entry[1] = [*earliest, season, competition, section]
            if latest and (entry[2] is None or latest[0] >= entry[2][0]):
                entry[2] = [*latest, season, competition, section]
            best = entry[3]
            if size >= 40 and (best is None or count * best[4] > best[3] * size or
                              (count * best[4] == best[3] * size and size > best[4])):
                entry[3] = [season, competition, section, count, size]
    index = {"sections": len(sections), "total": total, "scores": by_score, "breakdown": breakdown, "competitionTotals": competition_totals}
    output.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(sections)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scope", choices=("archive", "current"), nargs="?")
    scope = parser.parse_args().scope
    for name, directory in (("archive", "data/archive/site/sections"), ("current", "data/site/sections")):
        if not scope or scope == name:
            print(build((ROOT / directory).glob("*.json"), ROOT / "data" / name / "scorelines.json"), name, "sections indexed")
