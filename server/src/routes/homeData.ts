import { Router } from "express";
import { getDB } from "../db";
import { roundNumeric } from "../utils/queryHelpers";

const router = Router();

router.get("/home-summary", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    // Prepare date condition
    const dateCondition = date
      ? 'h.date = $1'
      : `h.date = (
          SELECT MAX(date)
          FROM heat_index hi
          WHERE hi.station = h.station
        )`;

    // Fetch summary, averages, and classification counts
    const [
      summaryResult,
      avgResult,
      synopticResult
    ] = await Promise.all([
      // Summary per station
      pool.query(
        `SELECT DISTINCT ON (mh.station)
          mh.station,
          s.station AS station_name,
          ${roundNumeric('mh.tomorrow', 0)} AS forecasted,
          ${roundNumeric('h.trend', 0)} AS trend,
          ${roundNumeric('h.model_forecasted', 0)} AS model_forecasted,
          ${roundNumeric('h.pagasa_forecasted', 0)} AS pagasa_forecasted
        FROM model_heat_index mh
        JOIN stations s ON s.id = mh.station
        LEFT JOIN heat_index h ON h.station = mh.station AND h.date = mh.date
        ${date ? 'WHERE mh.date = $1' : ''}
        ORDER BY mh.station, mh.date DESC`,
        date ? [date] : []
      ),

      // Luzonwide averages
      pool.query(
        `SELECT
          ROUND(AVG(h.model_forecasted)::numeric, 2) AS avg_model_forecasted,
          ROUND(AVG(h.pagasa_forecasted)::numeric, 2) AS avg_pagasa_forecasted
        FROM heat_index h
        WHERE ${dateCondition}`,
        date ? [date] : []
      ),

      // Synoptic classification counts
      pool.query(
        `SELECT
          c.level AS name,
          COUNT(DISTINCT h.station) AS value
        FROM heat_index h
        JOIN classification c ON h.actual >= c.min_temp AND h.actual < CAST(c.max_temp AS NUMERIC) + 1
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
      avg_pagasa_forecasted: 0,
    };

    if (stations.length > 0) {
      const forecasts = stations.map(s => Number(s.forecasted)).filter(v => !isNaN(v));
      const max = forecasts.length ? Math.max(...forecasts) : 0;
      const min = forecasts.length ? Math.min(...forecasts) : 0;
      const avg = forecasts.length
        ? Math.round((forecasts.reduce((a, b) => a + b, 0) / forecasts.length) * 100) / 100
        : 0;

      const danger_count = stations.filter(s => Number(s.forecasted) >= 41).length;
      const maxStation = stations.find(s => Number(s.forecasted) === max);
      const minStation = stations.find(s => Number(s.forecasted) === min);
      const fastestStation = stations.length
        ? stations.reduce((prev, current) => Number(current.trend) > Number(prev.trend) ? current : prev)
        : null;

      const avg_model_forecasted = avgResult.rows[0]?.avg_model_forecasted ?? 0;
      const avg_pagasa_forecasted = avgResult.rows[0]?.avg_pagasa_forecasted ?? 0;

      summary = {
        max,
        max_station: maxStation?.station_name || '',
        min,
        min_station: minStation?.station_name || '',
        avg,
        avg_model_forecasted,
        avg_pagasa_forecasted,
        danger_count,
        fastest_increasing_station: fastestStation?.station_name || '',
        fastest_increasing_trend: fastestStation ? Math.round(Number(fastestStation.trend) * 10) / 10 : 0
      };
    }

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
        value: parseInt(row.value),
        color: colorMap[row.name] || '#999999'
      }))
      .sort((a, b) => (sortOrder[a.name] || 999) - (sortOrder[b.name] || 999));

    res.json({
      summary,
      synoptic
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load home summary" });
  }
});

export default router;
