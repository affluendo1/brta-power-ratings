from __future__ import annotations
import json, math
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import expit

from model import (
    GAME_SCALE, HALF_LIFE_DAYS, L2, DISPLAY_CENTRE, DISPLAY_SCALE,
    MIN_MATCHES, MIN_DOUBLES_MATCHES, centred_covariance, fit_power_ratings,
)

DATA_DIR = Path("data/current")
SECTIONS_DIR = DATA_DIR / "sections"
SITE_SECTIONS_DIR = Path("data/site/sections")
OUT = Path("data.js")
DEFAULT_SECTION = "UA009"
INDIVIDUAL_DOUBLES_MIN = 4
INDIVIDUAL_DOUBLES_MIN_PARTNERS = 2
# A player whose loading on an exact unidentifiable direction exceeds this is
# not publishable as an independently ranked doubles contributor.  This is a
# structural data check, not a judgement of playing ability.
IDENTIFIABILITY_EXPOSURE_THRESHOLD = 0.05
# Conditional pair effects are deliberately much more strongly shrunk than
# player effects. They are exploratory diagnostics, not a fourth leaderboard.
PAIR_SYNERGY_L2 = 50.0

def canonical_pair(value: str) -> str:
    names = [x.strip() for x in str(value).split("/") if x.strip()]
    return " / ".join(sorted(names, key=str.casefold))

def pair_members(value: str):
    names = [x.strip() for x in str(value).split("/") if x.strip()]
    if len(names) != 2:
        raise ValueError(f"Expected two players in pair: {value!r}")
    return names

def parse_dates(df):
    out = df.copy()
    out["match_date"] = pd.to_datetime(out["date"], format="%d %b %y", errors="coerce")
    if out["match_date"].isna().any():
        raise ValueError("All published rating rows must have real dates")
    return out


def doubles_identifiability(design: np.ndarray) -> tuple[int, np.ndarray]:
    """Return rank and each player's exposure to an exact extra nullspace.

    A common shift is always unidentifiable in an additive rating model, so a
    connected doubles network should have rank ``n_players - 1``.  Any further
    null direction means that results cannot distinguish a redistribution of
    strength among some players.  We expose that fact instead of allowing the
    L2 prior to make a prior-selected ordering look data-identified.
    """
    n = design.shape[1]
    rank = int(np.linalg.matrix_rank(design))
    _, _, vh = np.linalg.svd(design, full_matrices=True)
    null_basis = vh[rank:].T
    if null_basis.size == 0:
        return rank, np.zeros(n)

    projection = np.eye(n) - np.ones((n, n)) / n
    centred_null = projection @ null_basis
    _, singular_values, vh_null = np.linalg.svd(centred_null, full_matrices=False)
    extra = singular_values > 1e-9
    if not np.any(extra):
        return rank, np.zeros(n)
    extra_basis = centred_null @ vh_null.T[:, extra]
    return rank, np.sqrt(np.sum(extra_basis**2, axis=1))

def team_maps(singles, doubles):
    pc = defaultdict(Counter)
    qc = defaultdict(Counter)
    for _, r in singles.iterrows():
        pc[str(r.home_player)][str(r.home_team)] += 1
        pc[str(r.away_player)][str(r.away_team)] += 1
    for _, r in doubles.iterrows():
        hp = canonical_pair(r.home_pair); ap = canonical_pair(r.away_pair)
        qc[hp][str(r.home_team)] += 1; qc[ap][str(r.away_team)] += 1
        for p in pair_members(r.home_pair): pc[p][str(r.home_team)] += 1
        for p in pair_members(r.away_pair): pc[p][str(r.away_team)] += 1
    return ({p:c.most_common(1)[0][0] for p,c in pc.items()},
            {p:c.most_common(1)[0][0] for p,c in qc.items()})

def website_rows(ratings, teams):
    rows=[]
    for _,r in ratings.sort_values("power",ascending=False).iterrows():
        row={
            "player":str(r.player),"team":teams.get(str(r.player),""),
            "wins":int(r.wins),"losses":int(r.losses),
            "gf":int(r.games_for),"ga":int(r.games_against),"matches":int(r.matches),
            "rating":int(round(r.power)),"se":int(round(r.power_se)),
            "lo":int(round(r.ci95_low)),"hi":int(round(r.ci95_high)),
        }
        for field in ("partners", "partner_count", "network_rank", "identifiability_exposure", "qualified", "ranking_status"):
            if field in r.index:
                value=r[field]
                if isinstance(value, (np.integer,)):
                    value=int(value)
                elif isinstance(value, (np.floating,)):
                    value=float(value)
                row[field]=value
        rows.append(row)
    return rows

def fit_pairs(doubles):
    x=doubles.copy()
    x["home_player"]=x["home_pair"].map(canonical_pair)
    x["away_player"]=x["away_pair"].map(canonical_pair)
    x["winning_player"]=x["winning_pair"].map(canonical_pair)
    return fit_power_ratings_from_df(x)

