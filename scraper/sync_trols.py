from __future__ import annotations

import csv
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.trols.org.au/brta/"
RESULTS_URL = urljoin(BASE, "results.php")
MATCH_URL = urljoin(BASE, "match_popup.php")
COMPETITION_LABEL = os.getenv("TROLS_COMPETITION", "Sunday AM - Spring 2026")
SECTION_LABEL = os.getenv("TROLS_SECTION", "Sets 6")
OUT = Path(os.getenv("TROLS_OUT", "data/current"))
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

ALIASES = {
    "Geoge Si": "George Si",
}

FIXTURE_FIELDS = [
    "fixture_id","date","round","home_team","away_team","home_rubbers",
    "away_rubbers","home_games","away_games","status","notes"
]
SINGLES_FIELDS = [
    "fixture_id","date","round","home_team","away_team","position",
    "home_player","away_player","winning_player","score","home_games",
    "away_games","status"
]
DOUBLES_FIELDS = [
    "fixture_id","date","round","home_team","away_team","position",
    "home_pair","away_pair","winning_pair","score","home_games",
    "away_games","status"
]

def clean_text(s: str) -> str:
    return " ".join((s or "").replace("\xa0", " ").split())

def clean_team(s: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", clean_text(s)).strip()

def clean_name(s: str) -> str:
    s = clean_text(s)
    s = re.sub(r"^\d+\.\s*", "", s)
    s = re.sub(r"^X\s*\d+\.\s*", "", s)
    return ALIASES.get(s, s)

def direct_cells(tr):
    return tr.find_all(["td","th"], recursive=False)

def choose_option(soup: BeautifulSoup, select_id: str, wanted: str) -> str:
    sel = soup.find("select", id=select_id)
    if not sel:
        raise RuntimeError(f"TROLS did not expose #{select_id}")
    options = [(clean_text(o.get_text()), o.get("value","")) for o in sel.find_all("option")]
    for label, value in options:
        if label.casefold() == wanted.casefold():
            return value
    available = ", ".join(label for label, _ in options if label)
    raise RuntimeError(f"Could not find {wanted!r} in #{select_id}. Available: {available}")

def parse_results_page(html: str):
    soup = BeautifulSoup(html, "html.parser")
    fixtures = []
    current_date = None
    current_round = None
    match_index = 0

    loaded = None
    for span in soup.find_all("span"):
        txt = clean_text(span.get_text(" ", strip=True))
        if txt.startswith("Results Loaded:"):
            loaded = txt.removeprefix("Results Loaded:").strip()
            break

    for tr in soup.find_all("tr"):
        tds = tr.find_all("td", recursive=False)
        if len(tds) == 1 and tds[0].get("colspan") == "9":
            txt = clean_text(tds[0].get_text(" ", strip=True))
            m = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+\d{2}).*?Rd\.\s*(\d+)", txt)
            if m:
                current_date = m.group(1)
                current_round = int(m.group(2))
                match_index = 0
            continue

        if current_date is None or len(tds) not in (3, 9):
            continue

        first = clean_text(tds[0].get_text(" ", strip=True))
        last = clean_text(tds[-1].get_text(" ", strip=True))
        if not first or not last or first.lower().startswith("home team"):
            continue

        match_index += 1
        home = clean_team(first)
        away = clean_team(last)
        match_id = None
        a = tds[0].find("a")
        if a:
            onclick = a.get("onclick", "")
            m = re.search(r"open_match\([^)]*'([^']+)'\s*\)", onclick)
            if m:
                match_id = m.group(1)
            else:
                ids = re.findall(r"'(UA\d+)'", onclick)
                if ids:
                    match_id = ids[-1]
        if not match_id:
            match_id = f"UA009{current_round:02d}{match_index}"

        if len(tds) == 3:
            status_text = clean_text(tds[1].get_text(" ", strip=True))
            status = "Wash Out" if "Wash Out" in status_text else "Missing Result" if "Missing Result" in status_text else status_text
            fixture = {
                "fixture_id": match_id, "date": current_date, "round": current_round,
                "home_team": home, "away_team": away, "home_rubbers": "",
                "away_rubbers": "", "home_games": "", "away_games": "",
                "status": status, "notes": "No individual scorecard / no rubbers recorded" if status == "Wash Out" else "TROLS marked Missing Result; no scorecard available"
            }
        else:
            try:
                hr = int(clean_text(tds[2].get_text()))
                hg = int(clean_text(tds[3].get_text()))
                ar = int(clean_text(tds[6].get_text()))
                ag = int(clean_text(tds[7].get_text()))
            except ValueError as e:
                raise RuntimeError(f"Could not parse fixture row: {tr.get_text(' ', strip=True)}") from e
            fixture = {
                "fixture_id": match_id, "date": current_date, "round": current_round,
                "home_team": home, "away_team": away, "home_rubbers": hr,
                "away_rubbers": ar, "home_games": hg, "away_games": ag,
                "status": "Completed", "notes": ""
            }
        fixtures.append(fixture)

    fixtures.sort(key=lambda x: (int(x["round"]), x["fixture_id"]))
    if not fixtures:
        raise RuntimeError("No Section 6 fixtures were parsed from TROLS")
    return fixtures, loaded

