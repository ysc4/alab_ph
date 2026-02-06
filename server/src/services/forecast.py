import sys
import json
import os
import pandas as pd
import numpy as np
import xgboost as xgb
import psycopg2
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, '..', '.env'))

# --- Configuration ---
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgb_hi_forecast_model.json")
DATABASE_URL = os.getenv('DATABASE_URL')
LOCAL_CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "df_test_final.csv")

# The exact 67 features your model was trained on
TRAINING_FEATURES = [
    'TMAX', 'TMIN', 'RH', 'WIND_SPEED', 'Albedo_linear', 'skin_temperature_min_C', 
    'skin_temperature_max_C', 'NDBI_linear', 'Latitude', 'Longitude', 'Elevation', 
    'Station', 'Temperature_at_RH', 'Max_HI', 'is_dry_season', 'is_wet_season', 
    'is_cool_dry_season', 'is_hot_dry_season', 'U_wind_component', 'V_wind_component', 
    'Temp_Range', 'Temp_Mean', 'Month_sin', 'Month_cos', 'Day_of_Year_sin', 
    'Day_of_Year_cos', 'TMAX_Rolling_Mean_7', 'TMAX_Rolling_Max_7', 'TMIN_Rolling_Mean_7', 
    'TMIN_Rolling_Max_7', 'Max_HI_Rolling_Mean_7', 'Max_HI_Rolling_Max_7', 
    'Max_HI_Rolling_Min_7', 'RH_Rolling_Mean_7', 'RH_Rolling_Min_7', 'TMAX_Rolling_Mean_30', 
    'TMAX_Rolling_Max_30', 'TMIN_Rolling_Mean_30', 'TMIN_Rolling_Max_30', 
    'Max_HI_Rolling_Mean_30', 'Max_HI_Rolling_Max_30', 'Max_HI_Rolling_Min_30', 
    'RH_Rolling_Mean_30', 'RH_Rolling_Min_30', 'T^2', 'RH^2', 'TxRH', 'T^2xRH', 
    'TxRH^2', 'T^2xRH^2', 'TMAX_x_WIND', 'Temperature_at_RH_lag_1', 'Temperature_at_RH_lag_2', 
    'Temperature_at_RH_lag_3', 'Temperature_at_RH_lag_4', 'Temperature_at_RH_lag_5', 
    'Temperature_at_RH_lag_6', 'Temperature_at_RH_lag_9', 'Temperature_at_RH_lag_10', 
    'Temperature_at_RH_lag_11', 'Temperature_at_RH_lag_12', 'Temperature_at_RH_lag_13', 
    'Max_HI_lag_1', 'RH_lag_1', 'RH_lag_2', 'RH_lag_5', 'RH_lag_6'
]