def fit_power_ratings_from_df(df):
    df=df[df["status"].eq("Completed")].copy()
    if "valid_for_rating" in df:
        df=df[df["valid_for_rating"].astype(str).str.casefold().isin({"true","1","yes"})].copy()
    df=parse_dates(df)
    players=sorted(set(df["home_player"])|set(df["away_player"]))
    ix={p:k for k,p in enumerate(players)}; n=len(players)
    i=df["home_player"].map(ix).to_numpy(); j=df["away_player"].map(ix).to_numpy()
    gi=df["home_games"].astype(float).to_numpy(); gj=df["away_games"].astype(float).to_numpy(); games=gi+gj
    ref=df["match_date"].max(); age=(ref-df["match_date"]).dt.days.to_numpy()
    weight=2.0**(-np.maximum(age,0)/HALF_LIFE_DAYS)
    def fg(theta):
        p=expit((theta[i]-theta[j])/GAME_SCALE); eps=1e-12
        ll=gi*np.log(p+eps)+gj*np.log(1-p+eps)
        objective=weight@ll-(L2/2)*np.sum(theta**2)
        z=-weight*(gi-games*p)/GAME_SCALE
        grad=L2*theta.copy(); np.add.at(grad,i,z); np.add.at(grad,j,-z)
        return -objective,grad
    res=minimize(fg,np.zeros(n),jac=True,method="L-BFGS-B",options={"maxiter":2000,"ftol":1e-12})
    if not res.success: raise RuntimeError(res.message)
    theta=res.x.copy(); theta-=theta.mean()
    power=DISPLAY_CENTRE+DISPLAY_SCALE*theta
    p=expit((theta[i]-theta[j])/GAME_SCALE)
    curv=weight*games*p*(1-p)/(GAME_SCALE**2)
    H=L2*np.eye(n)
    for a,b,c in zip(i,j,curv):
        H[a,a]+=c; H[b,b]+=c; H[a,b]-=c; H[b,a]-=c
    cov=centred_covariance(np.linalg.inv(H)); se=DISPLAY_SCALE*np.sqrt(np.diag(cov))
    rows=[]
    for player in players:
        k=ix[player]; m=df[(df.home_player==player)|(df.away_player==player)]
        wins=gf=ga=0
        for _,r in m.iterrows():
            home=r.home_player==player
            gf+=int(r.home_games if home else r.away_games)
            ga+=int(r.away_games if home else r.home_games)
            wins+=int(str(r.winning_player)==player)
        rows.append(dict(player=player,matches=len(m),wins=wins,losses=len(m)-wins,
                         games_for=gf,games_against=ga,power=power[k],power_se=se[k],
                         ci95_low=power[k]-1.96*se[k],ci95_high=power[k]+1.96*se[k]))
    return pd.DataFrame(rows).sort_values("power",ascending=False)

def fit_individual_doubles(doubles, *, rubbers_format=False):
    df=doubles[doubles["status"].eq("Completed")].copy()
    if "valid_for_rating" in df:
        df=df[df["valid_for_rating"].astype(str).str.casefold().isin({"true","1","yes"})].copy()
    df=parse_dates(df)
    home_members=[pair_members(x) for x in df.home_pair]
    away_members=[pair_members(x) for x in df.away_pair]
    players=sorted(set(sum(home_members+away_members,[])))
    ix={p:k for k,p in enumerate(players)}; n=len(players)
    gi=df.home_games.astype(float).to_numpy(); gj=df.away_games.astype(float).to_numpy(); games=gi+gj
    ref=df.match_date.max(); age=(ref-df.match_date).dt.days.to_numpy()
    weight=2.0**(-np.maximum(age,0)/HALF_LIFE_DAYS)
    design=np.zeros((len(df),n))
    for row,(hs,as_) in enumerate(zip(home_members,away_members)):
        for p in hs: design[row,ix[p]] += .5
        for p in as_: design[row,ix[p]] -= .5
    network_rank, identifiability_exposure = doubles_identifiability(design)
    def fg(theta):
        delta=design@theta
        p=expit(delta/GAME_SCALE); eps=1e-12
        ll=gi*np.log(p+eps)+gj*np.log(1-p+eps)
        objective=weight@ll-(L2/2)*np.sum(theta**2)
        coeff=-weight*(gi-games*p)/GAME_SCALE
        grad=L2*theta+design.T@coeff
        return -objective,grad
    res=minimize(fg,np.zeros(n),jac=True,method="L-BFGS-B",options={"maxiter":3000,"ftol":1e-12})
    if not res.success: raise RuntimeError(res.message)
    theta=res.x.copy(); theta-=theta.mean()
    power=DISPLAY_CENTRE+DISPLAY_SCALE*theta
    p=expit((design@theta)/GAME_SCALE)
    curv=weight*games*p*(1-p)/(GAME_SCALE**2)
    H=L2*np.eye(n)+design.T@(design*curv[:,None])
    cov=centred_covariance(np.linalg.inv(H)); se=DISPLAY_SCALE*np.sqrt(np.diag(cov))
    stats={p:dict(matches=0,wins=0,gf=0,ga=0,partners=set()) for p in players}
    for row,r in df.reset_index(drop=True).iterrows():
        home_win=canonical_pair(r.winning_pair)==canonical_pair(r.home_pair)
        for p0 in home_members[row]:
            s=stats[p0]; s["matches"]+=1; s["wins"]+=int(home_win); s["gf"]+=int(r.home_games); s["ga"]+=int(r.away_games)
            s["partners"].add(next(p for p in home_members[row] if p != p0))
        for p0 in away_members[row]:
            s=stats[p0]; s["matches"]+=1; s["wins"]+=int(not home_win); s["gf"]+=int(r.away_games); s["ga"]+=int(r.home_games)
            s["partners"].add(next(p for p in away_members[row] if p != p0))
    rows=[]
    for p0 in players:
        k=ix[p0]; s=stats[p0]
        partner_count=len(s["partners"])
        structurally_unidentified=identifiability_exposure[k] >= IDENTIFIABILITY_EXPOSURE_THRESHOLD
        # Rubbers divisions have two-player teams. Their doubles evidence is
        # inherently partner-dependent, so hiding every doubles/Overall entry
        # is less useful than publishing the evidence with that limitation
        # explicit. Other formats retain the stricter identifiable-network
        # qualification rule.
        qualified=(s["matches"] >= INDIVIDUAL_DOUBLES_MIN and
                   (rubbers_format or
                    (partner_count >= INDIVIDUAL_DOUBLES_MIN_PARTNERS and
                     not structurally_unidentified)))
        if rubbers_format and s["matches"] >= INDIVIDUAL_DOUBLES_MIN:
            ranking_status="Partner-dependent"
        elif qualified:
            ranking_status="Established"
        elif structurally_unidentified or (s["matches"] >= INDIVIDUAL_DOUBLES_MIN and partner_count < INDIVIDUAL_DOUBLES_MIN_PARTNERS):
            ranking_status="Partner-dependent"
        else:
            ranking_status="Provisional"
        rows.append(dict(player=p0,matches=s["matches"],wins=s["wins"],losses=s["matches"]-s["wins"],
                         games_for=s["gf"],games_against=s["ga"],power=power[k],power_se=se[k],
                         ci95_low=power[k]-1.96*se[k],ci95_high=power[k]+1.96*se[k],
                         partners=partner_count,partner_count=partner_count,network_rank=network_rank,
                         identifiability_exposure=float(identifiability_exposure[k]),
                         qualified=qualified,ranking_status=ranking_status))
    return pd.DataFrame(rows).sort_values("power",ascending=False)


