import { Router } from "express";
import { getDB } from "../db";
import { getISOWeekRange } from "../utils/dateFormatter";

const router = Router();

/**
 * ============================
 * SUMMARY CARDS
 * ============================
 */
router.get("/summary", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    const dateFilter = date ? `AND date = '${date}'` : '';

    const result = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (station)
          station,
          actual,
          COALESCE(trend, 0) as trend
        FROM heat_index
        WHERE 1=1 ${dateFilter}
        ORDER BY station, date DESC
      ),
      stats AS (
        SELECT
          MAX(actual) AS max,
          MIN(actual) AS min,
          ROUND(AVG(actual), 2) AS avg,
          COUNT(*) FILTER (WHERE actual >= 41) AS danger_count
        FROM latest
      ),
      max_station_info AS (
        SELECT s.station
        FROM latest l
        JOIN stations s ON s.id = l.station
        WHERE l.actual = (SELECT MAX(actual) FROM latest)
        LIMIT 1
      ),
      min_station_info AS (
        SELECT s.station
        FROM latest l
        JOIN stations s ON s.id = l.station
        WHERE l.actual = (SELECT MIN(actual) FROM latest)
        LIMIT 1
      ),
      fastest_info AS (
        SELECT 
          s.station,
          l.trend::numeric as trend
        FROM latest l
        JOIN stations s ON s.id = l.station
        ORDER BY l.trend DESC NULLS LAST
        LIMIT 1
      )
      SELECT
        stats.max,
        max_station_info.station AS max_station,
        stats.min,
        min_station_info.station AS min_station,
        stats.avg,
        stats.danger_count,
        fastest_info.station AS fastest_increasing_station,
        ROUND(fastest_info.trend, 1) AS fastest_increasing_trend
      FROM stats, max_station_info, min_station_info, fastest_info;
    `);

    console.log('Summary result:', JSON.stringify(result.rows[0], null, 2));
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

router.get("/stations", async (_req, res) => {
  try {
    const pool = getDB();

    const result = await pool.query(`
      SELECT DISTINCT ON (h.station)
        s.station,
        h.actual,
        h.model_forecasted,
        h.pagasa_forecasted,
        h.trend,
        h.date
      FROM heat_index h
      JOIN stations s ON s.id = h.station
      ORDER BY h.station, h.date DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load station table" });
  }
});

