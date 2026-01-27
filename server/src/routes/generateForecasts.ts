import { Router } from "express";
import { getDB } from "../db";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const router = Router();
const execAsync = promisify(exec);

/**
 * Generate forecasts using the XGBoost model and store in model_heat_index table
 * Only forecasts tomorrow (T+1) and day after tomorrow (T+2)
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

    console.log(`Starting forecast generation for date: ${date} (format: YYYY-MM-DD)`);

    // Get all stations
    const stationsResult = await pool.query(`
      SELECT id, station, latitude, longitude
      FROM stations
      ORDER BY id
    `);

    const stations = stationsResult.rows;
    console.log(`Found ${stations.length} stations`);

    // Path to Python script
    // services folder is copied to dist during build, so this path works in both dev and production
    const pythonScriptPath = path.join(__dirname, "../services/forecast_model.py");
    
    console.log("Python script path:", pythonScriptPath);
    
    // Execute Python script to generate forecasts
    console.log("Executing Python forecast model...");
    const { stdout, stderr } = await execAsync(
      `python "${pythonScriptPath}" "${date}"`,
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );

    if (stderr) {
      console.warn("Python stderr:", stderr);
    }


    // Parse Python output (expecting JSON with forecasts and abs_errors)
    // The Python script prints two JSON objects: forecasts and {'abs_errors': ...}
    // We'll split the output by lines and parse both
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    let forecasts: any[] = [];
    let absErrors: any[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (Array.isArray(obj)) {
          forecasts = obj;
        } else if (obj.abs_errors) {
          absErrors = obj.abs_errors;
        }
      } catch (e) {
        // Ignore lines that are not JSON
      }
    }
    if (!forecasts.length) {
      console.error("No forecasts parsed from Python output:", stdout);
      throw new Error("Invalid forecast data from model");
    }
    if (!absErrors.length) {
      console.error("No abs_errors parsed from Python output:", stdout);
      throw new Error("No abs_errors data from model");
    }
    console.log(`Received ${forecasts.length} forecasts and ${absErrors.length} abs_errors from model`);

    // Calculate dates for T+1 and T+2
    const baseDate = new Date(date);
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(baseDate.getDate() + 1);
    const dayAfterTomorrow = new Date(baseDate);
    dayAfterTomorrow.setDate(baseDate.getDate() + 2);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];

    // Store forecasts in database
    let insertCount = 0;
    let updateCount = 0;
    
    console.log(`Starting database insertion for ${forecasts.length} forecasts...`);
    console.log(`Database connection status: ${pool ? 'Connected' : 'Not connected'}`);
    
    // Test database connection
    try {
      const testQuery = await pool.query('SELECT 1 as test');
      console.log(`Database test query successful:`, testQuery.rows);
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      throw new Error('Database connection failed');
    }
    
    for (const forecast of forecasts) {
      const { station_id, tomorrow: tomorrowTemp, day_after_tomorrow: dayAfterTomorrowTemp } = forecast;
      // Find matching abs error for this station
      const err = absErrors.find((e: any) => e.station_id === station_id);
      const absError1d = err ? err.abs_error_1d : null;
      const absError2d = err ? err.abs_error_2d : null;

      console.log(`Processing station ${station_id}: tomorrow=${tomorrowTemp}, day_after=${dayAfterTomorrowTemp}, abs_error_1d=${absError1d}, abs_error_2d=${absError2d}`);

      try {
        // Check if record already exists for this date and station
        const existingRecord = await pool.query(
          `SELECT id FROM model_heat_index WHERE station = $1 AND date = $2`,
          [station_id, date]
        );

        if (existingRecord.rows.length > 0) {
          // Update existing record
          const updateResult = await pool.query(
            `UPDATE model_heat_index 
             SET tomorrow = $1, day_after_tomorrow = $2, 1day_abs_error = $3, 2day_abs_error = $4
             WHERE station = $5 AND date = $6
             RETURNING id, station, date, tomorrow, day_after_tomorrow, 1day_abs_error, 2day_abs_error`,
            [tomorrowTemp, dayAfterTomorrowTemp, absError1d, absError2d, station_id, date]
          );
          updateCount++;
        } else {
          // Insert new record
          const insertResult = await pool.query(
            `INSERT INTO model_heat_index (station, date, tomorrow, day_after_tomorrow, 1day_abs_error, 2day_abs_error)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, station, date, tomorrow, day_after_tomorrow, 1day_abs_error, 2day_abs_error`,
            [station_id, date, tomorrowTemp, dayAfterTomorrowTemp, absError1d, absError2d]
          );
          insertCount++;
        }
      } catch (dbError) {
        console.error(`Database error for station ${station_id}:`, dbError);
        throw dbError;
      }
    }

    // Verify the data was inserted
    const verifyResult = await pool.query(
      `SELECT COUNT(*) as count FROM model_heat_index WHERE date = $1`,
      [date]
    );
    console.log(`Verification: Found ${verifyResult.rows[0].count} records in database for date ${date}`);

    console.log(`Successfully stored forecasts: ${insertCount} inserted, ${updateCount} updated`);

    res.json({
      success: true,
      message: `Generated and stored forecasts for ${insertCount + updateCount} stations (${insertCount} new, ${updateCount} updated)`,
      date: date,
      tomorrow_date: tomorrowStr,
      day_after_tomorrow_date: dayAfterTomorrowStr,
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
