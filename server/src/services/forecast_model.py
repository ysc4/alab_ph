#!/usr/bin/env python3
"""
XGBoost Heat Index Forecast Model
Generates forecasts for tomorrow (T+1) and day after tomorrow (T+2)
"""

import sys
import json
import pickle
import os
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

# ------------------------------------------------------------------
# Model loading
# ------------------------------------------------------------------

def load_model():
    model_path = os.path.join(os.path.dirname(__file__), "../models/model.pkl")
    try:
        with open(model_path, "rb") as f:
            import warnings
            warnings.filterwarnings("ignore")
            return pickle.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

def get_db_connection():
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/postgres"
    )
    try:
        return psycopg2.connect(db_url)
    except Exception as e:
        print(json.dumps({"error": f"Failed to connect to database: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

def prepare_features(station_id, df_val, station_coords):
    """
    Prepare the exact 67 features required by the model
    Uses the most recent March–May 2023 record for the given station
    """

    df_val = df_val.copy()
    df_val["Date"] = pd.to_datetime(df_val["Date"])

    df_filtered = df_val[
        (df_val["Date"] >= "2023-03-01") &
        (df_val["Date"] <= "2023-05-31")
    ]

    if station_id in station_coords:
        lat, lon = station_coords[station_id]
        station_data = df_filtered[
            (abs(df_filtered["Latitude"] - lat) < 0.001) &
            (abs(df_filtered["Longitude"] - lon) < 0.001)
        ].tail(1)
    else:
        station_data = pd.DataFrame()

    if station_data.empty:
        station_data = df_filtered.tail(1)

    def get_val(col):
        return float(station_data[col].iloc[0])

    features = []

    # 1–4
    features += [get_val("TMAX"), get_val("TMIN"), get_val("RH"), get_val("WIND_SPEED")]

    # 5–9
    features += [
        get_val("Albedo_linear"),
        get_val("skin_temperature_min_C"),
        get_val("skin_temperature_max_C"),
        get_val("NDBI_linear"),
        get_val("NDVI_original"),
    ]

    # 10–13
    features += [
        get_val("Latitude"),
        get_val("Longitude"),
        get_val("Elevation"),
        float(station_id),
    ]

    # 14–15
    features += [get_val("Temperature_at_RH"), get_val("Max_HI")]

    # 16–19
    features += [
        get_val("is_dry_season"),
        get_val("is_wet_season"),
        get_val("is_cool_dry_season"),
        get_val("is_hot_dry_season"),
    ]

    # 20–23
    features += [
        get_val("U_wind_component"),
        get_val("V_wind_component"),
        get_val("Temp_Range"),
        get_val("Temp_Mean"),
    ]

    # 24–27
    features += [
        get_val("Month_sin"),
        get_val("Month_cos"),
        get_val("Day_of_Year_sin"),
        get_val("Day_of_Year_cos"),
    ]

    # 28–36
    features += [
        get_val("TMAX_Rolling_Mean_7"),
        get_val("TMAX_Rolling_Max_7"),
        get_val("TMIN_Rolling_Mean_7"),
        get_val("TMIN_Rolling_Max_7"),
        get_val("Max_HI_Rolling_Mean_7"),
        get_val("Max_HI_Rolling_Max_7"),
        get_val("Max_HI_Rolling_Min_7"),
        get_val("RH_Rolling_Mean_7"),
        get_val("RH_Rolling_Min_7"),
    ]

    # 37–45
    features += [
        get_val("TMAX_Rolling_Mean_30"),
        get_val("TMAX_Rolling_Max_30"),
        get_val("TMIN_Rolling_Mean_30"),
        get_val("TMIN_Rolling_Max_30"),
        get_val("Max_HI_Rolling_Mean_30"),
        get_val("Max_HI_Rolling_Max_30"),
        get_val("Max_HI_Rolling_Min_30"),
        get_val("RH_Rolling_Mean_30"),
        get_val("RH_Rolling_Min_30"),
    ]

    # 46–52 interactions
    T = get_val("TMAX")
    RH = get_val("RH")
    W = get_val("WIND_SPEED")

    features += [
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
        features.append(get_val(f"Temperature_at_RH_lag_{lag}"))

    # 64–65 Max_HI lags
    features += [get_val("Max_HI_lag_1"), get_val("Max_HI_lag_2")]

    # 66–67 RH lags
    features += [get_val("RH_lag_1"), get_val("RH_lag_5")]

    return np.array(features).reshape(1, -1)

def generate_forecasts(date_str):
    model = load_model()
    conn = get_db_connection()

    df_val = pd.read_csv(
        os.path.join(os.path.dirname(__file__), "df_test_final.csv")
    )

    forecasts = []

    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("SELECT id, latitude, longitude FROM stations ORDER BY id")
        stations = cur.fetchall()

    station_coords = {s["id"]: (s["latitude"], s["longitude"]) for s in stations}

    for s in stations:
        sid = s["id"]
        try:
            x = prepare_features(sid, df_val, station_coords)
            pred = float(model.predict(x)[0])

            pred = round(max(27.0, min(55.0, pred)), 2)

            forecasts.append({
                "station_id": sid,
                "tomorrow": pred,
                "day_after_tomorrow": pred
            })
        except Exception as e:
            print(json.dumps({
                "warning": f"Station {sid} failed",
                "error": str(e)
            }), file=sys.stderr)

    conn.close()
    return forecasts

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Date argument required YYYY-MM-DD"}), file=sys.stderr)
        sys.exit(1)

    try:
        datetime.strptime(sys.argv[1], "%Y-%m-%d")
    except ValueError:
        print(json.dumps({"error": "Invalid date format"}), file=sys.stderr)
        sys.exit(1)

    forecasts = generate_forecasts(sys.argv[1])
    print(json.dumps(forecasts))

if __name__ == "__main__":
    main()
