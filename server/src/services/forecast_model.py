#!/usr/bin/env python3
"""
Heat Index Forecast Worker (DB-free, joblib model)

Outputs:
1) JSON array of forecasts
"""

import sys
import json
import os
from datetime import datetime

import numpy as np
import pandas as pd
from joblib import load  # correct loader for joblib .pkl

# --------------------------------------------------
# Config
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "../models/model.pkl")
DATA_PATH = os.path.join(BASE_DIR, "df_test_final.csv")

# --------------------------------------------------
# Helpers
# --------------------------------------------------

def load_model():
    """Load trained model saved via joblib"""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
    return load(MODEL_PATH)

def prepare_features(station_id, df):
    df = df.copy()
    df["Date"] = pd.to_datetime(df["Date"])

    # March–May 2023 only
    df = df[(df["Date"] >= "2023-03-01") & (df["Date"] <= "2023-05-31")]

    # Latest row per station
    row = df[df["station_id"] == station_id].tail(1)

    if row.empty:
        raise ValueError(f"No data for station {station_id}")

    def v(col):
        return float(row[col].iloc[0])

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
    for lag in [1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13]:
        features.append(v(f"Temperature_at_RH_lag_{lag}"))

    # 64–65 Max_HI lags
    features.append(v("Max_HI_lag_1"))
    features.append(v("Max_HI_lag_2"))

    # 66–67 RH lags
    features.append(v("RH_lag_1"))
    features.append(v("RH_lag_5"))

    return np.array(features, dtype=np.float32).reshape(1, -1)

# --------------------------------------------------
# Main
# --------------------------------------------------

def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    # Validate date input (API requirement only)
    datetime.strptime(sys.argv[1], "%Y-%m-%d")

    model = load_model()
    df = pd.read_csv(DATA_PATH)

    forecasts = []
    station_ids = df["station_id"].unique()

    for sid in station_ids:
        x = prepare_features(sid, df)
        pred = float(model.predict(x)[0])

        # Clamp realistic Heat Index bounds
        pred = round(max(27.0, min(55.0, pred)), 2)

        forecasts.append({
            "station_id": int(sid),
            "tomorrow": pred,
            "day_after_tomorrow": pred
        })

    print(json.dumps(forecasts))

if __name__ == "__main__":
    main()
