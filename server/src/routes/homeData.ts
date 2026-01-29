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
    const { date, range } = req.query;

    const dateCondition = date
      ? "h.date = $1"
      : `h.date = (
          SELECT MAX(date)
          FROM heat_index hi
          WHERE hi.station = h.station
        )`;

    const [summaryResult, synopticResult, trendResult] =
      await Promise.all([
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
          ${date ? "WHERE mh.date = $1" : ""}
          ORDER BY mh.station, mh.date DESC
        `,
          date ? [date] : []
        ),

        pool.query(
          `
          SELECT
            c.level AS name,
            COUNT(DISTINCT mh.station) AS value
          FROM model_heat_index mh
          JOIN stations s ON s.id = mh.station
          JOIN classification c
            ON mh.tomorrow >= c.min_temp
           AND mh.tomorrow < CAST(c.max_temp AS NUMERIC) + 1
          WHERE ${date ? "mh.date = $1" : "mh.date = (SELECT MAX(date) FROM model_heat_index mhi WHERE mhi.station = mh.station)"}
          GROUP BY c.level
        `,
          date ? [date] : []
        ),

        // Trend query: daily average for the full month of the selected date, always include the selected date
        (async () => {
          if (!date) return pool.query('SELECT date, 0 as avg_model_forecasted, 0 as avg_pagasa_forecasted, 0 as observed WHERE false');
          const d = new Date(date as string);
          const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
          let trendRows = (await pool.query(
            `SELECT date, ROUND(AVG(model_forecasted)::numeric, 2) AS avg_model_forecasted, ROUND(AVG(pagasa_forecasted)::numeric, 2) AS avg_pagasa_forecasted, ROUND(AVG(actual)::numeric, 2) AS observed
              FROM heat_index
              WHERE date >= $1 AND date <= $2
              GROUP BY date
              ORDER BY date`,
            [startOfMonth, endOfMonth]
          )).rows;
          // Ensure selected date is present if any station has data for it
          const selectedStr = d.toISOString().slice(0, 10);
          if (!trendRows.some(row => row.date === selectedStr)) {
            // Try to compute the average for the selected date only
            const singleDay = (await pool.query(
              `SELECT date, ROUND(AVG(model_forecasted)::numeric, 2) AS avg_model_forecasted, ROUND(AVG(pagasa_forecasted)::numeric, 2) AS avg_pagasa_forecasted, ROUND(AVG(actual)::numeric, 2) AS observed
                FROM heat_index
                WHERE date = $1
                GROUP BY date`,
              [selectedStr]
            )).rows;
            if (singleDay.length > 0) {
              trendRows.push(singleDay[0]);
            } else {
              trendRows.push({
                date: selectedStr,
                avg_model_forecasted: 0,
                avg_pagasa_forecasted: 0,
                observed: 0
              });
            }
            // Sort again using date-based comparison for robustness
            trendRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          }
          return { rows: trendRows };
        })()
      ]);

    const stations = summaryResult.rows;

    let summary = {
      max: 0,
      max_station: "",
      min: 0,
      min_station: "",
      avg: 0,
      danger_count: 0,
      fastest_increasing_station: "",
      fastest_increasing_trend: 0,
    };

    if (stations.length > 0) {
      const forecasts = stations.map(s => Number(s.forecasted));
      const max = forecasts.length > 0 ? Number(Math.max(...forecasts).toFixed(2)) : 0;
      const min = forecasts.length > 0 ? Number(Math.min(...forecasts).toFixed(2)) : 0;
      const avg = forecasts.length > 0 ? Number((forecasts.reduce((a, b) => a + b, 0) / forecasts.length).toFixed(2)) : 0;
      const danger_count = stations.filter(s => Number(s.forecasted) >= 41).length;
      const maxStation = stations.reduce((prev, curr) => Number(curr.forecasted) > Number(prev.forecasted) ? curr : prev);
      const minStation = stations.reduce((prev, curr) => Number(curr.forecasted) < Number(prev.forecasted) ? curr : prev);
      const fastestStation = stations.reduce((prev, current) => Number(current.trend) > Number(prev.trend) ? current : prev);
      summary = {
        max,
        max_station: maxStation?.station_name || "",
        min,
        min_station: minStation?.station_name || "",
        avg,
        danger_count,
        fastest_increasing_station: fastestStation.station_name,
        fastest_increasing_trend: Number(Number(fastestStation.trend).toFixed(2)),
      };
    }

    const colorMap: Record<string, string> = {
      Caution: "#FFD700",
      "Extreme Caution": "#FFA500",
      Danger: "#FF4500",
      "Extreme Danger": "#8B0000"
    };

    const sortOrder: Record<string, number> = {
      Caution: 1,
      "Extreme Caution": 2,
      Danger: 3,
      "Extreme Danger": 4
    };

    const synoptic = synopticResult.rows
      .map(row => ({
        name: row.name,
        value: Number(row.value),
        color: colorMap[row.name] || "#999999"
      }))
      .sort(
        (a, b) =>
          (sortOrder[a.name] || 999) - (sortOrder[b.name] || 999)
      );

    const trend = trendResult.rows;
    res.json({ summary, synoptic, trend });
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
        ${roundNumeric('AVG("one_day_abs_error")', 0, 2)} AS t_plus_one,
        ${roundNumeric('AVG("two_day_abs_error")', 0, 2)} AS t_plus_two
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
    const { date, limit = "100", offset = "0" } = req.query;

    const query = `
      SELECT
        s.station AS name,
        ROUND(mh.tomorrow::numeric, 1) AS heat_index,
        COALESCE(c.level, 'N/A') AS risk_level,
        ROUND(ht.trend::numeric, 1) AS trend
      FROM model_heat_index mh
      JOIN stations s
        ON s.id = mh.station
      LEFT JOIN heat_index ht
        ON ht.station = mh.station
      AND ht.date = mh.date + INTERVAL '1 day'
      LEFT JOIN classification c
        ON mh.tomorrow < c.max_temp AND (c.min_temp IS NULL OR mh.tomorrow >= c.min_temp)
      WHERE mh.date = $1
      ORDER BY s.station
    `;

    const result = await pool.query(
      query,
      date ? [date] : [new Date().toISOString().split("T")[0]]
    );

    const formatted = result.rows.map(row => ({
      name: row.name,
      heat_index: row.heat_index !== null ? Number(row.heat_index) : null,
      risk_level: row.risk_level,
      trend:
        row.trend !== null
          ? row.trend > 0
            ? `+${Number(row.trend).toFixed(1)}°C`
            : `${Number(row.trend).toFixed(1)}°C`
          : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stations table" });
  }
});



export default router;