def fit_pair_synergies(doubles, individual_ratings):
    """Estimate a strongly regularised residual pair effect, conditional on players.

    The main individual-doubles rating stays additive.  This auxiliary model
    estimates ``gamma_pair`` in ``pair strength = mean(player strengths) +
    gamma_pair`` while holding the individual estimates fixed.  It avoids
    reassigning individual ability to one-off partnerships and is published as
    an exploratory signal only.
    """
    df=doubles[doubles["status"].eq("Completed")].copy()
    if "valid_for_rating" in df:
        df=df[df["valid_for_rating"].astype(str).str.casefold().isin({"true","1","yes"})].copy()
    df=parse_dates(df)
    df["home_key"]=df["home_pair"].map(canonical_pair)
    df["away_key"]=df["away_pair"].map(canonical_pair)
    pairs=sorted(set(df.home_key)|set(df.away_key))
    index={pair:k for k,pair in enumerate(pairs)}
    i=df.home_key.map(index).to_numpy(); j=df.away_key.map(index).to_numpy()
    home_base=np.array([np.mean([(individual_ratings[p]-DISPLAY_CENTRE)/DISPLAY_SCALE for p in pair_members(pair)]) for pair in df.home_key])
    away_base=np.array([np.mean([(individual_ratings[p]-DISPLAY_CENTRE)/DISPLAY_SCALE for p in pair_members(pair)]) for pair in df.away_key])
    home_games=df.home_games.astype(float).to_numpy(); away_games=df.away_games.astype(float).to_numpy(); games=home_games+away_games
    age=(df.match_date.max()-df.match_date).dt.days.to_numpy()
    weight=2.0**(-np.maximum(age,0)/HALF_LIFE_DAYS)

    def fg(gamma):
        delta=home_base-away_base+gamma[i]-gamma[j]
        p=expit(delta/GAME_SCALE); eps=1e-12
        ll=home_games*np.log(p+eps)+away_games*np.log(1-p+eps)
        objective=weight@ll-(PAIR_SYNERGY_L2/2)*np.sum(gamma**2)
        coefficient=-weight*(home_games-games*p)/GAME_SCALE
        gradient=PAIR_SYNERGY_L2*gamma.copy()
        np.add.at(gradient,i,coefficient); np.add.at(gradient,j,-coefficient)
        return -objective,gradient

    result=minimize(fg,np.zeros(len(pairs)),jac=True,method="L-BFGS-B",options={"maxiter":2000,"ftol":1e-12})
    if not result.success:
        raise RuntimeError(result.message)
    return {pair:float(DISPLAY_SCALE*result.x[k]) for pair,k in index.items()}

def singles_match_array(singles):
    out=[]
    for _,r in singles.sort_values(["round","fixture_id","position"]).iterrows():
        out.append([int(r["round"]),str(r["date"]),str(r["home_player"]),str(r["away_player"]),
                    int(r["home_games"]),int(r["away_games"]),str(r["winning_player"]),str(r["score"]),str(r["fixture_id"])])
    return out

def brta_scoring_rules(meta):
    """Return the 2026 Weekend Junior By-Law scoring constants.

    Rules 2.1–2.4 and 14 use one points system for Sets/Green Ball and a
    smaller one for two-player Rubbers: team-result points plus one point per
    won set and half a point per unfinished set. Keeping this here means Team
    Power and the ladder cannot quietly use different rules.
    """
    rubbers = str(meta.get("format", "")).casefold() == "rubbers" or \
              str(meta.get("section_label", "")).casefold().startswith("rubbers")
    return {
        "format": "rubbers" if rubbers else "sets",
        "team_win": 2.0 if rubbers else 4.0,
        "team_draw": 1.0 if rubbers else 2.0,
        "scheduled_sets": 5 if rubbers else 6,
    }


def _number(value):
    try:
        if pd.isna(value) or str(value).strip() == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def fixture_points(r, rules):
    """Return the official or By-Law-derived ledger for one fixture.

    Completed scorecards retain the published TROLS points. TROLS does not
    include numeric cells for a washout or a full-team forfeit, so Rule 14 is
    applied directly instead of guessing from the most common result score.
    A full forfeit gives every set point to the receiving team, but no game
    percentage (Rule 14.4).
    """
    status = str(r.get("status", ""))
    home, away = _number(r.get("home_points", "")), _number(r.get("away_points", ""))
    if home is not None and away is not None:
        return home, away
    if status == "Wash Out":
        each = rules["team_draw"] + rules["scheduled_sets"] * 0.5
        return each, each
    # TROLS displays "Forfeited To" between home and away when the home side
    # concedes to the visitor, and "Forfeited By" when the visitor concedes.
    if status == "Forfeited To":
        return 0.0, rules["team_win"] + rules["scheduled_sets"]
    if status == "Forfeited By":
        return rules["team_win"] + rules["scheduled_sets"], 0.0
    return None, None


def ladder(fixtures, rules):
    pts=Counter()
    for _,r in fixtures.iterrows():
        h,a=str(r.home_team),str(r.away_team)
        if str(r.status)=="Bye":
            continue
        home_points, away_points=fixture_points(r, rules)
        if home_points is None or away_points is None:
            continue
        pts[h]+=home_points; pts[a]+=away_points
    return pts

def team_rows(single_rows, fixtures, rules):
    pts=ladder(fixtures, rules); by=defaultdict(list)
    for x in single_rows:
        # Team Power measures the active modelled roster, not only the public
        # leaderboard.  Low-sample ratings are already shrunk toward 1500.
        by[x["team"]].append(x["rating"])
    all_teams=sorted((set(fixtures.home_team)|set(fixtures.away_team))-{"Bye"})
    rows=[]
    for t in all_teams:
        vals=by.get(t,[])
        avg=float(np.mean(vals)) if vals else 0.0
        best4=float(np.mean(sorted(vals,reverse=True)[:4])) if vals else 0.0
        ladder_points=float(pts[t])
        rows.append({"team":t,"avg":round(avg,1),"best4":round(best4,1),"modelled":len(vals),
                     "ladder":int(ladder_points) if ladder_points.is_integer() else ladder_points})
    return sorted(rows,key=lambda x:x["avg"],reverse=True)

