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
import xgboost as xgb

# --------------------------------------------------
# Config
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "../models/xgb_hi_forecast_model.json")
DATA_PATH = os.path.join(BASE_DIR, "df_test_final.csv")

# Will be populated when model is loaded (list of feature names expected by Booster)
EXPECTED_FEATURE_NAMES = None

# --------------------------------------------------
# Helpers
# --------------------------------------------------

def load_model():
    """Load trained XGBoost model saved as JSON (Booster)"""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
    booster = xgb.Booster()
    booster.load_model(MODEL_PATH)
    # capture expected feature names if the Booster has them
    global EXPECTED_FEATURE_NAMES
    try:
        EXPECTED_FEATURE_NAMES = booster.feature_names
    except Exception:
        EXPECTED_FEATURE_NAMES = None
    return booster

def prepare_features(station_id, df):
    df = df.copy()
    df["Date"] = pd.to_datetime(df["Date"])

    # March–May 2023 only
    df = df[(df["Date"] >= "2023-03-01") & (df["Date"] <= "2023-05-31")]

    # Latest row per station
    row = df[df["Station"] == station_id].tail(1)

    if row.empty:
        raise ValueError(f"No data for station {station_id}")

    def v(col):
        return float(row[col].iloc[0]) if col in row.columns else 0.0

    T = v("TMAX")
    RH = v("RH")
    W = v("WIND_SPEED")

    # Build a mapping of all candidate features
    feat_map = {
        "TMAX": v("TMAX"),
        "TMIN": v("TMIN"),
        "RH": RH,
        "WIND_SPEED": W,
        "Albedo_linear": v("Albedo_linear"),
        "skin_temperature_min_C": v("skin_temperature_min_C"),
        "skin_temperature_max_C": v("skin_temperature_max_C"),
        "NDBI_linear": v("NDBI_linear"),
        "NDVI_original": v("NDVI_original"),
        "Latitude": v("Latitude"),
        "Longitude": v("Longitude"),
        "Elevation": v("Elevation"),
        "Station": float(station_id),
        "Temperature_at_RH": v("Temperature_at_RH"),
        "Max_HI": v("Max_HI"),
        "is_dry_season": v("is_dry_season"),
        "is_wet_season": v("is_wet_season"),
        "is_cool_dry_season": v("is_cool_dry_season"),
        "is_hot_dry_season": v("is_hot_dry_season"),
        "U_wind_component": v("U_wind_component"),
        "V_wind_component": v("V_wind_component"),
        "Temp_Range": v("Temp_Range"),
        "Temp_Mean": v("Temp_Mean"),
        "Month_sin": v("Month_sin"),
        "Month_cos": v("Month_cos"),
        "Day_of_Year_sin": v("Day_of_Year_sin"),
        "Day_of_Year_cos": v("Day_of_Year_cos"),
        "TMAX_Rolling_Mean_7": v("TMAX_Rolling_Mean_7"),
        "TMAX_Rolling_Max_7": v("TMAX_Rolling_Max_7"),
        "TMIN_Rolling_Mean_7": v("TMIN_Rolling_Mean_7"),
        "TMIN_Rolling_Max_7": v("TMIN_Rolling_Max_7"),
        "Max_HI_Rolling_Mean_7": v("Max_HI_Rolling_Mean_7"),
        "Max_HI_Rolling_Max_7": v("Max_HI_Rolling_Max_7"),
        "Max_HI_Rolling_Min_7": v("Max_HI_Rolling_Min_7"),
        "RH_Rolling_Mean_7": v("RH_Rolling_Mean_7"),
        "RH_Rolling_Min_7": v("RH_Rolling_Min_7"),
        "TMAX_Rolling_Mean_30": v("TMAX_Rolling_Mean_30"),
        "TMAX_Rolling_Max_30": v("TMAX_Rolling_Max_30"),
        "TMIN_Rolling_Mean_30": v("TMIN_Rolling_Mean_30"),
        "TMIN_Rolling_Max_30": v("TMIN_Rolling_Max_30"),
        "Max_HI_Rolling_Mean_30": v("Max_HI_Rolling_Mean_30"),
        "Max_HI_Rolling_Max_30": v("Max_HI_Rolling_Max_30"),
        "Max_HI_Rolling_Min_30": v("Max_HI_Rolling_Min_30"),
        "RH_Rolling_Mean_30": v("RH_Rolling_Mean_30"),
        "RH_Rolling_Min_30": v("RH_Rolling_Min_30"),
        "T^2": T**2,
        "RH^2": RH**2,
        "TxRH": T * RH,
        "T^2xRH": (T**2) * RH,
        "TxRH^2": T * (RH**2),
        "T^2xRH^2": (T**2) * (RH**2),
        "TMAX_x_WIND": T * W,
    }

    # temperature_at_RH lag candidates
    for lag in [1,2,3,4,5,6,8,9,10,11,12,13]:
        key = f"Temperature_at_RH_lag_{lag}"
        feat_map[key] = v(key) if key in row.columns else 0.0

    # Max_HI lags
    feat_map["Max_HI_lag_1"] = v("Max_HI_lag_1") if "Max_HI_lag_1" in row.columns else 0.0
    feat_map["Max_HI_lag_2"] = v("Max_HI_lag_2") if "Max_HI_lag_2" in row.columns else 0.0

    # RH lags
    for key in ["RH_lag_1","RH_lag_2","RH_lag_5","RH_lag_6"]:
        feat_map[key] = v(key) if key in row.columns else 0.0

    # Order features according to model expectation if available
    if EXPECTED_FEATURE_NAMES:
        ordered = [feat_map.get(name, 0.0) for name in EXPECTED_FEATURE_NAMES]
        feat_df = pd.DataFrame([ordered], columns=EXPECTED_FEATURE_NAMES)
    else:
        feat_df = pd.DataFrame([feat_map])

    return feat_df

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
    station_ids = df["Station"].unique()

    for sid in station_ids:
        x = prepare_features(sid, df)
        dmat = xgb.DMatrix(x)
        preds = model.predict(dmat)
        pred = float(np.asarray(preds).ravel()[0])

        # Clamp realistic Heat Index bounds
        pred = round(max(27.0, min(55.0, pred)), 2)

        # CSV station IDs are 0-based; convert to 1-based for DB consistency
        forecasts.append({
            "station_id": int(sid) + 1,
            "tomorrow": pred,
            "day_after_tomorrow": pred
        })

    print(json.dumps(forecasts))

if __name__ == "__main__":
    main()
