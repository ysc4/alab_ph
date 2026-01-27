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

    // Parse Python output (expecting JSON with forecasts)
    let forecasts;
    try {
      forecasts = JSON.parse(stdout);
    } catch (parseError) {
      console.error("Failed to parse Python output:", stdout);
      throw new Error("Invalid forecast data from model");
    }

    console.log(`Received ${forecasts.length} forecasts from model`);

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

      console.log(`Processing station ${station_id}: tomorrow=${tomorrowTemp}, day_after=${dayAfterTomorrowTemp}`);

      try {
        // Check if record already exists for this date and station
        // Using date as-is since it's already in YYYY-MM-DD format
        const existingRecord = await pool.query(
          `SELECT id FROM model_heat_index WHERE station = $1 AND date = $2`,
          [station_id, date]
        );

        console.log(`Existing record check for station ${station_id}: found ${existingRecord.rows.length} records`);

        if (existingRecord.rows.length > 0) {
          // Update existing record
          console.log(`Updating existing record for station ${station_id} on date ${date}`);
          const updateResult = await pool.query(
            `UPDATE model_heat_index 
             SET tomorrow = $1, day_after_tomorrow = $2
             WHERE station = $3 AND date = $4
             RETURNING id, station, date, tomorrow, day_after_tomorrow`,
            [tomorrowTemp, dayAfterTomorrowTemp, station_id, date]
          );
          console.log(`Update result:`, updateResult.rows);
          updateCount++;
        } else {
          // Insert new record (date is already in YYYY-MM-DD format)
          console.log(`Inserting new record for station ${station_id} on date ${date}`);
          const insertResult = await pool.query(
            `INSERT INTO model_heat_index (station, date, tomorrow, day_after_tomorrow)
             VALUES ($1, $2, $3, $4)
             RETURNING id, station, date, tomorrow, day_after_tomorrow`,
            [station_id, date, tomorrowTemp, dayAfterTomorrowTemp]
          );
          console.log(`Insert result:`, insertResult.rows);
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
