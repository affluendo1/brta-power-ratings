"""Unpublished club directory assembled from official fixture information tables.

Keep source observations rather than picking a possibly wrong contact or venue
when the same club supplies different details to two competitions.
"""
from __future__ import annotations

import re
import unicodedata
from bs4 import BeautifulSoup

COLOURS = set("aqua azure beige black blue brown burgundy charcoal coral cream crimson cyan gold golden gray grey green indigo lime magenta maroon navy orange pink purple red scarlet silver tan teal turquoise violet white yellow".split())
PHONE = re.compile(r"(?<!\d)(?:\+61[\s().-]*[23478]|0[23478])[\d\s().-]{7,16}\d(?!\d)")


def clean(value: str) -> str:
    return " ".join(str(value).replace("\xa0", " ").split())


def club_name(team: str) -> str:
    name = re.sub(r"\s*\(\d{1,2}:\d{2}\)\s*", "", clean(team))
    name = re.sub(r"[\s*†‡]+$", "", name)
    name = re.sub(r"\s+\([A-Z]{2,6}\)$", "", name)
    name = re.sub(r"\s+\d+\.\d{2}$", "", name)
    words = name.split()
    # Black Rock is a place, not a Black-coloured Rock team.
    protected = 2 if name.casefold().startswith("black rock") else 0
    while len(words) > max(1, protected) and (words[-1].casefold().strip("()[]") in COLOURS or words[-1].isdigit()):
        words.pop()
    return " ".join(words)


def club_key(name: str) -> str:
    folded = unicodedata.normalize("NFKD", club_name(name)).encode("ascii", "ignore").decode().casefold()
    return re.sub(r"[^a-z0-9]+", "-", folded).strip("-")


def phone_numbers(text: str) -> list[str]:
    # Local eight-digit clubhouse numbers are published without an area code.
    patterns = PHONE.findall(text)
    patterns += re.findall(r"(?i)(?:ph(?:one)?|tel)\s*:?\s*(\d{4}[ -]?\d{4})(?!\d)", text)
    return list(dict.fromkeys(clean(p) for p in patterns))


def parse_club_information(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    label = soup.find(string=lambda s: s and clean(s).casefold() == "section information")
    if label is None:
        return []
    table = label.find_parent("table")
    records, current = [], None
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"], recursive=False)
        texts = [clean(c.get_text(" ", strip=True)) for c in cells]
        if len(cells) >= 2 and texts[0].isdigit() and texts[1]:
            time = re.search(r"\((\d{1,2}:\d{2})\)", texts[1])
            team = re.sub(r"\s*\(\d{1,2}:\d{2}\)", "", texts[1]).strip()
            raw_team=team
            playing=re.search(r"(?i)\bplaying\s*(?:at\b|@)\s*:?\s*(.+)",team)
            team=re.split(r"(?i)\bplaying\s*(?:at\b|@)",team)[0].strip()
            current = {"raw_team":raw_team,"team": team, "club": club_name(team), "team_number": int(texts[0]),
                       "start_time": time.group(1) if time else None,
                       "venue_lines": [], "clubhouse_phones": [], "contacts": [], "playing_at": (playing.group(1).strip() if playing else None)}
            if len(cells) > 2:
                current["melway"] = texts[2] or None
                # Parse only numeric map arguments; never execute the source script.
                link = cells[2].find("a")
                coordinates = re.search(r"pop_map\(.*?,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)", link.get("onclick", "") if link else "")
                if coordinates:
                    lat, lng = map(float, coordinates.groups())
                    if -90 <= lat <= 90 and -180 <= lng <= 180:
                        current["coordinates"] = {"latitude": lat, "longitude": lng}
            records.append(current)
        elif current and len(cells) >= 2:
            content = " ".join(texts[1:])
            contact = re.match(r"(?i)(club|team)\s+contact\s*:\s*(.*)", texts[1])
            if contact:
                name = re.split(r"(?i)\b(?:mob|ph|phone|tel)\s*:", contact.group(2))[0].strip()
                for number in phone_numbers(name):
                    name = name.replace(number, "").strip()
                current["contacts"].append({"role": contact.group(1).lower(), "name": name,
                                             "phones": phone_numbers(content)})
            elif content:
                for cell in cells[1:]:
                    for line in cell.get_text("\n", strip=True).splitlines():
                        line = clean(line)
                        if re.search(r"(?i)club\s*house|clubhouse|\b(?:ph|phone|tel)\s*:", line):
                            current["clubhouse_phones"].extend(phone_numbers(line))
                        elif line:
                            current["venue_lines"].append(line)
    for record in records:
        record["clubhouse_phones"] = list(dict.fromkeys(record["clubhouse_phones"]))
    return [record for record in records if record["club"].casefold() not in {"bye", "byes"}]


def build_club_network(sections: list[dict]) -> dict:
    clubs = {}
    covered = []
    for section in sorted(sections, key=lambda s: s["section_code"]):
        records = section.get("club_information", [])
        if records:
            covered.append(section["section_code"])
        source = {key: section[key] for key in ("competition_code", "section_code", "section_label", "season_id", "season_label") if key in section}
        source["url"] = "https://www.trols.org.au/brta/fixture.php"
        for record in records:
            record = {**record, "club": club_name(record["team"])}
            if record["club"].casefold() in {"bye", "byes"}:
                continue
            key = club_key(record["club"])
            if not key:
                raise ValueError("A fixture club has no usable identity")
            club = clubs.setdefault(key, {"id": key, "name": record["club"], "team_names": [], "observations": []})
            if record["team"] not in club["team_names"]:
                club["team_names"].append(record["team"])
            observation = {**record, "source": source}
            if observation not in club["observations"]:
                club["observations"].append(observation)
    return {"version": 1, "source": "TROLS fixture Section Information", "sections": covered,
            "clubs": [clubs[key] for key in sorted(clubs)]}
