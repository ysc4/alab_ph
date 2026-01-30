import { Router } from "express";
import { getDB } from "../db";
import { getDateRangeCondition, roundNumeric } from "../utils/queryHelpers";
import { connectRedis } from "../utils/redisClient";

const router = Router();

// Constants
const COLOR_MAP: Record<string, string> = {
  Caution: "#FFD700",
  "Extreme Caution": "#FFA500",
  Danger: "#FF4500",
  "Extreme Danger": "#8B0000"
};

const SORT_ORDER: Record<string, number> = {
  Caution: 1,
  "Extreme Caution": 2,
  Danger: 3,
  "Extreme Danger": 4
};

const DANGER_THRESHOLD = 41;

/**
 * Helper: Get date condition for queries
 */
const getDateCondition = (date?: string) => {
  return date
    ? "h.date = $1"
    : `h.date = (
        SELECT MAX(date)
        FROM heat_index hi
        WHERE hi.station = h.station
      )`;
};

/**
 * Helper: Calculate summary statistics from station data
 */
const calculateSummary = (stations: any[]) => {
  if (stations.length === 0) {
    return {
      max: 0,
      max_station: "",
      min: 0,
      min_station: "",
      avg: 0,
      danger_count: 0,
      fastest_increasing_station: "",
      fastest_increasing_trend: 0,
    };
  }

  const forecasts = stations.map(s => Number(s.forecasted));
  const max = Math.max(...forecasts);
  const min = Math.min(...forecasts);
  const avg = forecasts.reduce((a, b) => a + b, 0) / forecasts.length;
  const danger_count = stations.filter(s => Number(s.forecasted) >= DANGER_THRESHOLD).length;

  const maxStation = stations.reduce((prev, curr) =>
    Number(curr.forecasted) > Number(prev.forecasted) ? curr : prev
  );

  const minStation = stations.reduce((prev, curr) =>
    Number(curr.forecasted) < Number(prev.forecasted) ? curr : prev
  );

  const fastestStation = stations.reduce((prev, current) =>
    Number(current.trend) > Number(prev.trend) ? current : prev
  );

  return {
    max: Number(max.toFixed(2)),
    max_station: maxStation?.station_name || "",
    min: Number(min.toFixed(2)),
    min_station: minStation?.station_name || "",
    avg: Number(avg.toFixed(2)),
    danger_count,
    fastest_increasing_station: fastestStation.station_name,
    fastest_increasing_trend: Number(Number(fastestStation.trend).toFixed(2)),
  };
};

/**
 * Helper: Get trend data with correct date range
 */
