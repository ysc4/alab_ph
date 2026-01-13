import { Router } from "express";
import { getDB } from "../db";

const router = Router();

// Fetch all stations with lat/lng and latest heat_index (or specific date)
router.get("/stations-map", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    const query = `
      SELECT
        s.id,
        s.station AS name,
        s.latitude AS lat,
        s.longitude AS lng,
        COALESCE(hi.actual, 0) AS temp,
        COALESCE(hi.pagasa_forecasted, 0) AS forecasted,
        COALESCE(hi.model_forecasted, 0) AS modelForecasted,
        COALESCE(c.level, 'N/A') AS riskLevel,
        COALESCE(hi.date::text, $1::text) AS selectedDate
      FROM stations s
      LEFT JOIN LATERAL (
        SELECT *
        FROM heat_index
        WHERE station = s.id
        ${date ? `AND date = $1` : ""}
        ORDER BY date DESC
        LIMIT 1
      ) hi ON true
      LEFT JOIN classification c
        ON hi.risk_level = c.id
      WHERE s.latitude IS NOT NULL
        AND s.longitude IS NOT NULL
      ORDER BY s.station;
    `;

    const result = await pool.query(query, [date || null]);

    const stations = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      lat: parseFloat(row.lat ?? 0),
      lng: parseFloat(row.lng ?? 0),
      temp: parseFloat(row.temp ?? 0),
      forecasted: parseFloat(row.forecasted ?? 0),
      modelForecasted: parseFloat(row.modelforecasted ?? 0),
      riskLevel: row.risklevel,
      selectedDate: row.selecteddate,
    }));

    res.json(stations);
  } catch (err) {
    console.error("Error fetching stations for map:", err);
    res.status(500).json({ error: "Failed to fetch stations for map" });
  }
});

// Fetch single station by ID with latest heat_index
router.get("/station-markers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const pool = getDB();

    const query = `
      SELECT
        s.id,
        s.station AS name,
        s.latitude AS lat,
        s.longitude AS lng,
        COALESCE(hi.actual, 0) AS temp,
        COALESCE(hi.pagasa_forecasted, 0) AS forecasted,
        COALESCE(hi.model_forecasted, 0) AS modelForecasted,
        COALESCE(c.level, 'N/A') AS riskLevel,
        COALESCE(hi.date::text, $2::text) AS selectedDate
      FROM stations s
      LEFT JOIN LATERAL (
        SELECT *
        FROM heat_index
        WHERE station = s.id
        ${date ? `AND date = $2` : ""}
        ORDER BY date DESC
        LIMIT 1
      ) hi ON true
      LEFT JOIN classification c
        ON hi.risk_level = c.id
      WHERE s.id = $1;
    `;

    const result = await pool.query(query, [id, date || null]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Station marker not found" });
    }

    const row = result.rows[0];
    const markerData = {
      id: row.id,
      name: row.name,
      lat: parseFloat(row.lat ?? 0),
      lng: parseFloat(row.lng ?? 0),
      temp: parseFloat(row.temp ?? 0),
      forecasted: parseFloat(row.forecasted ?? 0),
      modelForecasted: parseFloat(row.modelforecasted ?? 0),
      riskLevel: row.risklevel,
      selectedDate: row.selecteddate,
    };

    res.json(markerData);
  } catch (err) {
    console.error("Error fetching station marker:", err);
    res.status(500).json({ error: "Failed to fetch station marker" });
  }
});

export default router;
