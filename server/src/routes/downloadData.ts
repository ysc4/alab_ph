
import { Router } from "express";
import { getDB } from "../db";

const router = Router();

router.get("/stations-full-data", async (req, res) => {
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: "Date query parameter is required." });

  try {
    const pool = getDB();

    const query = `
        SELECT 
            s.station AS name,
            COALESCE(mhi.tomorrow, 0) AS t_plus_one,
            COALESCE(mhi.day_after_tomorrow, 0) AS t_plus_two,
            COALESCE(mm.rmse, 0) AS rmse,
            COALESCE(mm.mae, 0) AS mae,
            COALESCE(mm.rsquared, 0) AS rsquared
        FROM stations s
        LEFT JOIN model_heat_index mhi
            ON mhi.station = s.id AND mhi.date = $1
        LEFT JOIN model_metrics mm
            ON mm.station = s.id
        ORDER BY s.station ASC;
        `;


    const { rows } = await pool.query(query, [date]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching stations full data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
