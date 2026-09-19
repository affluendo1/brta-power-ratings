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
SINGLES_CSV = DATA_DIR / "section6_singles_results.csv"
DOUBLES_CSV = DATA_DIR / "section6_doubles_results.csv"
FIXTURES_CSV = DATA_DIR / "section6_fixtures.csv"
OUT = Path("data.js")
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
        raise ValueError("All current Section 6 rows should have real dates")
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
    x["winning_player"]=np.where(
        pd.to_numeric(x["home_games"])>pd.to_numeric(x["away_games"]),
        x["home_player"],x["away_player"]
    )
    return fit_power_ratings_from_df(x)

def fit_power_ratings_from_df(df):
    df=parse_dates(df[df["status"].eq("Completed")].copy())
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
            wins+=int((home and r.home_games>r.away_games) or ((not home) and r.away_games>r.home_games))
        rows.append(dict(player=player,matches=len(m),wins=wins,losses=len(m)-wins,
                         games_for=gf,games_against=ga,power=power[k],power_se=se[k],
                         ci95_low=power[k]-1.96*se[k],ci95_high=power[k]+1.96*se[k]))
    return pd.DataFrame(rows).sort_values("power",ascending=False)

def fit_individual_doubles(doubles):
    df=parse_dates(doubles[doubles["status"].eq("Completed")].copy())
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
        home_win=int(r.home_games)>int(r.away_games)
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
        qualified=(s["matches"] >= INDIVIDUAL_DOUBLES_MIN and
                   partner_count >= INDIVIDUAL_DOUBLES_MIN_PARTNERS and
                   not structurally_unidentified)
        if qualified:
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
    df=parse_dates(doubles[doubles["status"].eq("Completed")].copy())
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
                    int(r["home_games"]),int(r["away_games"])])
    return out

def ladder(fixtures):
    pts=Counter()
    for _,r in fixtures.iterrows():
        h,a=str(r.home_team),str(r.away_team); status=str(r.status)
        if status=="Wash Out":
            pts[h]+=5; pts[a]+=5; continue
        if status!="Completed": continue
        hr,ar=int(r.home_rubbers),int(r.away_rubbers); hg,ag=int(r.home_games),int(r.away_games)
        pts[h]+=hr; pts[a]+=ar
        if hr>ar or (hr==ar and hg>ag): pts[h]+=4
        elif ar>hr or (hr==ar and ag>hg): pts[a]+=4
        else: pts[h]+=2; pts[a]+=2
    return pts

def team_rows(single_rows, fixtures):
    pts=ladder(fixtures); by=defaultdict(list)
    for x in single_rows:
        # Team Power measures the active modelled roster, not only the public
        # leaderboard.  Low-sample ratings are already shrunk toward 1500.
        by[x["team"]].append(x["rating"])
    all_teams=sorted(set(fixtures.home_team)|set(fixtures.away_team))
    rows=[]
    for t in all_teams:
        vals=by.get(t,[])
        avg=float(np.mean(vals)) if vals else 0.0
        best4=float(np.mean(sorted(vals,reverse=True)[:4])) if vals else 0.0
        rows.append({"team":t,"avg":round(avg,1),"best4":round(best4,1),"modelled":len(vals),"ladder":int(pts[t])})
    return sorted(rows,key=lambda x:x["avg"],reverse=True)

def reconstructed_standings(fixtures):
    teams = sorted(set(fixtures.home_team) | set(fixtures.away_team))
    s = {t: dict(team=t, played=0, wins=0, draws=0, losses=0, rubbersFor=0, rubbersAgainst=0,
                 gamesFor=0, gamesAgainst=0, points=0) for t in teams}
    for _, r in fixtures.iterrows():
        h, a, status = str(r.home_team), str(r.away_team), str(r.status)
        if status == "Wash Out":
            s[h]["points"] += 5; s[a]["points"] += 5
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
        s[h]["points"] += hr; s[a]["points"] += ar
        home_win = hr > ar or (hr == ar and hg > ag)
        away_win = ar > hr or (hr == ar and ag > hg)
        if home_win:
            s[h]["wins"] += 1; s[a]["losses"] += 1; s[h]["points"] += 4
        elif away_win:
            s[a]["wins"] += 1; s[h]["losses"] += 1; s[a]["points"] += 4
        else:
            s[h]["draws"] += 1; s[a]["draws"] += 1
            s[h]["points"] += 2; s[a]["points"] += 2
    return sorted(s.values(), key=lambda x: (-x["points"], -(x["rubbersFor"]-x["rubbersAgainst"]),
                                             -(x["gamesFor"]-x["gamesAgainst"]), x["team"]))

ROUND_DATES = {
    10: "11 Oct 26", 11: "18 Oct 26", 12: "25 Oct 26",
    13: "8 Nov 26", 14: "15 Nov 26",
}

def upcoming_fixtures(fixtures):
    by_round = defaultdict(list)
    for _, r in fixtures.iterrows():
        by_round[int(r["round"])].append((str(r.home_team), str(r.away_team)))
    # Validate the double-round-robin pattern using the already-published R8/R9.
    # If R8 == reversed R1 and R9 == reversed R2, the remaining return fixtures
    # are deterministically R3-R7 with home/away swapped.
    def norm(xs): return sorted(xs)
    verified = all(
        norm(by_round.get(r + 7, [])) == norm([(a, h) for h, a in by_round.get(r, [])])
        for r in (1, 2)
    )
    if not verified:
        return []
    latest = max(by_round)
    out = []
    for rnd in range(latest + 1, 15):
        source = rnd - 7
        games = [{"home": a, "away": h} for h, a in by_round.get(source, [])]
        if len(games) == 4:
            out.append({"round": rnd, "date": ROUND_DATES.get(rnd, ""), "fixtures": games,
                        "source": "reconstructed from verified reverse draw"})
    return out

