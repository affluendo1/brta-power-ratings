"""
Reproducible BRTA singles power-rating model.

Expected CSV columns:
round, date, home_player, away_player, winning_player,
home_games, away_games, status

Requires:
    pip install pandas numpy scipy
"""

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import expit

GAME_SCALE = 0.75
MATCH_SCALE = 0.55
MATCH_WEIGHT = 1.8
L2 = 0.75
RECENCY = 0.90
DISPLAY_CENTRE = 1000
DISPLAY_SCALE = 250
MIN_MATCHES = 4

def add_stage(df):
    """Place finals chronologically after the last numbered regular round."""
    df = df.copy()
    regular = pd.to_numeric(df["round"], errors="coerce")
    max_regular = int(regular[regular > 0].max())
    def stage(row):
        label = str(row.get("date", "")).lower()
        if "semi final" in label:
            return max_regular + 1
        if "grand final" in label:
            return max_regular + 2
        return int(row["round"])
    df["stage"] = df.apply(stage, axis=1)
    return df

def fit_power_ratings(csv_path):
    df = pd.read_csv(csv_path)
    df = df[df["status"].eq("Completed")].copy()
    df = add_stage(df)

    players = sorted(set(df["home_player"]) | set(df["away_player"]))
    ix = {p:i for i,p in enumerate(players)}
    latest = int(df["stage"].max())

    i = df["home_player"].map(ix).to_numpy()
    j = df["away_player"].map(ix).to_numpy()
    gi = df["home_games"].astype(float).to_numpy()
    gj = df["away_games"].astype(float).to_numpy()
    y = (df["winning_player"] == df["home_player"]).astype(float).to_numpy()
    w = RECENCY ** (latest - df["stage"].to_numpy())

    def negative_objective(x):
        theta = x - x.mean()
        d = theta[i] - theta[j]
        pg = expit(d / GAME_SCALE)
        pm = expit(d / MATCH_SCALE)
        eps = 1e-12
        game_ll = gi*np.log(pg+eps) + gj*np.log(1-pg+eps)
        match_ll = y*np.log(pm+eps) + (1-y)*np.log(1-pm+eps)
        objective = np.sum(w*(game_ll + MATCH_WEIGHT*match_ll))
        objective -= (L2/2) * np.sum(theta**2)
        return -objective

    result = minimize(
        negative_objective,
        np.zeros(len(players)),
        method="L-BFGS-B",
        options={"maxiter":5000, "ftol":1e-12},
    )
    if not result.success:
        raise RuntimeError(result.message)

    theta = result.x - result.x.mean()
    rating = DISPLAY_CENTRE + DISPLAY_SCALE*theta
    ratings = dict(zip(players, rating))

    rows = []
    for p in players:
        m = df[(df["home_player"] == p) | (df["away_player"] == p)]
        wins = int((m["winning_player"] == p).sum())
        gf = ga = 0
        for _, r in m.iterrows():
            if r["home_player"] == p:
                gf += r["home_games"]; ga += r["away_games"]
            else:
                gf += r["away_games"]; ga += r["home_games"]
        rows.append({
            "player": p,
            "matches": len(m),
            "wins": wins,
            "losses": len(m)-wins,
            "games_for": int(gf),
            "games_against": int(ga),
            "power": ratings[p],
        })

    out = pd.DataFrame(rows).sort_values("power", ascending=False)
    out["qualified"] = out["matches"] >= MIN_MATCHES
    return out

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("csv")
    parser.add_argument("--all", action="store_true", help="show players below the 4-match publication threshold")
    args = parser.parse_args()
    ratings = fit_power_ratings(args.csv)
    if not args.all:
        ratings = ratings[ratings["qualified"]]
    print(ratings.to_string(index=False, formatters={"power":"{:.0f}".format}))