def reconstructed_standings(fixtures, rules):
    teams = sorted((set(fixtures.home_team) | set(fixtures.away_team))-{"Bye"})
    s = {t: dict(team=t, played=0, wins=0, draws=0, losses=0, rubbersFor=0, rubbersAgainst=0,
                 gamesFor=0, gamesAgainst=0, points=0) for t in teams}
    for _, r in fixtures.iterrows():
        h, a, status = str(r.home_team), str(r.away_team), str(r.status)
        if h=="Bye" or a=="Bye": continue
        home_points, away_points=fixture_points(r, rules)
        if status == "Wash Out":
            # Rule 14 gives both teams draw points plus a half point per
            # uncompleted set. With no scorecard this is a draw, but contributes
            # no game percentage.
            s[h]["played"] += 1; s[a]["played"] += 1
            s[h]["draws"] += 1; s[a]["draws"] += 1
            s[h]["points"] += home_points; s[a]["points"] += away_points
            continue
        if status in {"Forfeited To", "Forfeited By"}:
            s[h]["played"] += 1; s[a]["played"] += 1
            s[h]["points"] += home_points; s[a]["points"] += away_points
            if home_points > away_points:
                s[h]["wins"] += 1; s[a]["losses"] += 1
            else:
                s[a]["wins"] += 1; s[h]["losses"] += 1
            continue
        if status != "Completed":
            continue
        hr, ar = int(r.home_rubbers), int(r.away_rubbers)
        hg, ag = int(r.home_games), int(r.away_games)
        for t in (h, a): s[t]["played"] += 1
        s[h]["rubbersFor"] += hr; s[h]["rubbersAgainst"] += ar
        s[a]["rubbersFor"] += ar; s[a]["rubbersAgainst"] += hr
        s[h]["gamesFor"] += hg; s[h]["gamesAgainst"] += ag
        s[a]["gamesFor"] += ag; s[a]["gamesAgainst"] += hg
        s[h]["points"] += home_points; s[a]["points"] += away_points
        # Rules 2.1–2.4 decide a tied match on sets, then games. Sets-format
        # result rows have one set per rubber, so the published rubber figure
        # is the set total in that format.
        hs, ass=_number(r.home_sets), _number(r.away_sets)
        hs, ass=(hs, ass) if hs is not None and ass is not None else (hr, ar)
        home_win = hs > ass or (hs == ass and hg > ag)
        away_win = ass > hs or (hs == ass and ag > hg)
        if home_win:
            s[h]["wins"] += 1; s[a]["losses"] += 1
        elif away_win:
            s[a]["wins"] += 1; s[h]["losses"] += 1
        else:
            s[h]["draws"] += 1; s[a]["draws"] += 1
    for row in s.values():
        if float(row["points"]).is_integer(): row["points"]=int(row["points"])
    # Rule 14.4 uses games-for / games-against percentage, not the rubber
    # difference. Complete forfeits deliberately have no percentage.
    def standing_key(x):
        total=x["gamesFor"]+x["gamesAgainst"]
        percentage=x["gamesFor"] / total if total else -1.0
        return (-x["points"], -percentage, x["team"])
    return sorted(s.values(), key=standing_key)

def draw_fixtures(draw, fixtures, rules):
    """Return the whole official draw, enriched with published results."""
    result_by_key={(int(r["round"]),str(r.home_team),str(r.away_team)):r for _,r in fixtures.iterrows()}
    by_round=defaultdict(list)
    for _,r in draw.iterrows():
        key=(int(r["round"]),str(r.home_team),str(r.away_team))
        result=result_by_key.get(key)
        fid=str(r.fixture_id) if pd.notna(r.fixture_id) else ""
        fid=fid if fid and fid!="nan" else (str(result.fixture_id) if result is not None else str(r.draw_id))
        item={"home":str(r.home_team),"away":str(r.away_team),"fixtureId":fid,
              "status":str(result.status) if result is not None else "Scheduled"}
        if result is not None:
            hp,ap=fixture_points(result, rules)
            if hp is not None and ap is not None:
                item.update({"homePoints":hp,"awayPoints":ap})
            if str(result.status)=="Completed":
                item.update({"homeRubbers":int(result.home_rubbers),"awayRubbers":int(result.away_rubbers),
                             "homeGames":int(result.home_games),"awayGames":int(result.away_games)})
        by_round[int(r["round"])].append(item)
    return [{"round":rnd,"date":str(draw[draw["round"].astype(int).eq(rnd)].iloc[0]["date"]),
             "fixtures":games,"source":"official TROLS draw"} for rnd,games in sorted(by_round.items())]

def round_rating_history(singles, player_teams):
    """Fit the model as it stood after every published round.

    Each snapshot is deliberately fitted only to results available by that
    round.  It is therefore a genuine historical record rather than today's
    ratings merely relabelled with earlier round numbers.
    """
    history = defaultdict(list)
    rounds = []
    for rnd in sorted({int(value) for value in singles["round"]}):
        observed = singles[singles["round"].astype(int).le(rnd)].copy()
        fitted = website_rows(fit_power_ratings_from_df(observed), player_teams)
        date = str(observed[observed["round"].astype(int).eq(rnd)].iloc[0]["date"])
        for row in fitted:
            history[row["player"]].append([rnd, row["rating"], row["se"], row["matches"]])
        rounds.append({"round": rnd, "date": date, "players": len(fitted)})
    return {"rounds": rounds, "players": dict(history)}



