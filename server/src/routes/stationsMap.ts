import { Router } from "express";
import { getDB } from "../db";
import { roundNumeric, getRiskLevelCase } from "../utils/queryHelpers";
import { connectRedis } from "../utils/redisClient";

const router = Router();

/**
 * Shared query logic for station marker data
 */
const getStationQuery = (stationFilter: string) => `
  SELECT DISTINCT ON (s.id)
    s.id,
    s.station AS name,
    s.latitude AS lat,
    s.longitude AS lng,
    ${roundNumeric('hi.actual', 0)} AS temp,
    ${roundNumeric('hi.pagasa_forecasted', 0)} AS forecasted,
    ${roundNumeric('hi.model_forecasted', 0)} AS modelForecasted,
    ${getRiskLevelCase('hi.model_forecasted')} AS riskLevel,
    COALESCE(hi.date::text, $1::text) AS selectedDate
  FROM stations s
  LEFT JOIN LATERAL (
    SELECT *
    FROM heat_index
    WHERE station = s.id
    AND ($1::text IS NULL OR date::text = $1)
    ORDER BY date DESC
    LIMIT 1
  ) hi ON true
  LEFT JOIN classification c
    ON hi.model_forecasted >= c.min_temp AND hi.model_forecasted < CAST(c.max_temp AS NUMERIC) + 1
  WHERE s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    ${stationFilter}
  ORDER BY s.id, s.station;
`;

// Add caching to /stations-map
router.get("/stations-map", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;
    const selectedDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = `stations-map:${selectedDate}`;
    const redis = await connectRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    const query = `
      SELECT
        s.id,
        s.station,
        s.lat,
        s.lon,
        mh.tomorrow AS heat_index,
        c.level AS risk_level
      FROM stations s
      LEFT JOIN model_heat_index mh ON s.id = mh.station AND mh.date = $1
      LEFT JOIN classification c ON mh.tomorrow < c.max_temp AND (c.min_temp IS NULL OR mh.tomorrow >= c.min_temp)
      ORDER BY s.station
    `;
    const result = await pool.query(query, [selectedDate]);
    const formatted = result.rows.map(row => ({
      id: row.id,
      name: row.station,
      lat: row.lat,
      lon: row.lon,
      heat_index: row.heat_index !== null ? Number(row.heat_index) : null,
      risk_level: row.risk_level || 'N/A'
    }));
    await redis.setEx(cacheKey, 60, JSON.stringify(formatted));
    res.json(formatted);
  } catch (err) {
    console.error("Error in /stations-map:", err);
    res.status(500).json({ error: "Failed to load stations map" });
  }
});

// Fetch single station by ID with latest heat_index
router.get("/station-markers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const pool = getDB();

    const result = await pool.query(getStationQuery('AND s.id = $2'), [date || null, id]);

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
