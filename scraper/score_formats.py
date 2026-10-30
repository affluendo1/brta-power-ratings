"""Typed tennis scores. Unknown tiebreak points must never become fake games.

The bracketed [TB W]/[TB L] code is oriented to the home side. It preserves
the only information supplied by legacy TROLS 7-6 deciding-tiebreak entries.
"""
import re

MATCH_TIEBREAK_WEIGHTS = {"RM3": 1.0, "RM3b": 2.0}


def junior_decider_code(meta, discipline="singles"):
    """Only infer source codes under verified junior rules, not adult sets."""
    year = re.search(r"\b(20\d{2})", str(meta.get("season_label") or meta.get("date", "")))
    short_date = re.search(r"\b\d{1,2} [A-Za-z]{3} (\d{2})$", str(meta.get("date", "")))
    year_value = int(year[1]) if year else 2000 + int(short_date[1]) if short_date else None
    code = meta.get("competition_code") or str(meta.get("fixture_id", ""))[:2]
    return (code in {"AA", "UA"} and discipline.lower() == "singles"
            and (meta.get("format") == "rubbers" or str(meta.get("section_label", "")).lower().startswith("rubbers"))
            and bool(year_value is not None and year_value >= 2026))


def parse_score(text, *, outcome_code=False):
    text = str(text or "")
    sets = [{"h": int(m[2]), "a": int(m[3]), "mt": bool(m[1]), "unknown": False}
            for m in re.finditer(r"(\[)?\s*(\d+)\s*[-–:]\s*(\d+)(?:\([^)]*\))?\s*\]?", text)]
    if len(sets) == 3:
        first, last = sets[:2], sets[-1]
        split = sum(s["h"] > s["a"] for s in first) == 1 and all(s["h"] != s["a"] for s in first)
        if split and max(last["h"], last["a"]) >= 10 and all(max(s["h"], s["a"]) <= 7 for s in first):
            last["mt"] = True
        if split and outcome_code and all((max(s["h"],s["a"]) == 6 and min(s["h"],s["a"]) <= 4) or (max(s["h"],s["a"]) == 7 and min(s["h"],s["a"]) in {5,6}) for s in first) and sorted([last["h"], last["a"]]) == [6, 7]:
            last.update(mt=True, unknown=True, winner="home" if last["h"] > last["a"] else "away", h=None, a=None)
    marker = re.search(r"\[TB\s+([WL])\]", text, re.I)
    if marker:
        sets.append({"h": None, "a": None, "mt": True, "unknown": True, "winner": "home" if marker[1].upper() == "W" else "away"})
    for s in sets:
        if not s.get("winner") and s["h"] != s["a"]:
            s["winner"] = "home" if s["h"] > s["a"] else "away"
    return sets


def format_score(sets):
    return " ".join(("[TB W]" if s.get("winner") == "home" else "[TB L]") if s.get("unknown")
                    else (f"[{s['h']}-{s['a']}]" if s["mt"] else f"{s['h']}-{s['a']}") for s in sets)


def normalise_frame(frame, meta, discipline="singles"):
    """Keep official fixture totals separate from ordinary-game evidence."""
    out = frame.copy()
    if "score" not in out:
        return out
    for index, row in out.iterrows():
        sets = parse_score(row.get("score", ""), outcome_code=junior_decider_code(meta, discipline))
        if not any(s["mt"] for s in sets):
            continue
        if "source_score" not in out:
            out["source_score"] = ""
        source = row.get("source_score", "")
        out.at[index, "source_score"] = source if isinstance(source, str) and source else str(row["score"])
        out.at[index, "score"] = format_score(sets)
        normal = [s for s in sets if not s["mt"]]
        out.at[index, "home_games"] = sum(s["h"] for s in normal)
        out.at[index, "away_games"] = sum(s["a"] for s in normal)
        out.at[index, "home_sets"] = sum(s.get("winner") == "home" for s in sets)
        out.at[index, "away_sets"] = sum(s.get("winner") == "away" for s in sets)
    return out


def rating_counts(frame, model="RM3", match_tiebreak_weight=None, match_tiebreak_mode=None):
    """Bounded decider evidence; it never changes displayed ordinary games.

    RM3: one outcome unit. RM3b: two units split by actual points if known,
    otherwise awarded by outcome. Extended tiebreaks cannot dominate a fit.
    """
    weight = MATCH_TIEBREAK_WEIGHTS[model] if match_tiebreak_weight is None else float(match_tiebreak_weight)
    if not 0 <= weight <= 20:
        raise ValueError("Match-tiebreak weight must be between 0 and 20")
    mode = match_tiebreak_mode or ("point-share" if model == "RM3b" else "outcome")
    if mode not in {"point-share", "outcome"}:
        raise ValueError("Unknown match-tiebreak evidence mode")
    h = frame["home_games"].astype(float).to_numpy().copy()
    a = frame["away_games"].astype(float).to_numpy().copy()
    for i, score in enumerate(frame.get("score", [])):
        for s in parse_score(score):
            if not s["mt"] or not s.get("winner"):
                continue
            share = s["h"] / (s["h"] + s["a"]) if mode == "point-share" and not s["unknown"] else float(s["winner"] == "home")
            h[i] += weight * share
            a[i] += weight * (1 - share)
    return h, a