router.get("/synoptic-bar", async (req, res) => {
  try {
    const pool = getDB();
    const { range } = req.query;

    const interval =
      range === "month" ? "30 days" : "7 days";

    const result = await pool.query(
      `
      SELECT
        c.level AS name,
        COUNT(DISTINCT h.station) AS value
      FROM heat_index h
      JOIN classification c ON c.id = h.risk_level
      WHERE h.date >= CURRENT_DATE - INTERVAL '${interval}'
        AND h.date = (
          SELECT MAX(date)
          FROM heat_index hi
          WHERE hi.station = h.station
        )
      GROUP BY c.level
      ORDER BY value DESC;
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load synoptic bar data" });
  }
});

router.get("/forecast-error", async (req, res) => {
  try {
    const pool = getDB();
    const { range, date } = req.query;
    const isMonth = range === "Month";

    let dateCondition;
    if (date) {
      const selectedDate = new Date(date as string);
      
      if (isMonth) {
        // Show entire month of the selected date
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        dateCondition = `date >= '${startOfMonth.toISOString().split('T')[0]}' AND date <= '${endOfMonth.toISOString().split('T')[0]}'`;
      } else {
        // Use ISO week calculation
        const { startDate, endDate } = getISOWeekRange(date as string);
        dateCondition = `date >= '${startDate}' AND date <= '${endDate}'`;
      }
    } else {
      // Default: use current date and go back
      const days = isMonth ? 31 : 7;
      dateCondition = `date >= CURRENT_DATE - INTERVAL '${days} days'`;
    }

    const result = await pool.query(`
      SELECT
        EXTRACT(DAY FROM date)::integer AS day,
        ROUND(AVG(COALESCE("1day_abs_error", 0))::numeric, 2) AS t_plus_one,
        ROUND(AVG(COALESCE("2day_abs_error", 0))::numeric, 2) AS t_plus_two
      FROM model_metrics
      WHERE ${dateCondition}
      GROUP BY DATE(date)
      ORDER BY DATE(date);
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load forecast error data" });
  }
});

/**
 * ============================
 * NATIONWIDE HEAT INDEX TREND
 * ============================
 */
router.get("/nationwide-trend", async (req, res) => {
  try {
    const pool = getDB();
    const { range, date } = req.query;
    const isMonth = range === "Month";

    let dateCondition;
    if (date) {
      const selectedDate = new Date(date as string);
      
      if (isMonth) {
        // Show entire month of the selected date
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        dateCondition = `date >= '${startOfMonth.toISOString().split('T')[0]}' AND date <= '${endOfMonth.toISOString().split('T')[0]}'`;
      } else {
        // Use ISO week calculation
        const { startDate, endDate } = getISOWeekRange(date as string);
        dateCondition = `date >= '${startDate}' AND date <= '${endDate}'`;
      }
    } else {
      // Default: use current date and go back
      const days = isMonth ? 31 : 7;
      dateCondition = `date >= CURRENT_DATE - INTERVAL '${days} days'`;
    }

    const result = await pool.query(`
      SELECT
        TO_CHAR(date, 'DD') AS day,
        ROUND(AVG(actual), 2) AS observed
      FROM heat_index
      WHERE ${dateCondition}
      GROUP BY DATE(date)
      ORDER BY DATE(date);
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load nationwide trend" });
  }
});

/**
 * ============================
 * STATIONS TABLE WITH RISK LEVEL
 * ============================
 */
router.get("/stations-table", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    let query;
    if (date) {
      // When date is specified, only show stations with data for that date
      query = `
        SELECT
          s.station AS name,
          h.actual AS heat_index,
          c.level AS risk_level,
          CASE
            WHEN h.trend > 0 THEN CONCAT('+', ROUND(h.trend, 1), '°C')
            WHEN h.trend < 0 THEN CONCAT(ROUND(h.trend, 1), '°C')
            ELSE NULL
          END AS trend
        FROM heat_index h
        JOIN stations s ON s.id = h.station
        JOIN classification c ON c.id = h.risk_level
        WHERE h.date = '${date}'
        ORDER BY s.id;
      `;
    } else {
      // When no date, get latest data for each station
      query = `
        SELECT DISTINCT ON (h.station)
          s.station AS name,
          h.actual AS heat_index,
          c.level AS risk_level,
          CASE
            WHEN h.trend > 0 THEN CONCAT('+', ROUND(h.trend, 1), '°C')
            WHEN h.trend < 0 THEN CONCAT(ROUND(h.trend, 1), '°C')
            ELSE NULL
          END AS trend
        FROM heat_index h
        JOIN stations s ON s.id = h.station
        JOIN classification c ON c.id = h.risk_level
        ORDER BY h.station, h.date DESC;
      `;
    }

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stations table" });
  }
});

/**
 * ============================
 * SYNOPTIC CLASSIFICATION WITH COLORS
 * ============================
 */
router.get("/synoptic-classification", async (req, res) => {
  try {
    const pool = getDB();
    const { date } = req.query;

    const dateCondition = date 
      ? `h.date = '${date}'`
      : `h.date = (
          SELECT MAX(date)
          FROM heat_index hi
          WHERE hi.station = h.station
        )`;

    const result = await pool.query(`
      SELECT
        c.level AS name,
        COUNT(DISTINCT h.station) AS value
      FROM heat_index h
      JOIN classification c ON c.id = h.risk_level
      WHERE ${dateCondition}
      GROUP BY c.level
      ORDER BY 
        CASE c.level
          WHEN 'Caution' THEN 1
          WHEN 'Extreme Caution' THEN 2
          WHEN 'Danger' THEN 3
          WHEN 'Extreme Danger' THEN 4
        END;
    `);

    const colorMap: { [key: string]: string } = {
      'Caution': '#FFD700',
      'Extreme Caution': '#FFA500',
      'Danger': '#FF4500',
      'Extreme Danger': '#8B0000'
    };

    const data = result.rows.map(row => ({
      ...row,
      value: parseInt(row.value),
      color: colorMap[row.name] || '#999999'
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load synoptic classification" });
  }
});

export default router;
