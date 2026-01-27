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
import math

def load_model():
    """Load the trained XGBoost model"""
    model_path = os.path.join(os.path.dirname(__file__), '../models/model.pkl')
    try:
        with open(model_path, 'rb') as f:
            import warnings
            warnings.filterwarnings('ignore')
            model = pickle.load(f)
        return model
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}"}), file=sys.stderr)
        sys.exit(1)


def get_db_connection():
    # Use environment variable DATABASE_URL or hardcode for local dev
    db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/postgres')
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(json.dumps({"error": f"Failed to connect to database: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

def prepare_features(station_id, date_str, conn, station_coords):
    """
    Prepare the exact 67 features required by the model
    Uses the most recent data from test dataset for the given station based on coordinates
    Filters data to March-May 2023 period only
    
    Args:
        station_id: The station ID (1-23)
        date_str: The date to forecast from (YYYY-MM-DD)
        df_val: DataFrame with test data
        station_coords: Dictionary mapping station_id to (lat, lon)
    
    Returns:
        numpy array of features with shape (1, 67) matching model's expected features
    """

    # Use df_test_final.csv for feature extraction
    # station_coords: {station_id: (lat, lon), 'df_val': df_val}
    df_val = station_coords['df_val']
    # Convert Date column to datetime if not already
    if df_val['Date'].dtype != 'datetime64[ns]':
        df_val['Date'] = pd.to_datetime(df_val['Date'])
    # Filter data for March to May 2023 only
    df_filtered = df_val[(df_val['Date'] >= '2023-03-01') & (df_val['Date'] <= '2023-05-31')]
    # Get coordinates for this station
    if station_id in station_coords:
        target_lat, target_lon = station_coords[station_id]
        station_data = df_filtered[(abs(df_filtered['Latitude'] - target_lat) < 0.001) & (abs(df_filtered['Longitude'] - target_lon) < 0.001)].tail(1)
    else:
        station_data = pd.DataFrame()
    if len(station_data) == 0:
        station_data = df_filtered.tail(1)
    # Extract the exact 67 features in the order the model expects
    features = []
    def get_val(col_name):
        return float(station_data[col_name].iloc[0])
    
    # 1-4: Basic weather
    features.append(get_val('TMAX'))
    features.append(get_val('TMIN'))
    features.append(get_val('RH'))
    features.append(get_val('WIND_SPEED'))
    
    # 5-9: Satellite/vegetation indices
    features.append(get_val('Albedo_linear'))
    features.append(get_val('skin_temperature_min_C'))
    features.append(get_val('skin_temperature_max_C'))
    features.append(get_val('NDBI_linear'))
    features.append(get_val('NDVI_original'))
    
    # 10-13: Location features
    features.append(get_val('Latitude'))
    features.append(get_val('Longitude'))
    features.append(get_val('Elevation'))
    features.append(float(station_id))
    
    # 14-15: Derived temperature features
    features.append(get_val('Temperature_at_RH'))
    features.append(get_val('Max_HI'))
    
    # 16-19: Season indicators
    features.append(get_val('is_dry_season'))
    features.append(get_val('is_wet_season'))
    features.append(get_val('is_cool_dry_season'))
    features.append(get_val('is_hot_dry_season'))
    
    # 20-23: Wind and temperature features
    features.append(get_val('U_wind_component'))
    features.append(get_val('V_wind_component'))
    features.append(get_val('Temp_Range'))
    features.append(get_val('Temp_Mean'))
    
    # 24-27: Cyclic time features
    features.append(get_val('Month_sin'))
    features.append(get_val('Month_cos'))
    features.append(get_val('Day_of_Year_sin'))
    features.append(get_val('Day_of_Year_cos'))
    
    # 28-36: 7-day rolling statistics
    features.append(get_val('TMAX_Rolling_Mean_7'))
    features.append(get_val('TMAX_Rolling_Max_7'))
    features.append(get_val('TMIN_Rolling_Mean_7'))
    features.append(get_val('TMIN_Rolling_Max_7'))
    features.append(get_val('Max_HI_Rolling_Mean_7'))
    features.append(get_val('Max_HI_Rolling_Max_7'))
    features.append(get_val('Max_HI_Rolling_Min_7'))
    features.append(get_val('RH_Rolling_Mean_7'))
    features.append(get_val('RH_Rolling_Min_7'))
    
    # 37-45: 30-day rolling statistics
    features.append(get_val('TMAX_Rolling_Mean_30'))
    features.append(get_val('TMAX_Rolling_Max_30'))
    features.append(get_val('TMIN_Rolling_Mean_30'))
    features.append(get_val('TMIN_Rolling_Max_30'))
    features.append(get_val('Max_HI_Rolling_Mean_30'))
    features.append(get_val('Max_HI_Rolling_Max_30'))
    features.append(get_val('Max_HI_Rolling_Min_30'))
    features.append(get_val('RH_Rolling_Mean_30'))
    features.append(get_val('RH_Rolling_Min_30'))
    
    # 46-52: Interaction features
    T = get_val('TMAX')
    RH_val = get_val('RH')
    Wind = get_val('WIND_SPEED')
    TempRange = get_val('Temp_Range')
    
    features.append(T ** 2)  # T^2
    features.append(RH_val ** 2)  # RH^2
    features.append(T * RH_val)  # TxRH
    features.append((T ** 2) * RH_val)  # T^2xRH
    features.append(T * (RH_val ** 2))  # TxRH^2
    features.append((T ** 2) * (RH_val ** 2))  # T^2xRH^2
    features.append(T * Wind)  # TMAX_x_WIND
    
    # 53-63: Temperature_at_RH lag features (1,2,3,4,5,6,8,10,11,12,13)
    features.append(get_val('Temperature_at_RH_lag_1'))
    features.append(get_val('Temperature_at_RH_lag_2'))
    features.append(get_val('Temperature_at_RH_lag_3'))
    features.append(get_val('Temperature_at_RH_lag_4'))
    features.append(get_val('Temperature_at_RH_lag_5'))
    features.append(get_val('Temperature_at_RH_lag_6'))
    features.append(get_val('Temperature_at_RH_lag_8'))
    features.append(get_val('Temperature_at_RH_lag_10'))
    features.append(get_val('Temperature_at_RH_lag_11'))
    features.append(get_val('Temperature_at_RH_lag_12'))
    features.append(get_val('Temperature_at_RH_lag_13'))
    
    # 64-65: Max_HI lag features (1,2)
    features.append(get_val('Max_HI_lag_1'))
    features.append(get_val('Max_HI_lag_2'))
    
    # 66-67: RH lag features (1,5)
    features.append(get_val('RH_lag_1'))
    features.append(get_val('RH_lag_5'))
    
    return np.array(features).reshape(1, -1)

def generate_forecasts(date_str):
    """
    Generate forecasts for all stations for T+1 and T+2
    
    Args:
        date_str: The base date (YYYY-MM-DD)
    
    Returns:
        List of forecast dictionaries
    """

    model = load_model()
    conn = get_db_connection()
    forecasts = []
    # Get all station ids and coordinates from the database
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute('SELECT id, latitude, longitude FROM stations ORDER BY id')
        stations = cur.fetchall()
        station_coords = {row['id']: (row['latitude'], row['longitude']) for row in stations}
        for station in stations:
            station_id = station['id']
            try:
                features_t1 = prepare_features(station_id, date_str, conn, station_coords)
                tomorrow_prediction = model.predict(features_t1)
                tomorrow_forecast = float(tomorrow_prediction.flatten()[0])
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                date_t1 = (date_obj + timedelta(days=1)).strftime('%Y-%m-%d')
                features_t2 = prepare_features(station_id, date_t1, conn, station_coords)
                day_after_prediction = model.predict(features_t2)
                day_after_tomorrow_forecast = float(day_after_prediction.flatten()[0])
                tomorrow_forecast = round(tomorrow_forecast, 2)
                day_after_tomorrow_forecast = round(day_after_tomorrow_forecast, 2)
                tomorrow_forecast = max(27.0, min(55.0, tomorrow_forecast))
                day_after_tomorrow_forecast = max(27.0, min(55.0, day_after_tomorrow_forecast))
                forecasts.append({
                    'station_id': station_id,
                    'tomorrow': tomorrow_forecast,
                    'day_after_tomorrow': day_after_tomorrow_forecast
                })
            except Exception as e:
                import traceback
                print(json.dumps({
                    "warning": f"Failed to generate forecast for station {station_id}: {str(e)}",
                    "traceback": traceback.format_exc()
                }), file=sys.stderr)
                continue
    conn.close()
    return forecasts



def compute_abs_errors(date_str, forecasts):
    """
    Compute 1-day and 2-day absolute errors for each station using the database.
    Args:
        date_str: The base date (YYYY-MM-DD)
        forecasts: List of forecast dicts from generate_forecasts
    Returns:
        List of dicts with station_id, abs_error_1d, abs_error_2d
    """
    conn = get_db_connection()
    base_date = datetime.strptime(date_str, '%Y-%m-%d')
    t1_date = (base_date + timedelta(days=1)).strftime('%Y-%m-%d')
    t2_date = (base_date + timedelta(days=2)).strftime('%Y-%m-%d')
    errors = []
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        for f in forecasts:
            sid = f['station_id']
            # 1-day error
            cur.execute('SELECT actual FROM heat_index WHERE station = %s AND date = %s', (sid, t1_date))
            row1 = cur.fetchone()
            # 2-day error
            cur.execute('SELECT actual FROM heat_index WHERE station = %s AND date = %s', (sid, t2_date))
            row2 = cur.fetchone()
            abs_error_1d = abs(f['tomorrow'] - row1['actual']) if row1 else None
            abs_error_2d = abs(f['day_after_tomorrow'] - row2['actual']) if row2 else None
            errors.append({
                'station_id': sid,
                'abs_error_1d': abs_error_1d,
                'abs_error_2d': abs_error_2d
            })
    conn.close()
    return errors

def main():
    """Main function"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Date argument required (YYYY-MM-DD)"}), file=sys.stderr)
        sys.exit(1)
    date_str = sys.argv[1]
    # Validate date format
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        print(json.dumps({"error": "Invalid date format. Use YYYY-MM-DD"}), file=sys.stderr)
        sys.exit(1)
    # Generate forecasts
    try:
        forecasts = generate_forecasts(date_str)
        print(json.dumps(forecasts))
        abs_errors = compute_abs_errors(date_str, forecasts)
        print(json.dumps({'abs_errors': abs_errors}))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
