import { Router } from "express";

import { getDB } from "../db";
import path from "path";
import { promisify } from "util";
import { exec, execSync } from "child_process";

const router = Router();

const execAsync = promisify(exec);

// Find python3 path at runtime
let PYTHON_EXEC = "python3";
try {
  PYTHON_EXEC = execSync("which python3").toString().trim();
} catch (e) {
  console.warn("python3 not found in PATH, falling back to 'python3'");
}

/**
 * Generate forecasts using the XGBoost model and store in model_heat_index table
 * Only forecasts tomorrow (T+1) and day after tomorrow (T+2)
 * Absolute errors are computed directly in the database
 */
router.post("/generate-forecasts", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required in request body" });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }

    console.log(`Starting forecast generation for date: ${date}`);

    // Get all stations
    const stationsResult = await pool.query(`
      SELECT id, station, latitude, longitude
      FROM stations
      ORDER BY id
    `);

    const stations = stationsResult.rows;
    console.log(`Found ${stations.length} stations`);

    // Path to Python script
    const pythonScriptPath = path.join(__dirname, "../services/forecast.py");
    console.log("Python script path:", pythonScriptPath);

    // Execute Python script
    console.log("Executing Python forecast model...");
    const { stdout, stderr } = await execAsync(
      `${PYTHON_EXEC} "${pythonScriptPath}" "${date}"`,
      { maxBuffer: 1024 * 1024 * 10 }
    );

    if (stderr) {
      console.warn("Python stderr:", stderr);
    }

    // Parse Python output (expects JSON array of forecasts)
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    let forecasts: any[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (Array.isArray(obj)) {
          forecasts = obj;
        }
      } catch {
        // Ignore non-JSON lines
      }
    }

    if (!forecasts.length) {
      console.error("No forecasts parsed from Python output:", stdout);
      throw new Error("Invalid forecast data from model");
    }

    console.log(`Received ${forecasts.length} forecasts from model`);

    let insertCount = 0;
    let updateCount = 0;

    console.log("Testing database connection...");
    await pool.query("SELECT 1");


    for (const forecast of forecasts) {
      // Adapt to output keys from forecast_model.py
      // forecast = { station_id, t1_forecast, t2_forecast }
      const {
        station_id,
        t1_forecast: tomorrowTemp,
        t2_forecast: dayAfterTomorrowTemp
      } = forecast;

      try {
        const existingRecord = await pool.query(
          `SELECT id FROM model_heat_index WHERE station = $1 AND date = $2`,
          [station_id, date]
        );

        if (existingRecord.rows.length > 0) {
          await pool.query(
            `UPDATE model_heat_index
             SET tomorrow = $1,
                 day_after_tomorrow = $2
             WHERE station = $3 AND date = $4`,
            [tomorrowTemp, dayAfterTomorrowTemp, station_id, date]
          );
          updateCount++;
        } else {
          await pool.query(
            `INSERT INTO model_heat_index
             (station, date, tomorrow, day_after_tomorrow)
             VALUES ($1, $2, $3, $4)`,
            [station_id, date, tomorrowTemp, dayAfterTomorrowTemp]
          );
          insertCount++;
        }
      } catch (dbError) {
        console.error(`Database error for station ${station_id}:`, dbError);
        throw dbError;
      }
    }

    console.log(`Forecast storage complete: ${insertCount} inserted, ${updateCount} updated`);

    // Compute 1-day absolute error
    console.log("Computing 1-day absolute error...");
    await pool.query(`
      UPDATE model_heat_index m
      SET "1day_abs_error" = ABS(a.actual - y.tomorrow)
      FROM heat_index a
      JOIN model_heat_index y
        ON y.station = m.station
       AND y.date = m.date - INTERVAL '1 day'
      WHERE a.station = m.station
        AND a.date = m.date
    `);

    // Compute 2-day absolute error
    console.log("Computing 2-day absolute error...");
    await pool.query(`
      UPDATE model_heat_index m
      SET "2day_abs_error" = ABS(a.actual - t.day_after_tomorrow)
      FROM heat_index a
      JOIN model_heat_index t
        ON t.station = m.station
       AND t.date = m.date - INTERVAL '2 day'
      WHERE a.station = m.station
        AND a.date = m.date
    `);

    // Verify records
    const verifyResult = await pool.query(
      `SELECT COUNT(*) AS count FROM model_heat_index WHERE date = $1`,
      [date]
    );

    console.log(`Verification complete: ${verifyResult.rows[0].count} records for ${date}`);

    res.json({
      success: true,
      message: `Generated forecasts for ${insertCount + updateCount} stations`,
      date,
      stations_processed: insertCount + updateCount,
      inserted: insertCount,
      updated: updateCount
    });

  } catch (error) {
    console.error("Error generating forecasts:", error);
    res.status(500).json({
      error: "Failed to generate forecasts",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