def main():
    # 1. Capture date from command line (Dashboard input)
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No date provided via command line"}))
        sys.exit(1)
    
    selected_date = sys.argv[1]

    try:
        # 2. Load Model
        model = xgb.XGBRegressor()
        model.load_model(MODEL_PATH)
        
        # Get the underlying Booster object
        booster = model.get_booster()
        
        # 3. Connect to Database and Load Data
        conn = psycopg2.connect(DATABASE_URL)
        
        # Query data for the specific date (lowercase column name in PostgreSQL)
        query = """
            SELECT * FROM df_test_final 
            WHERE date = %s
        """
        df_selected = pd.read_sql_query(query, conn, params=(selected_date,))
        conn.close()

        # PostgreSQL converts column names to lowercase, but our model expects mixed case
        # Create a mapping from lowercase to the original case
        column_map = {col.lower(): col for col in TRAINING_FEATURES}
        column_map.update({
            'date': 'Date',
            'year': 'YEAR', 
            'month': 'MONTH',
            'day': 'DAY',
            'tmax': 'TMAX',
            'tmin': 'TMIN',
            'rh': 'RH',
            'wind_speed': 'WIND_SPEED',
            'wind_direction': 'WIND_DIRECTION',
            'hi': 'HI',
            'albedo_linear': 'Albedo_linear',
            'albedo_spline': 'Albedo_spline',
            'skin_temperature_min_c': 'skin_temperature_min_C',
            'skin_temperature_max_c': 'skin_temperature_max_C',
            'ndbai_linear': 'NDBaI_linear',
            'ndbai_spline': 'NDBaI_spline',
            'ndbi_linear': 'NDBI_linear',
            'ndbi_spline': 'NDBI_spline',
            'ndvi_original': 'NDVI_original',
            'ndwi_linear': 'NDWI_linear',
            'ndwi_spline': 'NDWI_spline',
            'latitude': 'Latitude',
            'longitude': 'Longitude',
            'elevation': 'Elevation',
            'station': 'Station',
            'temperature_at_rh': 'Temperature_at_RH',
            'max_hi': 'Max_HI',
            'is_dry_season': 'is_dry_season',
            'is_wet_season': 'is_wet_season',
            'is_cool_dry_season': 'is_cool_dry_season',
            'is_hot_dry_season': 'is_hot_dry_season',
            'u_wind_component': 'U_wind_component',
            'v_wind_component': 'V_wind_component',
            'temp_range': 'Temp_Range',
            'temp_mean': 'Temp_Mean',
            'month_sin': 'Month_sin',
            'month_cos': 'Month_cos',
            'day_sin': 'Day_sin',
            'day_cos': 'Day_cos',
            'day_of_year': 'Day_of_Year',
            'day_of_year_sin': 'Day_of_Year_sin',
            'day_of_year_cos': 'Day_of_Year_cos',
            'is_weekend': 'is_weekend',
            't^2': 'T^2',
            'rh^2': 'RH^2',
            'txrh': 'TxRH',
            't^2xrh': 'T^2xRH',
            'txrh^2': 'TxRH^2',
            't^2xrh^2': 'T^2xRH^2',
            'tmax_x_wind': 'TMAX_x_WIND',
            'temprange_x_rh': 'TempRange_x_RH',
        })
        
        used_local_csv = False
        if df_selected.empty:
            # Fallback to local CSV if the database query returns no rows
            df_local = pd.read_csv(LOCAL_CSV_PATH)
            date_col = 'Date' if 'Date' in df_local.columns else 'date'
            df_selected = df_local[df_local[date_col] == selected_date].copy()
            used_local_csv = True

        # Rename columns to match the expected case
        df_selected.columns = [column_map.get(col.lower(), col) for col in df_selected.columns]

        if df_selected.empty:
            print(json.dumps({"error": f"No data found for date {selected_date}"}))
            sys.exit(1)

        # 4. Extract features and create DMatrix
        X_input = df_selected[TRAINING_FEATURES].copy()
        
        # Create DMatrix with explicit feature names
        dmatrix = xgb.DMatrix(
            X_input.values,
            feature_names=TRAINING_FEATURES
        )
        
        # Predict using Booster
        predictions = booster.predict(dmatrix)
        
        # 5. Format Results for Dashboard
        forecasts = []
        
        # Handle predictions shape
        if len(predictions.shape) == 1:
            predictions = predictions.reshape(-1, 1)
        
        # Zip Station IDs with their [t+1, t+2] prediction pairs
        for station_id, pred_row in zip(df_selected['Station'], predictions):
            if predictions.shape[1] >= 2:
                # Model outputs 2 values per sample
                forecasts.append({
                    "station": int(station_id) + 1,
                    "t1_forecast": round(float(pred_row[0]), 2),
                    "t2_forecast": round(float(pred_row[1]), 2)
                })
            else:
                # Model outputs 1 value per sample
                forecasts.append({
                    "station": int(station_id) + 1,
                    "t1_forecast": round(float(pred_row[0]), 2),
                    "t2_forecast": round(float(pred_row[0]), 2)
                })
        
        # Log flag for fallback usage without altering the main JSON output
        print(f"used_local_csv={str(used_local_csv).lower()}", file=sys.stderr)

        # Standard output for the dashboard to capture
        print(json.dumps(forecasts))

    except Exception as e:
        # Return error as JSON so the dashboard doesn't break
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()