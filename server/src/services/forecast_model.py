#!/usr/bin/env python3
"""
Heat Index Forecast Worker
Outputs:
1) JSON array of forecasts
2) JSON object with abs_errors
"""

import sys
import json
import os
import pickle
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

# --------------------------------------------------
# Config
# --------------------------------------------------

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "../models/model.pkl")
DATA_PATH = os.path.join(BASE_DIR, "df_test_final.csv")

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres"
)

# --------------------------------------------------
# Helpers
# --------------------------------------------------

def load_model():
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)

def get_db():
    return psycopg2.connect(DB_URL)

def prepare_features(station_id, df, station_coords):
    df = df.copy()
    df["Date"] = pd.to_datetime(df["Date"])

    df = df[(df["Date"] >= "2023-03-01") & (df["Date"] <= "2023-05-31")]

    if station_id in station_coords:
        lat, lon = station_coords[station_id]
        row = df[
            (abs(df["Latitude"] - lat) < 0.001) &
            (abs(df["Longitude"] - lon) < 0.001)
        ].tail(1)
    else:
        row = df.tail(1)

    if row.empty:
        raise ValueError("No data for station")

    def v(c): return float(row[c].iloc[0])

    T = v("TMAX")
    RH = v("RH")
    W = v("WIND_SPEED")

    features = [
        # 1–4
        v("TMAX"), v("TMIN"), RH, W,

        # 5–9
        v("Albedo_linear"),
        v("skin_temperature_min_C"),
        v("skin_temperature_max_C"),
        v("NDBI_linear"),
        v("NDVI_original"),

        # 10–13
        v("Latitude"),
        v("Longitude"),
        v("Elevation"),
        float(station_id),

        # 14–15
        v("Temperature_at_RH"),
        v("Max_HI"),

        # 16–19
        v("is_dry_season"),
        v("is_wet_season"),
        v("is_cool_dry_season"),
        v("is_hot_dry_season"),

        # 20–23
        v("U_wind_component"),
        v("V_wind_component"),
        v("Temp_Range"),
        v("Temp_Mean"),

        # 24–27
        v("Month_sin"),
        v("Month_cos"),
        v("Day_of_Year_sin"),
        v("Day_of_Year_cos"),

        # 28–36
        v("TMAX_Rolling_Mean_7"),
        v("TMAX_Rolling_Max_7"),
        v("TMIN_Rolling_Mean_7"),
        v("TMIN_Rolling_Max_7"),
        v("Max_HI_Rolling_Mean_7"),
        v("Max_HI_Rolling_Max_7"),
        v("Max_HI_Rolling_Min_7"),
        v("RH_Rolling_Mean_7"),
        v("RH_Rolling_Min_7"),

        # 37–45
        v("TMAX_Rolling_Mean_30"),
        v("TMAX_Rolling_Max_30"),
        v("TMIN_Rolling_Mean_30"),
        v("TMIN_Rolling_Max_30"),
        v("Max_HI_Rolling_Mean_30"),
        v("Max_HI_Rolling_Max_30"),
        v("Max_HI_Rolling_Min_30"),
        v("RH_Rolling_Mean_30"),
        v("RH_Rolling_Min_30"),

        # 46–52 interactions
        T**2,
        RH**2,
        T * RH,
        (T**2) * RH,
        T * (RH**2),
        (T**2) * (RH**2),
        T * W,
    ]

    # 53–63 Temperature_at_RH lags
    for lag in [1,2,3,4,5,6,8,10,11,12,13]:
        features.append(v(f"Temperature_at_RH_lag_{lag}"))

    # 64–65 Max_HI lags
    features += [v("Max_HI_lag_1"), v("Max_HI_lag_2")]

    # 66–67 RH lags
    features += [v("RH_lag_1"), v("RH_lag_5")]

    return np.array(features).reshape(1, -1)

# --------------------------------------------------
# Main
# --------------------------------------------------

def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    base_date = datetime.strptime(sys.argv[1], "%Y-%m-%d")
    t1 = (base_date + timedelta(days=1)).strftime("%Y-%m-%d")
    t2 = (base_date + timedelta(days=2)).strftime("%Y-%m-%d")

    model = load_model()
    df = pd.read_csv(DATA_PATH)

    conn = get_db()
    forecasts = []
    abs_errors = []

    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("SELECT id, latitude, longitude FROM stations ORDER BY id")
        stations = cur.fetchall()

    station_coords = {s["id"]: (s["latitude"], s["longitude"]) for s in stations}

    for s in stations:
        sid = s["id"]
        x = prepare_features(sid, df, station_coords)

        pred = float(model.predict(x)[0])
        pred = round(max(27.0, min(55.0, pred)), 2)

        forecasts.append({
            "station_id": sid,
            "tomorrow": pred,
            "day_after_tomorrow": pred
        })

        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT actual FROM heat_index WHERE station = %s AND date = %s",
                (sid, t1)
            )
            r1 = cur.fetchone()

            cur.execute(
                "SELECT actual FROM heat_index WHERE station = %s AND date = %s",
                (sid, t2)
            )
            r2 = cur.fetchone()

        abs_errors.append({
            "station_id": sid,
            "abs_error_1d": abs(pred - r1["actual"]) if r1 else None,
            "abs_error_2d": abs(pred - r2["actual"]) if r2 else None
        })

    conn.close()

    print(json.dumps(forecasts))
    print(json.dumps({"abs_errors": abs_errors}))

if __name__ == "__main__":
    main()
