from __future__ import annotations
import json, math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import expit

from model import (
    GAME_SCALE, HALF_LIFE_DAYS, L2, DISPLAY_CENTRE, DISPLAY_SCALE,
    MIN_MATCHES, MIN_DOUBLES_MATCHES, fit_power_ratings,
)

DATA_DIR = Path("data/current")
SINGLES_CSV = DATA_DIR / "section6_singles_results.csv"
DOUBLES_CSV = DATA_DIR / "section6_doubles_results.csv"
FIXTURES_CSV = DATA_DIR / "section6_fixtures.csv"
OUT = Path("data.js")
INDIVIDUAL_DOUBLES_MIN = 4

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
        rows.append({
            "player":str(r.player),"team":teams.get(str(r.player),""),
            "wins":int(r.wins),"losses":int(r.losses),
            "gf":int(r.games_for),"ga":int(r.games_against),"matches":int(r.matches),
            "rating":int(round(r.power)),"se":int(round(r.power_se)),
            "lo":int(round(r.ci95_low)),"hi":int(round(r.ci95_high)),
        })
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
    cov=np.linalg.inv(H); se=DISPLAY_SCALE*np.sqrt(np.diag(cov))
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
    cov=np.linalg.inv(H); se=DISPLAY_SCALE*np.sqrt(np.diag(cov))
    stats={p:dict(matches=0,wins=0,gf=0,ga=0) for p in players}
    for row,r in df.reset_index(drop=True).iterrows():
        home_win=int(r.home_games)>int(r.away_games)
        for p0 in home_members[row]:
            s=stats[p0]; s["matches"]+=1; s["wins"]+=int(home_win); s["gf"]+=int(r.home_games); s["ga"]+=int(r.away_games)
        for p0 in away_members[row]:
            s=stats[p0]; s["matches"]+=1; s["wins"]+=int(not home_win); s["gf"]+=int(r.away_games); s["ga"]+=int(r.home_games)
    rows=[]
    for p0 in players:
        k=ix[p0]; s=stats[p0]
        rows.append(dict(player=p0,matches=s["matches"],wins=s["wins"],losses=s["matches"]-s["wins"],
                         games_for=s["gf"],games_against=s["ga"],power=power[k],power_se=se[k],
                         ci95_low=power[k]-1.96*se[k],ci95_high=power[k]+1.96*se[k]))
    return pd.DataFrame(rows).sort_values("power",ascending=False)

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
        if x["matches"]>=MIN_MATCHES: by[x["team"]].append(x["rating"])
    all_teams=sorted(set(fixtures.home_team)|set(fixtures.away_team))
    rows=[]
    for t in all_teams:
        vals=by.get(t,[])
        avg=float(np.mean(vals)) if vals else 0.0
        best4=float(np.mean(sorted(vals,reverse=True)[:4])) if vals else 0.0
        rows.append({"team":t,"avg":round(avg,1),"best4":round(best4,1),"qualified":len(vals),"ladder":int(pts[t])})
    return sorted(rows,key=lambda x:x["avg"],reverse=True)

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
    rmap={x["player"]:x["rating"] for x in srows}

    payload={"section6":{
        "singles":srows,
        "doubles":prows,
        "doublesIndividuals":drows,
        "singlesMatches":singles_match_array(singles),
        "teams":team_rows(srows,fixtures),
        "note":"Team Power uses qualified singles players. Ladder points are reconstructed from published fixture results; missing fixtures remain uncounted.",
        "roundOverview":round_overview(fixtures,singles,rmap),
    },"model":{
        "version":"V3","centre":int(DISPLAY_CENTRE),"displayScale":int(DISPLAY_SCALE),
        "singlesMinMatches":MIN_MATCHES,"doublesMinMatches":MIN_DOUBLES_MATCHES,
        "doublesIndividualMinMatches":INDIVIDUAL_DOUBLES_MIN,
        "overallRule":"50/50 average of singles and individual doubles ratings; ranked overall requires 4 singles and 4 doubles appearances."
    }}
    OUT.write_text("const DATA="+json.dumps(payload,separators=(",",":"),ensure_ascii=False)+";\\n",encoding="utf-8")
    print(f"Wrote {OUT}: {len(srows)} singles, {len(prows)} pairs, {len(drows)} doubles players, latest round {payload['section6']['roundOverview']['round']}")

if __name__=="__main__":
    main()