def _short_set_win_probability(game_probability):
    """Return the same short-set win probability used by Prediction Centre."""
    p = float(np.clip(game_probability, 0.0, 1.0))
    q = 1.0 - p
    win = sum(math.comb(5 + lost, lost) * (p ** 6) * (q ** lost) for lost in range(5))
    five_all = math.comb(10, 5) * (p ** 5) * (q ** 5)
    continuation = p * p + 2 * p * q * p
    return win + five_all * continuation


def _singles_match_probability(home_rating, away_rating, rules):
    """Project one singles contest from displayed Power values."""
    rating_denominator = DISPLAY_SCALE * GAME_SCALE
    game_probability = float(expit((home_rating - away_rating) / rating_denominator))
    set_probability = _short_set_win_probability(game_probability)
    if rules["format"] == "rubbers":
        match_probability = (
            set_probability * set_probability
            + 2 * set_probability * (1 - set_probability) * game_probability
        )
    else:
        match_probability = set_probability
    return game_probability, float(match_probability)


def matchup_matrix(single_rows, rules):
    """Precompute every current-model singles matchup in the section.

    The structure is deliberately shaped as a client-ready heatmap contract:
    player metadata is kept in display order and the dense probability array
    uses the same index on both axes, avoiding any browser-side model work.
    """
    players = [
        {
            "player": row["player"],
            "team": row.get("team", ""),
            "rating": int(row["rating"]),
            "matches": int(row["matches"]),
        }
        for row in sorted(single_rows, key=lambda row: (-row["rating"], row["player"].casefold()))
    ]
    probabilities = []
    for home in players:
        row = []
        for away in players:
            if home["player"] == away["player"]:
                probability = 0.5
            else:
                _, probability = _singles_match_probability(home["rating"], away["rating"], rules)
            row.append(round(probability, 4))
        probabilities.append(row)
    return {
        "players": players,
        "probabilities": probabilities,
        "projection": "rubbers-best-of-three" if rules["format"] == "rubbers" else "short-set",
        "ratingDenominator": round(float(DISPLAY_SCALE * GAME_SCALE), 6),
    }


def results_expectation(singles, rating_history, player_teams, rules):
    """Compare actual singles results with genuinely pre-round expectations.

    Each round is evaluated from the latest rating snapshot strictly before
    that round. A player with no previous snapshot starts at the neutral
    section centre. Besides the player summary, match-level rows are retained
    so a client view can drill from an aggregate value back to its source.
    """
    rows = singles[singles["status"].eq("Completed")].copy()
    if "valid_for_rating" in rows:
        rows = rows[rows["valid_for_rating"].astype(str).str.casefold().isin({"true", "1", "yes"})].copy()

    histories = rating_history.get("players", {})
    def rating_before(player, round_number):
        snapshots = histories.get(player, [])
        previous = [snapshot for snapshot in snapshots if int(snapshot[0]) < int(round_number)]
        return int(previous[-1][1]) if previous else int(DISPLAY_CENTRE)

    stats = defaultdict(lambda: {
        "matches": 0,
        "actualWins": 0,
        "expectedWins": 0.0,
        "actualGames": 0,
        "expectedGames": 0.0,
        "totalGames": 0,
    })
    match_rows = []

    sort_columns = [column for column in ("round", "fixture_id", "position") if column in rows.columns]
    for _, row in rows.sort_values(sort_columns).iterrows():
        rnd = int(row["round"])
        home, away = str(row.home_player), str(row.away_player)
        home_rating, away_rating = rating_before(home, rnd), rating_before(away, rnd)
        game_probability, match_probability = _singles_match_probability(home_rating, away_rating, rules)
        home_games, away_games = int(row.home_games), int(row.away_games)
        total_games = home_games + away_games
        winner = str(row.winning_player)

        for player, actual_games, expected_win, expected_game_share in (
            (home, home_games, match_probability, game_probability),
            (away, away_games, 1 - match_probability, 1 - game_probability),
        ):
            item = stats[player]
            item["matches"] += 1
            item["actualWins"] += int(winner == player)
            item["expectedWins"] += expected_win
            item["actualGames"] += actual_games
            item["expectedGames"] += total_games * expected_game_share
            item["totalGames"] += total_games

        match_rows.append({
            "fixtureId": str(row.fixture_id),
            "round": rnd,
            "date": str(row.date),
            "position": str(row.position),
            "home": home,
            "away": away,
            "homeRatingBefore": home_rating,
            "awayRatingBefore": away_rating,
            "homeWinProbability": round(match_probability, 4),
            "homeGameProbability": round(game_probability, 4),
            "winner": winner,
            "score": str(row.score),
        })

    player_rows = []
    for player, values in stats.items():
        expected_wins = round(values["expectedWins"], 3)
        wins_above = round(values["actualWins"] - values["expectedWins"], 3)
        actual_share = 100 * values["actualGames"] / values["totalGames"] if values["totalGames"] else 0.0
        expected_share = 100 * values["expectedGames"] / values["totalGames"] if values["totalGames"] else 0.0
        player_rows.append({
            "player": player,
            "team": player_teams.get(player, ""),
            "matches": values["matches"],
            "actualWins": values["actualWins"],
            "expectedWins": expected_wins,
            "winsAboveExpected": wins_above,
            "actualGameShare": round(actual_share, 1),
            "expectedGameShare": round(expected_share, 1),
            "gameShareAboveExpected": round(actual_share - expected_share, 1),
        })

    player_rows.sort(key=lambda row: (-row["winsAboveExpected"], -row["gameShareAboveExpected"], row["player"].casefold()))
    for rank, row in enumerate(player_rows, 1):
        row["resultsOverExpectationRank"] = rank

    game_order = sorted(player_rows, key=lambda row: (-row["gameShareAboveExpected"], -row["winsAboveExpected"], row["player"].casefold()))
    for rank, row in enumerate(game_order, 1):
        row["gameShareOverExpectationRank"] = rank

    return {
        "players": player_rows,
        "matches": match_rows,
        "method": {
            "ratingState": "latest completed round strictly before each match",
            "unseenPlayerRating": int(DISPLAY_CENTRE),
            "matchProjection": "rubbers-best-of-three" if rules["format"] == "rubbers" else "short-set",
        },
    }