const getTrendData = async (pool: any, date?: string, range?: string) => {
  if (!date) {
    return { rows: [] };
  }

  const d = new Date(date);
  let startDate: string;
  let endDate: string;

  if (range === 'Week') {
    // Rolling 7-day window: 6 days before + selected date
    const start = new Date(d);
    start.setDate(d.getDate() - 6);
    startDate = start.toISOString().slice(0, 10);
    endDate = d.toISOString().slice(0, 10);
  } else {
    // Month: full month of selected date
    startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  }

  console.log(`[getTrendData] Fetching trend data from ${startDate} to ${endDate}`);

  const trendQuery = `
    SELECT 
      TO_CHAR(date, 'YYYY-MM-DD') as date,
      ROUND(AVG(model_forecasted)::numeric, 2) AS avg_model_forecasted, 
      ROUND(AVG(pagasa_forecasted)::numeric, 2) AS avg_pagasa_forecasted, 
      ROUND(AVG(actual)::numeric, 2) AS observed
    FROM heat_index
    WHERE date >= $1 AND date <= $2
    GROUP BY date
    ORDER BY date
  `;

  try {
    const result = await pool.query(trendQuery, [startDate, endDate]);
    console.log(`[getTrendData] Found ${result.rows.length} rows`);
    
    // Ensure selected date is present
    const selectedStr = d.toISOString().slice(0, 10);
    const hasSelectedDate = result.rows.some((row: any) => row.date === selectedStr);
    
    if (!hasSelectedDate) {
      console.log(`[getTrendData] Selected date ${selectedStr} not found, adding it`);
      result.rows.push({
        date: selectedStr,
        avg_model_forecasted: 0,
        avg_pagasa_forecasted: 0,
        observed: 0
      });
      result.rows.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    
    return { rows: result.rows };
  } catch (error) {
    console.error('[getTrendData] Error:', error);
    return { rows: [] };
  }
};

/**
 * Format synoptic data with colors and sorting
 */
const formatSynopticData = (rows: any[]) => {
  return rows
    .map(row => ({
      name: row.name,
      value: Number(row.value),
      color: COLOR_MAP[row.name] || "#999999"
    }))
    .sort((a, b) => (SORT_ORDER[a.name] || 999) - (SORT_ORDER[b.name] || 999));
};

/**
 * Home Summary Route
 */
router.get("/home-summary", async (req, res) => {
  try {
    const pool = getDB();
    const { date, range } = req.query;
    const dateStr = date as string | undefined;
    const rangeStr = range as string | undefined;
    const cacheKey = `home-summary:${dateStr || "latest"}:${rangeStr || "default"}`;
    const redis = await connectRedis();
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const dateCondition = getDateCondition(dateStr);

    const [summaryResult, synopticResult, trendResult] = await Promise.all([
      // Summary query
      pool.query(
        `
          SELECT DISTINCT ON (mh.station)
            mh.station,
            s.station AS station_name,
            ROUND((mh.tomorrow)::numeric, 2) AS forecasted,
            COALESCE(h.trend, 0) AS trend
          FROM model_heat_index mh
          JOIN stations s ON s.id = mh.station
          LEFT JOIN heat_index h
            ON h.station = mh.station
           AND h.date = mh.date
          ${dateStr ? "WHERE mh.date = $1" : ""}
          ORDER BY mh.station, mh.date DESC
        `,
        dateStr ? [dateStr] : []
      ),

      // Synoptic classification query
      pool.query(
        `
          SELECT
            c.level AS name,
            COUNT(DISTINCT mh.station) AS value
          FROM model_heat_index mh
          JOIN stations s ON s.id = mh.station
          LEFT JOIN classification c
            ON mh.tomorrow >= c.min_temp
           AND mh.tomorrow < CAST(c.max_temp AS NUMERIC)
          WHERE mh.date = $1
          GROUP BY c.level
        `,
        dateStr ? [dateStr] : []
      ),

      // Trend query
      getTrendData(pool, dateStr, rangeStr)
    ]);

    const stations = summaryResult.rows;
    const summary = calculateSummary(stations);
    const synoptic = formatSynopticData(synopticResult.rows);
    const trend = trendResult.rows;

    const response = { summary, synoptic, trend };
    // Cache for 60 seconds
    await redis.setEx(cacheKey, 60, JSON.stringify(response));
    res.json(response);
  } catch (err) {
    console.error("Error in /home-summary:", err);
    res.status(500).json({ error: "Failed to load home summary" });
  }
});

/**
 * Forecast Error Route
 */
router.get("/forecast-error", async (req, res) => {
  try {
    const pool = getDB();
    const { range, date } = req.query;
    const cacheKey = `forecast-error:${range || "all"}:${date || "latest"}`;
    const redis = await connectRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let dateCondition: string;
    if (range === 'Week' && date) {
      // Rolling 7-day window: 6 days before + selected date
      const selectedDate = new Date(date as string);
      const startDate = new Date(selectedDate);
      startDate.setDate(selectedDate.getDate() - 6);
      dateCondition = `date >= '${startDate.toISOString().split('T')[0]}' AND date <= '${date}'`;
    } else {
      dateCondition = getDateRangeCondition(date as string, range as string);
    }

    const result = await pool.query(`
      SELECT
        date,
        EXTRACT(DAY FROM date)::integer AS day,
        ${roundNumeric('AVG(one_day_abs_error)', 0, 2)} AS t_plus_one,
        ${roundNumeric('AVG(two_day_abs_error)', 0, 2)} AS t_plus_two
      FROM model_heat_index
      WHERE ${dateCondition}
      GROUP BY date
      ORDER BY date
    `);

    const formatted = result.rows.map(row => ({
      day: row.day,
      date: row.date,
      t_plus_one: row.t_plus_one ? Number(row.t_plus_one) : 0,
      t_plus_two: row.t_plus_two ? Number(row.t_plus_two) : 0
    }));
    await redis.setEx(cacheKey, 60, JSON.stringify(formatted));
    res.json(formatted);
  } catch (err) {
    console.error("Error in /forecast-error:", err);
    res.status(500).json({ error: "Failed to load forecast error data" });
  }
});

/**
 * Stations Table Route
 */
router.get("/stations-table", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;
    const selectedDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = `stations-table:${selectedDate}`;
    const redis = await connectRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const query = `
      SELECT
        s.station AS name,
        ROUND(mh.tomorrow::numeric, 1) AS heat_index,
        COALESCE(c.level, 'N/A') AS risk_level,
        ROUND(ht.trend::numeric, 1) AS trend
      FROM model_heat_index mh
      JOIN stations s ON s.id = mh.station
      LEFT JOIN heat_index ht
        ON ht.station = mh.station
       AND ht.date = mh.date + INTERVAL '1 day'
      LEFT JOIN classification c
        ON mh.tomorrow < c.max_temp 
       AND (c.min_temp IS NULL OR mh.tomorrow >= c.min_temp)
      WHERE mh.date = $1
      ORDER BY s.station
    `;

    const result = await pool.query(query, [selectedDate]);
    const formatted = result.rows.map(row => ({
      name: row.name,
      heat_index: row.heat_index !== null ? Number(row.heat_index) : null,
      risk_level: row.risk_level,
      trend: row.trend !== null
        ? `${row.trend > 0 ? '+' : ''}${Number(row.trend).toFixed(1)}°C`
        : null
    }));
    await redis.setEx(cacheKey, 60, JSON.stringify(formatted));
    res.json(formatted);
  } catch (err) {
    console.error("Error in /stations-table:", err);
    res.status(500).json({ error: "Failed to load stations table" });
  }
});

export default router;