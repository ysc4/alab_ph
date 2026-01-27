import { Router } from "express";
import { getDB } from "../db";
import { getDateRangeCondition, roundNumeric } from "../utils/queryHelpers";

const router = Router();

/**
 * Home Summary Route
 */
router.get("/home-summary", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    const dateCondition = date
      ? 'h.date = $1'
      : `h.date = (
          SELECT MAX(date)
          FROM heat_index hi
          WHERE hi.station = h.station
        )`;

    // Fetch summary, model averages, and synoptic counts in parallel
    const [summaryResult, pagasaModelAvgResult, synopticResult] = await Promise.all([
      pool.query(
        `SELECT DISTINCT ON (mh.station)
          mh.station,
          s.station AS station_name,
          ${roundNumeric('mh.tomorrow', 0)} AS forecasted,
          ${roundNumeric('h.trend', 0)} as trend,
          ${roundNumeric('h.model_forecasted', 0)} as model_forecasted,
          ${roundNumeric('h.pagasa_forecasted', 0)} as pagasa_forecasted
        FROM model_heat_index mh
        JOIN stations s ON s.id = mh.station
        LEFT JOIN heat_index h ON h.station = mh.station AND h.date = mh.date
        ${date ? 'WHERE mh.date = $1' : ''}
        ORDER BY mh.station, mh.date DESC`,
        date ? [date] : []
      ),
      pool.query(
        `SELECT
          ROUND(AVG(h.model_forecasted)::numeric, 2) AS avg_model_forecasted,
          ROUND(AVG(h.pagasa_forecasted)::numeric, 2) AS avg_pagasa_forecasted
        FROM heat_index h
        WHERE ${dateCondition}`,
        date ? [date] : []
      ),
      pool.query(
        `SELECT
          c.level AS name,
          COUNT(DISTINCT h.station) AS value
        FROM heat_index h
        JOIN classification c
          ON h.actual >= c.min_temp AND h.actual < CAST(c.max_temp AS NUMERIC) + 1
        WHERE ${dateCondition}
        GROUP BY c.level`,
        date ? [date] : []
      )
    ]);

    const stations = summaryResult.rows;
    let summary = {
      max: 0,
      max_station: '',
      min: 0,
      min_station: '',
      avg: 0,
      danger_count: 0,
      fastest_increasing_station: '',
      fastest_increasing_trend: 0,
      avg_model_forecasted: 0,
      avg_pagasa_forecasted: 0
    };

    if (stations.length > 0) {
      const forecasts = stations.map(s => Number(s.forecasted));
      const max = Math.max(...forecasts);
      const min = Math.min(...forecasts);
      const avg = Math.round((forecasts.reduce((a, b) => a + b, 0) / forecasts.length) * 100) / 100;
      const danger_count = stations.filter(s => Number(s.forecasted) >= 41).length;
      const maxStation = stations.find(s => Number(s.forecasted) === max);
      const minStation = stations.find(s => Number(s.forecasted) === min);
      const fastestStation = stations.reduce((prev, current) =>
        Number(current.trend) > Number(prev.trend) ? current : prev
      );

      summary = {
        max,
        max_station: maxStation?.station_name || '',
        min,
        min_station: minStation?.station_name || '',
        avg,
        avg_model_forecasted: pagasaModelAvgResult.rows[0]?.avg_model_forecasted ?? 0,
        avg_pagasa_forecasted: pagasaModelAvgResult.rows[0]?.avg_pagasa_forecasted ?? 0,
        danger_count,
        fastest_increasing_station: fastestStation.station_name,
        fastest_increasing_trend: Math.round(Number(fastestStation.trend) * 10) / 10
      };
    }

    // Synoptics table formatting
    const colorMap: { [key: string]: string } = {
      'Caution': '#FFD700',
      'Extreme Caution': '#FFA500',
      'Danger': '#FF4500',
      'Extreme Danger': '#8B0000'
    };

    const sortOrder: { [key: string]: number } = {
      'Caution': 1,
      'Extreme Caution': 2,
      'Danger': 3,
      'Extreme Danger': 4
    };

    const synoptic = synopticResult.rows
      .map(row => ({
        name: row.name,
        value: row.value ? Number(row.value) : 0,
        color: colorMap[row.name] || '#999999'
      }))
      .sort((a, b) => (sortOrder[a.name] || 999) - (sortOrder[b.name] || 999));

    res.json({ summary, synoptic });

  } catch (err) {
    console.error(err);
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
    const dateCondition = getDateRangeCondition(date as string, range as string);

    const result = await pool.query(`
      SELECT
        EXTRACT(DAY FROM date)::integer AS day,
        ${roundNumeric('AVG("1day_abs_error")', 0, 2)} AS t_plus_one,
        ${roundNumeric('AVG("2day_abs_error")', 0, 2)} AS t_plus_two
      FROM model_heat_index
      WHERE ${dateCondition}
      GROUP BY EXTRACT(DAY FROM date)
      ORDER BY day
    `);

    const formatted = result.rows.map(row => ({
      day: row.day,
      t_plus_one: row.t_plus_one ? Number(row.t_plus_one) : 0,
      t_plus_two: row.t_plus_two ? Number(row.t_plus_two) : 0
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load forecast error data" });
  }
});

/**
 * Synoptics Table Route
 */
router.get("/stations-table", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    const dateCondition = date
      ? 'h.date = $1'
      : `h.date = (
          SELECT MAX(date)
          FROM heat_index hi
          WHERE hi.station = h.station
        )`;

    const result = await pool.query(
      `SELECT
        c.level AS name,
        COUNT(DISTINCT h.station) AS value
      FROM heat_index h
      JOIN classification c
        ON h.actual >= c.min_temp AND h.actual < CAST(c.max_temp AS NUMERIC) + 1
      WHERE ${dateCondition}
      GROUP BY c.level`,
      date ? [date] : []
    );

    const colorMap: { [key: string]: string } = {
      'Caution': '#FFD700',
      'Extreme Caution': '#FFA500',
      'Danger': '#FF4500',
      'Extreme Danger': '#8B0000'
    };

    const sortOrder: { [key: string]: number } = {
      'Caution': 1,
      'Extreme Caution': 2,
      'Danger': 3,
      'Extreme Danger': 4
    };

    const formatted = result.rows
      .map(row => ({
        name: row.name,
        value: row.value ? Number(row.value) : 0,
        color: colorMap[row.name] || '#999999'
      }))
      .sort((a, b) => (sortOrder[a.name] || 999) - (sortOrder[b.name] || 999));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load synoptics table" });
  }
});

export default router;