def strength_of_schedule(singles, rating_map, player_teams):
    """Current-model average opponent rating, ranked across every participant."""
    opponents = defaultdict(list)
    for _, row in singles.iterrows():
        home, away = str(row.home_player), str(row.away_player)
        if away in rating_map:
            opponents[home].append(rating_map[away])
        if home in rating_map:
            opponents[away].append(rating_map[home])
    rows = [{"player": player, "team": player_teams.get(player, ""),
             "matches": len(values), "averageOpponent": round(float(np.mean(values)))}
            for player, values in opponents.items() if values]
    rows.sort(key=lambda row: (-row["averageOpponent"], -row["matches"], row["player"].casefold()))
    for rank, row in enumerate(rows, 1):
        row["rank"] = rank
        row["total"] = len(rows)
    return rows


def team_order_evidence(singles, rating_map, player_teams):
    # TROLS marks emergency players separately from the roster number; retain
    # that source ordering signal so inferred future line-ups list emergencies last.
    """Preserve official playing-order continuity for the predictor.

    ``precedence`` records every direct scorecard observation that one player
    was listed above another.  The client only uses this objective evidence;
    it never assumes a subjective preferred doubles partnership.
    """
    appearances = defaultdict(lambda: defaultdict(list))
    emergency_appearances = defaultdict(Counter)
    relations = defaultdict(Counter)
    for _, fixture in singles.groupby("fixture_id"):
        for team_col, player_col, emergency_col in (("home_team", "home_player", "home_emergency"),
                                                    ("away_team", "away_player", "away_emergency")):
            team = str(fixture.iloc[0][team_col])
            listed = []
            for _, row in fixture.iterrows():
                digits = "".join(ch for ch in str(row.position) if ch.isdigit())
                if not digits:
                    continue
                player, position = str(row[player_col]), int(digits)
                if player.startswith("[Unnamed "):
                    # A score is retained for transparency, but TROLS did not
                    # identify this person, so it cannot be a selectable
                    # future-lineup player.
                    continue
                emergency = str(row.get(emergency_col, "")).casefold() in {"true", "1", "yes"}
                appearances[team][player].append(position)
                emergency_appearances[team][player] += int(emergency)
                listed.append((emergency, position, player))
            # TROLS labels emergency entries with X/E but may still retain a
            # nominal roster number.  For an inferred selection order they
            # belong below every listed regular, while their actual scorecard
            # row remains untouched elsewhere in the data.
            listed.sort(key=lambda item: (item[0], item[1], item[2].casefold()))
            # Every later entry in this sorted official row is below the
            # current one.  Recording only this direction matters: adding
            # both directions would erase the precedence evidence entirely.
            for index, (_, _, player_a) in enumerate(listed):
                for _, _, player_b in listed[index + 1:]:
                    relations[team][(player_a, player_b)] += 1
    output = {}
    for team, players in appearances.items():
        roster = []
        for player, positions in players.items():
            emergency_only = emergency_appearances[team][player] == len(positions)
            roster.append({"player": player, "rating": rating_map.get(player, DISPLAY_CENTRE),
                           "appearances": len(positions), "averagePosition": round(float(np.mean(positions)), 2),
                           "emergencyOnly": emergency_only})
        # An actual named substitute is still a real player and keeps their
        # official result, but a player who has only appeared as an emergency
        # never becomes the default No. 1 in a future fixture prediction.
        roster.sort(key=lambda row: (row["emergencyOnly"], row["averagePosition"], -row["appearances"], row["player"].casefold()))
        output[team] = {"players": roster,
                        "precedence": [{"above": a, "below": b, "count": count}
                                       for (a, b), count in relations[team].items()]}
    return output

def sync_meta(metadata, fixtures):
    status = json.loads((DATA_DIR / "sync_status.json").read_text()) if (DATA_DIR / "sync_status.json").exists() else {}
    check = json.loads((DATA_DIR / "last_check.json").read_text()) if (DATA_DIR / "last_check.json").exists() else {}
    updated = None
    raw = metadata.get("results_loaded_by_trols")
    if raw:
        try:
            cleaned = raw.replace("st ", " ").replace("nd ", " ").replace("rd ", " ").replace("th ", " ")
            dt = datetime.strptime(cleaned, "%d %B %y @ %I:%M:%S %p").replace(tzinfo=ZoneInfo("Australia/Melbourne"))
            updated = dt.isoformat()
        except ValueError:
            pass
    return {
        "checkedAt": check.get("checked_at_utc") or status.get("synced_at_utc"),
        "updatedAt": updated,
        "latestRound": metadata.get("latest_round"),
        "validation": metadata.get("validation"),
        "newResultsLastCheck": bool(check.get("new_results", False)),
        "missingFixtures": int(sum(1 for _, r in fixtures.iterrows() if str(r.status) == "Missing Result")),
        "resultsLoadedByTrols": raw,
    }