def parse_roster(table):
    names = []
    for tr in table.find_all("tr"):
        txt = clean_text(tr.get_text(" ", strip=True))
        if txt:
            names.append(clean_name(txt))
    return names

def pair_from_code(players, code: str) -> str:
    indexes = [int(x) - 1 for x in code.split("+")]
    if len(indexes) != 2 or any(i < 0 or i >= len(players) for i in indexes):
        raise RuntimeError(f"Bad doubles pairing code {code!r} for roster {players}")
    return " / ".join(players[i] for i in indexes)

def parse_scorecard(html: str, fixture: dict):
    soup = BeautifulSoup(html, "html.parser")
    root = soup.find("table", attrs={"width": "99%"})
    if root is None:
        raise RuntimeError(f"No scorecard table for {fixture['fixture_id']}; response starts: {clean_text(html[:500])}")
    container = root.find("tbody", recursive=False) or root
    outer = container.find_all("tr", recursive=False)
    if len(outer) < 2:
        raise RuntimeError(f"Malformed scorecard for {fixture['fixture_id']}")

    team_cells = outer[0].find_all("td", recursive=False)
    home_team = clean_team(team_cells[0].get_text(" ", strip=True))
    away_team = clean_team(team_cells[-1].get_text(" ", strip=True))
    if home_team != fixture["home_team"] or away_team != fixture["away_team"]:
        raise RuntimeError(
            f"Team mismatch {fixture['fixture_id']}: list has {fixture['home_team']} v {fixture['away_team']}, "
            f"scorecard has {home_team} v {away_team}"
        )

    nested = outer[1].find_all("table")
    if len(nested) != 3:
        raise RuntimeError(f"Expected 3 nested scorecard tables for {fixture['fixture_id']}, found {len(nested)}")
    home_players = parse_roster(nested[0])
    away_players = parse_roster(nested[2])
    if len(home_players) != 4 or len(away_players) != 4:
        raise RuntimeError(f"Expected four players per team for {fixture['fixture_id']}: {home_players} / {away_players}")

    score_rows = nested[1].find_all("tr")
    rubber_rows = score_rows[:6]
    if len(rubber_rows) != 6:
        raise RuntimeError(f"Expected six rubbers for {fixture['fixture_id']}")

    singles, doubles = [], []
    for i, tr in enumerate(rubber_rows):
        cells = [clean_text(td.get_text(" ", strip=True)) for td in tr.find_all("td")]
        if len(cells) != 3:
            raise RuntimeError(f"Malformed rubber row in {fixture['fixture_id']}: {cells}")
        home_code, score, away_code = cells
        sm = re.fullmatch(r"(\d+)\s*-\s*(\d+)", score)
        if not sm:
            raise RuntimeError(f"Unsupported score {score!r} in {fixture['fixture_id']}")
        hg, ag = map(int, sm.groups())

        base = {
            "fixture_id": fixture["fixture_id"], "date": fixture["date"], "round": fixture["round"],
            "home_team": home_team, "away_team": away_team, "position": f"No. {i+1 if i < 4 else i-3}",
            "score": f"{hg}-{ag}", "home_games": hg, "away_games": ag, "status": "Completed"
        }
        if i < 4:
            hp = home_players[int(home_code) - 1]
            ap = away_players[int(away_code) - 1]
            singles.append({
                **base, "home_player": hp, "away_player": ap,
                "winning_player": hp if hg > ag else ap
            })
        else:
            hp = pair_from_code(home_players, home_code)
            ap = pair_from_code(away_players, away_code)
            doubles.append({
                **base, "home_pair": hp, "away_pair": ap,
                "winning_pair": hp if hg > ag else ap
            })
    return singles, doubles

