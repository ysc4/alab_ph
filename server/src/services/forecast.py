import sys
import json
import os
import pandas as pd
import numpy as np
import xgboost as xgb

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgb_hi_forecast_model.json")
DATA_PATH = os.path.join(BASE_DIR, "services", "df_test_final.csv")

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
        
        # 3. Load Data
        df = pd.read_csv(DATA_PATH)
        
        # 4. Filter data for the specific date
        mask = df['Date'] == selected_date
        df_selected = df[mask].copy()
        
        if df_selected.empty:
            print(json.dumps({"error": f"No data found for date {selected_date}"}))
            sys.exit(1)

        # 5. Extract features and create DMatrix
        X_input = df_selected[TRAINING_FEATURES].copy()
        
        # Create DMatrix with explicit feature names
        dmatrix = xgb.DMatrix(
            X_input.values,
            feature_names=TRAINING_FEATURES
        )
        
        # Predict using Booster
        predictions = booster.predict(dmatrix)
        
        # 6. Format Results for Dashboard
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
        
        # Standard output for the dashboard to capture
        print(json.dumps(forecasts))

    except Exception as e:
        # Return error as JSON so the dashboard doesn't break
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()