def round_overview(fixtures, singles, doubles, rating_map, rating_history=None):
    completed_rounds=sorted(set(int(x) for x in singles["round"]))
    latest=max(completed_rounds)
    fx=fixtures[fixtures["round"].astype(int).eq(latest)].copy()
    sr=singles[singles["round"].astype(int).eq(latest)].copy()
    fixture_cards=[]
    for _,r in fx.iterrows():
        card={"fixtureId":str(r.fixture_id),"home":str(r.home_team),"away":str(r.away_team),"status":str(r.status)}
        if str(r.status)=="Completed":
            card.update({"homeRubbers":int(r.home_rubbers),"awayRubbers":int(r.away_rubbers),
                         "homeGames":int(r.home_games),"awayGames":int(r.away_games)})
            home_sets, away_sets=_number(r.home_sets), _number(r.away_sets)
            home_sets, away_sets=(home_sets, away_sets) if home_sets is not None and away_sets is not None else (int(r.home_rubbers), int(r.away_rubbers))
            if home_sets>away_sets or (home_sets==away_sets and int(r.home_games)>int(r.away_games)):
                card["winner"]=str(r.home_team)
            elif away_sets>home_sets or (home_sets==away_sets and int(r.away_games)>int(r.home_games)):
                card["winner"]=str(r.away_team)
            else: card["winner"]="Draw"
        fixture_cards.append(card)
    performances=[]; upsets=[]
    for _,r in sr.iterrows():
        hp,ap=str(r.home_player),str(r.away_player); hg,ag=int(r.home_games),int(r.away_games)
        winner=str(r.winning_player)
        loser=ap if winner==hp else hp
        gf,ga=(hg,ag) if winner==hp else (ag,hg)
        wr,lr=rating_map.get(winner,1500),rating_map.get(loser,1500)
        perf=round(lr+450*math.log((gf+.5)/(ga+.5)))
        item={"winner":winner,"loser":loser,"score":f"{gf}–{ga}","winnerRating":wr,"loserRating":lr,
              "gap":lr-wr,"performance":perf,"margin":gf-ga}
        performances.append(item)
        if wr<lr: upsets.append(item)
    top=max(performances,key=lambda x:x["performance"]) if performances else None
    upset=max(upsets,key=lambda x:x["gap"]) if upsets else None
    dominant=max(performances,key=lambda x:(x["margin"],x["performance"])) if performances else None
    closest=min(performances,key=lambda x:(x["margin"],-x["performance"])) if performances else None
    date=str(sr.iloc[0]["date"]) if len(sr) else str(fx.iloc[0]["date"])
    completed_cards=[card for card in fixture_cards if card["status"]=="Completed"]
    average_margin=round(float(np.mean([abs(int(row.home_games)-int(row.away_games))
                                        for _, row in sr.iterrows()])), 1) if len(sr) else None
    movers=[]
    if rating_history and latest > min(item["round"] for item in rating_history["rounds"]):
        for player, values in rating_history["players"].items():
            current=next((value for value in values if value[0]==latest), None)
            previous=next((value for value in reversed(values) if value[0]<latest), None)
            if current and previous:
                movers.append({"player":player,"change":current[1]-previous[1],"rating":current[1]})
    movers.sort(key=lambda row:(-row["change"],row["player"].casefold()))
    return {"round":latest,"date":date,"fixtures":fixture_cards,"topPerformance":top,
            "biggestUpset":upset,"dominantWin":dominant,"closestMatch":closest,
            "summary":{"completedFixtures":len(completed_cards),"singlesRubbers":len(sr),
                       "doublesRubbers":int(doubles["round"].astype(int).eq(latest).sum()),
                       "averageSinglesMargin":average_margin,
                       "topMover":movers[0] if movers else None,
                       "biggestDrop":min(movers,key=lambda row:row["change"]) if movers else None}}

def result_rounds(fixtures, singles, doubles, rules):
    rubbers=defaultdict(list)
    for discipline,df,home_col,away_col,winner_col,home_emergency_col,away_emergency_col in (
        ("Singles",singles,"home_player","away_player","winning_player","home_emergency","away_emergency"),
        ("Doubles",doubles,"home_pair","away_pair","winning_pair","home_emergencies","away_emergencies"),
    ):
        for _,r in df.iterrows():
            def emergency_value(column):
                value=r.get(column, "")
                if discipline == "Doubles":
                    try:
                        return any(json.loads(value)) if isinstance(value, str) else False
                    except (TypeError, ValueError, json.JSONDecodeError):
                        return False
                return str(value).casefold() in {"true", "1", "yes"}
            rubbers[str(r.fixture_id)].append({
                "type":discipline,"position":str(r.position),"home":str(r[home_col]),"away":str(r[away_col]),
                "winner":str(r[winner_col]),"score":str(r.score),
                "homeEmergency":emergency_value(home_emergency_col),
                "awayEmergency":emergency_value(away_emergency_col),
            })
    by_round=defaultdict(list)
    for _,r in fixtures.iterrows():
        if str(r.home_team)=="Bye" or str(r.away_team)=="Bye": continue
        match={"fixtureId":str(r.fixture_id),"date":str(r.date),"round":int(r["round"]),
               "home":str(r.home_team),"away":str(r.away_team),"status":str(r.status),
               "rubbers":rubbers.get(str(r.fixture_id),[])}
        home_points, away_points=fixture_points(r, rules)
        if home_points is not None and away_points is not None:
            match.update({"homePoints":home_points,"awayPoints":away_points})
        if str(r.status)=="Completed":
            match.update({"homeRubbers":int(r.home_rubbers),"awayRubbers":int(r.away_rubbers),
                          "homeSets":_number(r.home_sets),"awaySets":_number(r.away_sets),
                          "homeGames":int(r.home_games),"awayGames":int(r.away_games)})
        by_round[int(r["round"])].append(match)
    return [{"round":rnd,"date":matches[0]["date"],"fixtures":matches} for rnd,matches in sorted(by_round.items(),reverse=True)]