def write_csv(path: Path, rows, fields):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

def count_existing(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open(encoding="utf-8") as f:
        return max(0, sum(1 for _ in f) - 1)

def main():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Referer": RESULTS_URL})

    first = s.get(RESULTS_URL, timeout=30)
    first.raise_for_status()
    soup = BeautifulSoup(first.text, "html.parser")
    daytime = choose_option(soup, "daytime", COMPETITION_LABEL)

    second = s.post(RESULTS_URL, data={"daytime": daytime, "section": "", "which": "0", "style": ""}, timeout=30)
    second.raise_for_status()
    soup2 = BeautifulSoup(second.text, "html.parser")
    section = choose_option(soup2, "section", SECTION_LABEL)

    final = s.post(RESULTS_URL, data={"daytime": daytime, "section": section, "which": "1", "style": ""}, timeout=30)
    final.raise_for_status()
    fixtures, loaded = parse_results_page(final.text)

    singles, doubles = [], []
    completed = [f for f in fixtures if f["status"] == "Completed"]
    for n, fixture in enumerate(completed, 1):
        r = s.get(MATCH_URL, params={"matchid": fixture["fixture_id"], "seasonid": ""}, timeout=30)
        r.raise_for_status()
        ss, dd = parse_scorecard(r.text, fixture)
        singles.extend(ss)
        doubles.extend(dd)
        print(f"[{n:02d}/{len(completed):02d}] {fixture['fixture_id']} {fixture['home_team']} v {fixture['away_team']}")
        time.sleep(0.10)

    # Hard safety gates. A bad scrape must never replace good repository data.
    if len(fixtures) < 32:
        raise RuntimeError(f"Safety gate: only {len(fixtures)} fixtures parsed")
    if len(singles) != 4 * len(completed):
        raise RuntimeError(f"Safety gate: {len(singles)} singles rows for {len(completed)} completed fixtures")
    if len(doubles) != 2 * len(completed):
        raise RuntimeError(f"Safety gate: {len(doubles)} doubles rows for {len(completed)} completed fixtures")

    old_s = count_existing(OUT / "section6_singles_results.csv")
    old_d = count_existing(OUT / "section6_doubles_results.csv")
    if old_s and len(singles) < old_s:
        raise RuntimeError(f"Safety gate: singles shrank from {old_s} to {len(singles)}")
    if old_d and len(doubles) < old_d:
        raise RuntimeError(f"Safety gate: doubles shrank from {old_d} to {len(doubles)}")

    write_csv(OUT / "section6_fixtures.csv", fixtures, FIXTURE_FIELDS)
    write_csv(OUT / "section6_singles_results.csv", singles, SINGLES_FIELDS)
    write_csv(OUT / "section6_doubles_results.csv", doubles, DOUBLES_FIELDS)

    status = {
        "source": RESULTS_URL,
        "competition": COMPETITION_LABEL,
        "section": SECTION_LABEL,
        "section_code": section,
        "results_loaded_by_trols": loaded,
        "synced_at_utc": datetime.now(timezone.utc).isoformat(),
        "fixtures": len(fixtures),
        "completed_fixtures": len(completed),
        "singles_rubbers": len(singles),
        "doubles_rubbers": len(doubles),
        "latest_round": max(int(f["round"]) for f in fixtures),
        "latest_date": max(fixtures, key=lambda f: int(f["round"]))["date"],
        "validation": "passed",
    }
    (OUT / "sync_status.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(status, indent=2))

if __name__ == "__main__":
    main()