def sync_meta():
    status = json.loads((DATA_DIR / "sync_status.json").read_text()) if (DATA_DIR / "sync_status.json").exists() else {}
    check = json.loads((DATA_DIR / "last_check.json").read_text()) if (DATA_DIR / "last_check.json").exists() else {}
    updated = None
    raw = status.get("results_loaded_by_trols")
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
        "latestRound": status.get("latest_round"),
        "validation": status.get("validation"),
        "newResultsLastCheck": bool(check.get("new_results", False)),
        "missingFixtures": int(sum(1 for _, r in pd.read_csv(FIXTURES_CSV).iterrows() if str(r.status) == "Missing Result")),
        "resultsLoadedByTrols": raw,
    }

def round_overview(fixtures, singles, rating_map):
    completed_rounds=sorted(set(int(x) for x in singles["round"]))
    latest=max(completed_rounds)
    fx=fixtures[fixtures["round"].astype(int).eq(latest)].copy()
    sr=singles[singles["round"].astype(int).eq(latest)].copy()
    fixture_cards=[]
    for _,r in fx.iterrows():
        card={"home":str(r.home_team),"away":str(r.away_team),"status":str(r.status)}
        if str(r.status)=="Completed":
            card.update({"homeRubbers":int(r.home_rubbers),"awayRubbers":int(r.away_rubbers),
                         "homeGames":int(r.home_games),"awayGames":int(r.away_games)})
            if int(r.home_rubbers)>int(r.away_rubbers) or (int(r.home_rubbers)==int(r.away_rubbers) and int(r.home_games)>int(r.away_games)):
                card["winner"]=str(r.home_team)
            elif int(r.away_rubbers)>int(r.home_rubbers) or (int(r.home_rubbers)==int(r.away_rubbers) and int(r.away_games)>int(r.home_games)):
                card["winner"]=str(r.away_team)
            else: card["winner"]="Draw"
        fixture_cards.append(card)
    performances=[]; upsets=[]
    for _,r in sr.iterrows():
        hp,ap=str(r.home_player),str(r.away_player); hg,ag=int(r.home_games),int(r.away_games)
        winner,loser=(hp,ap) if hg>ag else (ap,hp); gf,ga=(hg,ag) if hg>ag else (ag,hg)
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
    return {"round":latest,"date":date,"fixtures":fixture_cards,"topPerformance":top,
            "biggestUpset":upset,"dominantWin":dominant,"closestMatch":closest}

def main():
    singles=pd.read_csv(SINGLES_CSV)
    doubles=pd.read_csv(DOUBLES_CSV)
    fixtures=pd.read_csv(FIXTURES_CSV)
    singles=singles[singles.status.eq("Completed")].copy()
    doubles=doubles[doubles.status.eq("Completed")].copy()
    player_teams,pair_teams=team_maps(singles,doubles)

    sr=fit_power_ratings(SINGLES_CSV)
    pr=fit_pairs(doubles)
    dr=fit_individual_doubles(doubles)
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

    payload={"section6":{
        "singles":srows,
        "doubles":prows,
        "doublesIndividuals":drows,
        "singlesMatches":singles_match_array(singles),
        "teams":team_rows(srows,fixtures),
        "note":"Team Power uses every modelled singles player; low-sample ratings are already regularised toward the section centre. Ladder points are reconstructed from published fixture results; missing fixtures remain uncounted.",
        "roundOverview":round_overview(fixtures,singles,rmap),
        "standings":reconstructed_standings(fixtures),
        "upcomingFixtures":upcoming_fixtures(fixtures),
        "sync":sync_meta(),
    },"model":{
        "version":"V3","centre":int(DISPLAY_CENTRE),"displayScale":int(DISPLAY_SCALE),
        "singlesMinMatches":MIN_MATCHES,"doublesMinMatches":MIN_DOUBLES_MATCHES,
        "doublesIndividualMinMatches":INDIVIDUAL_DOUBLES_MIN,
        "doublesIndividualMinPartners":INDIVIDUAL_DOUBLES_MIN_PARTNERS,
        "overallRule":"50/50 average of singles and individual doubles ratings; ranked overall requires 4 singles matches and an established individual-doubles entry (4 appearances, 2 partners and no exact network identifiability warning).",
        "doublesIndividualRule":"Individual doubles is partner-adjusted and experimental. Ranking requires 4 appearances, 2 distinct partners and no exact unresolved direction in the current doubles network.",
        "pairSynergyRule":"Exploratory, conditional pair-effect signal. It is strongly regularised (lambda=50) and does not affect the published singles, individual-doubles, Overall or Team Power ratings.",
        "doublesNetworkRank":int(dr["network_rank"].iloc[0]) if len(dr) else 0,
    }}
    OUT.write_text("const DATA="+json.dumps(payload,separators=(",",":"),ensure_ascii=False)+";\n",encoding="utf-8")
    print(f"Wrote {OUT}: {len(srows)} singles, {len(prows)} pairs, {len(drows)} doubles players, latest round {payload['section6']['roundOverview']['round']}")

if __name__=="__main__":
    main()