def build_section(meta):
    section_dir=SECTIONS_DIR/meta["section_code"]
    singles=pd.read_csv(section_dir/"singles.csv")
    doubles=pd.read_csv(section_dir/"doubles.csv")
    fixtures=pd.read_csv(section_dir/"fixtures.csv")
    draw=pd.read_csv(section_dir/"draw.csv")
    singles=singles[singles.status.eq("Completed")].copy()
    doubles=doubles[doubles.status.eq("Completed")].copy()
    rules=brta_scoring_rules(meta)
    player_teams,pair_teams=team_maps(singles,doubles)
    sr=fit_power_ratings(section_dir/"singles.csv")
    pr=fit_pairs(doubles)
    dr=fit_individual_doubles(doubles, rubbers_format=rules["format"]=="rubbers")
    srows=website_rows(sr,player_teams)
    prows=website_rows(pr,pair_teams)
    drows=website_rows(dr,player_teams)
    individual_power={x["player"]:x["rating"] for x in drows}
    pair_synergy=fit_pair_synergies(doubles,individual_power)
    for pair in prows:
        members=pair_members(pair["player"])
        pair["individualAverage"]=round(sum(individual_power[p] for p in members)/2)
        pair["pairEffect"]=pair["rating"]-pair["individualAverage"]
        pair["pairSynergy"]=round(pair_synergy.get(pair["player"],0))
    rmap={x["player"]:x["rating"] for x in srows}
    history=round_rating_history(singles,player_teams)
    matchup=matchup_matrix(srows,rules)
    expectation=results_expectation(singles,history,player_teams,rules)
    schedule=strength_of_schedule(singles,rmap,player_teams)
    schedule_by_player={row["player"]:row for row in schedule}
    for row in srows:
        row.update({"averageOpponent":schedule_by_player.get(row["player"],{}).get("averageOpponent"),
                    "scheduleRank":schedule_by_player.get(row["player"],{}).get("rank"),
                    "scheduleTotal":schedule_by_player.get(row["player"],{}).get("total")})

    payload={
        "meta":meta,
        "singles":srows,
        "doubles":prows,
        "doublesIndividuals":drows,
        "singlesMatches":singles_match_array(singles),
        "ratingHistory":history,
        "matchupMatrix":matchup,
        "resultsExpectation":expectation,
        "strengthOfSchedule":schedule,
        "teamOrderEvidence":team_order_evidence(singles,rmap,player_teams),
        "format":rules["format"],
        "teams":team_rows(srows,fixtures,rules),
        "note":"Team Power uses every modelled singles player; low-sample ratings are already regularised toward the section centre. Standings use TROLS scorecard points and the 2026 BRTA Weekend Junior By-Laws for washouts and full-team forfeits.",
        "roundOverview":round_overview(fixtures,singles,doubles,rmap,history),
        "standings":reconstructed_standings(fixtures,rules),
        "results":result_rounds(fixtures,singles,doubles,rules),
        "upcomingFixtures":draw_fixtures(draw,fixtures,rules),
        "sync":sync_meta(meta,fixtures),
    }
    qualified=[row for row in srows if row["matches"]>=MIN_MATCHES]
    if qualified:
        leader=qualified[0]; runner=qualified[1] if len(qualified)>1 else None
        payload["leader"]={"player":leader["player"],"team":leader["team"],"rating":leader["rating"],
                           "matches":leader["matches"],"wins":leader["wins"],"losses":leader["losses"],
                           "dominanceGap":leader["rating"]-DISPLAY_CENTRE,
                           "runnerUpGap":leader["rating"]-(runner["rating"] if runner else DISPLAY_CENTRE),
                           "expectedGameShare":round(100*float(expit((leader["rating"]-DISPLAY_CENTRE)/450)),1)}
    return payload

def main():
    catalog_doc=json.loads((DATA_DIR/"catalog.json").read_text(encoding="utf-8"))
    SITE_SECTIONS_DIR.mkdir(parents=True,exist_ok=True)
    section_payloads={}
    catalog=[]
    for meta in catalog_doc["sections"]:
        payload=build_section(meta)
        code=meta["section_code"]
        section_payloads[code]=payload
        summary={**meta}
        if payload.get("leader"): summary["leader"]=payload["leader"]
        catalog.append(summary)
        (SITE_SECTIONS_DIR/f"{code}.json").write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False,allow_nan=False)+"\n",encoding="utf-8")
        print(f"Wrote {code}: {len(payload['singles'])} singles ratings")
    leaders=[{**row["leader"],"sectionCode":row["section_code"],"sectionLabel":row["section_label"],
              "competitionCode":row["competition_code"],"competitionLabel":row["competition_label"]}
             for row in catalog if row.get("leader")]
    leaders.sort(key=lambda row:(-row["expectedGameShare"],-row["runnerUpGap"],row["sectionCode"]))
    for rank,row in enumerate(leaders,1): row["dominanceRank"]=rank
    model={
        "version":"V3","centre":int(DISPLAY_CENTRE),"displayScale":int(DISPLAY_SCALE),
        "singlesMinMatches":MIN_MATCHES,"doublesMinMatches":MIN_DOUBLES_MATCHES,
        "doublesIndividualMinMatches":INDIVIDUAL_DOUBLES_MIN,
        "doublesIndividualMinPartners":INDIVIDUAL_DOUBLES_MIN_PARTNERS,
        "overallRule":"50/50 average of singles and individual doubles ratings; ranked overall requires 4 singles matches and a publishable doubles contribution. In two-player Rubbers sections that doubles component is labelled partner-dependent.",
        "doublesIndividualRule":"Individual doubles is partner-adjusted and experimental. Sets and Green Ball ranking requires 4 appearances, 2 distinct partners and no exact unresolved direction. Two-player Rubbers sections publish 4+ appearance pair-dependent evidence with that limitation shown.",
        "pairSynergyRule":"Exploratory, conditional pair-effect signal. It is strongly regularised (lambda=50) and does not affect the published singles, individual-doubles, Overall or Team Power ratings.",
        "dominanceRule":"Section leaders are ranked by expected game share against their own section's 1500-rated average player. This measures within-section dominance, not absolute strength between disconnected sections.",
        "matchupMatrixRule":"Dense current-model player-v-player singles win probabilities, ordered by the accompanying player axis and projected with the same short-set / Rubbers match logic as fixture predictions.",
        "resultsExpectationRule":"Actual singles wins and game share compared with expectations from the latest rating snapshot strictly before each round; unseen players start at 1500.",
    }
    global_sync=json.loads((DATA_DIR/"sync_status.json").read_text()) if (DATA_DIR/"sync_status.json").exists() else {}
    check=json.loads((DATA_DIR/"last_check.json").read_text()) if (DATA_DIR/"last_check.json").exists() else {}
    data={"catalog":catalog,"leaders":leaders,"model":model,"globalSync":{**global_sync,"checkedAt":check.get("checked_at_utc") or global_sync.get("synced_at_utc"),"newResultsLastCheck":bool(check.get("new_results",False))},
          "defaultSectionCode":DEFAULT_SECTION,"defaultSection":section_payloads.get(DEFAULT_SECTION) or next(iter(section_payloads.values()))}
    OUT.write_text("const DATA="+json.dumps(data,separators=(",",":"),ensure_ascii=False,allow_nan=False)+";\n",encoding="utf-8")
    print(f"Wrote {OUT}: {len(catalog)} sections and {len(leaders)} qualified section leaders")

if __name__=="__main__":
    main()
