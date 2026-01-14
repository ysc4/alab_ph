import { Router } from 'express';
import { getDB } from '../db';
import { getISOWeekRange } from '../utils/dateFormatter';

const router = Router();

// Station info and current data
router.get('/station/:stationId/info', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const pool = getDB();

    const stationQuery = `
      SELECT 
        s.id,
        s.station AS name,
        s.latitude AS lat,
        s.longitude AS lng,
        hi.actual AS current_temp,
        hi.date,
        COALESCE(c.level, 'N/A') AS risk_level,
        hi.trend
      FROM stations s
      LEFT JOIN heat_index hi
        ON s.id = hi.station
        ${date ? `AND hi.date = '${date}'` : ''}
      LEFT JOIN classification c
        ON hi.risk_level = c.id AND hi.id IS NOT NULL
      WHERE s.id = ${stationId}
      ORDER BY hi.date DESC
      LIMIT 1
    `;

    const stationResult = await pool.query(stationQuery);

    if (stationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const station = stationResult.rows[0];

    // Calculate Rank
    let rankData = { rank: null, totalStations: null };
    if (date || station.date) {
      const rankDate = date || station.date;
      const rankQuery = `
        SELECT 
          RANK() OVER (ORDER BY hi.actual DESC) as rank,
          COUNT(*) OVER () as total_stations
        FROM heat_index hi
        WHERE hi.date = '${rankDate}'
        AND hi.station = ${stationId}
      `;
      
      const rankResult = await pool.query(rankQuery);
      if (rankResult.rows.length > 0) {
        rankData = {
          rank: rankResult.rows[0].rank,
          totalStations: rankResult.rows[0].total_stations
        };
      }
    }

    // Calculate temp change
    const trendQuery = `
      SELECT actual AS temp
      FROM heat_index
      WHERE station = ${stationId}
      ${date ? `AND date <= '${date}'` : ''}
      ORDER BY date DESC
      LIMIT 2
    `;

    const trendResult = await pool.query(trendQuery);
    const temps = trendResult.rows.map(r => Number(r.temp));
    const tempChange = temps.length > 1 ? (temps[0] - temps[1]).toFixed(2) : '0';

    res.json({
      station: {
        id: station.id,
        name: station.name,
        lat: Number(station.lat),
        lng: Number(station.lng),
      },
      currentData: {
        observedTemp: Number(station.current_temp),
        tempChange: Number(tempChange),
        riskLevel: station.risk_level || 'N/A',
        date: station.date,
        rank: rankData.rank,
        totalStations: rankData.totalStations,
      },
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch station info' });
  }
});

// Station forecasts
router.get('/station/:stationId/forecasts', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const pool = getDB();

    const forecastQuery = `
      SELECT
        date,
        tomorrow,
        day_after_tomorrow
      FROM model_heat_index
      WHERE station = ${stationId}
      ${date ? `AND date = '${date}'` : ''}
      ORDER BY date DESC
      LIMIT 1
    `;

    const forecastResult = await pool.query(forecastQuery);
    const forecast = forecastResult.rows[0] || {};

    res.json([
      {
        label: 'Tomorrow',
        date: forecast.date,
        temp: forecast.tomorrow ?? null,
      },
      {
        label: 'Day After Tomorrow',
        date: forecast.date,
        temp: forecast.day_after_tomorrow ?? null,
      },
    ]);

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch forecasts' });
  }
});

// Station trend data
router.get('/station/:stationId/trend', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date, range } = req.query;
    const pool = getDB();

    let dateCondition = '';
    
    if (date) {
      if (range === 'Week') {
        // Get ISO week range using shared logic
        const { startDate, endDate } = getISOWeekRange(date as string);
        dateCondition = `AND date >= '${startDate}' AND date <= '${endDate}'`;
      } else if (range === 'Month') {
        // Get entire month for the selected date
        const selectedDate = new Date(date as string);
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        
        dateCondition = `AND date >= '${startOfMonth.toISOString().split('T')[0]}' AND date <= '${endOfMonth.toISOString().split('T')[0]}'`;
      } else {
        // Default behavior: show up to 31 days before and including selected date
        dateCondition = `AND date <= '${date}'`;
      }
    }

    const trendQuery = `
      SELECT
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        actual AS temp,
        pagasa_forecasted,
        model_forecasted
      FROM heat_index
      WHERE station = ${stationId}
      ${dateCondition}
      ORDER BY date DESC
      LIMIT 31
    `;

    const trendResult = await pool.query(trendQuery);

    const result = trendResult.rows
      .map(row => ({
        date: row.date,
        temp: row.temp ? Number(row.temp) : null,
        pagasa_forecasted: row.pagasa_forecasted ? Number(row.pagasa_forecasted) : null,
        model_forecasted: row.model_forecasted ? Number(row.model_forecasted) : null,
      }))
      .reverse();

    res.json(result);

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// Station model metrics
router.get('/station/:stationId/metrics', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const pool = getDB();

    const metricsQuery = `
      SELECT 
        COALESCE(mm.rmse, 0) as rmse, 
        COALESCE(mm.mae, 0) as mae, 
        COALESCE(mm.rsquared, 0) as rsquared, 
        COALESCE(mhi."1day_abs_error", 0) as "1day_abs_error", 
        COALESCE(mhi."2day_abs_error", 0) as "2day_abs_error"
      FROM model_heat_index mhi
      LEFT JOIN model_metrics mm ON mm.station = mhi.station
      WHERE mhi.station = ${stationId}
      ${date ? `AND mhi.date = '${date}'` : ''}
      ORDER BY mhi.date DESC
      LIMIT 1
    `;

    const metricsResult = await pool.query(metricsQuery);
    const metrics = metricsResult.rows[0] || {
      rmse: 0,
      mae: 0,
      rsquared: 0,
      "1day_abs_error": 0,
      "2day_abs_error": 0,
    };

    res.json({
      rmse: metrics.rmse,
      mae: metrics.mae,
      rsquared: metrics.rsquared,
      absError1Day: metrics['1day_abs_error'],
      absError2Day: metrics['2day_abs_error'],
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch model metrics' });
  }
});

// Station-specific forecast error trend
router.get('/station/:stationId/forecast-error', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { range, date } = req.query;
    const pool = getDB();
    const isMonth = range === 'Month';

    let dateCondition;
    if (date) {
      const selectedDate = new Date(date as string);
      
      if (isMonth) {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        dateCondition = `date >= '${startOfMonth.toISOString().split('T')[0]}' AND date <= '${endOfMonth.toISOString().split('T')[0]}'`;
      } else {
        // Get ISO week range using shared logic
        const { startDate, endDate } = getISOWeekRange(date as string);
        dateCondition = `date >= '${startDate}' AND date <= '${endDate}'`;
      }
    } else {
      const days = isMonth ? 31 : 7;
      dateCondition = `date >= CURRENT_DATE - INTERVAL '${days} days'`;
    }

    const result = await pool.query(`
      SELECT
        EXTRACT(DAY FROM date)::integer AS day,
        COALESCE("1day_abs_error", 0) AS t_plus_one,
        COALESCE("2day_abs_error", 0) AS t_plus_two
      FROM model_heat_index
      WHERE station = ${stationId} AND ${dateCondition}
      ORDER BY date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch forecast error data' });
  }
});

router.get("/station/:stationId/potential-effects", async (req, res) => {
  const { stationId } = req.params;
  const { date } = req.query;

  try {
    const pool = getDB();
    const query = `
      SELECT
        c.name AS risk_level,
        pe.health_risk,
        pe.daily_activities,
        pe.infrastructure_stress,
        pe.environmental_stress
      FROM heat_index hi
      JOIN classifications c
        ON hi.risk_level = c.id
      JOIN potential_effects pe
        ON pe.risk_level = c.id
      WHERE hi.station = $1
        AND hi.date = $2
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [stationId, date]);

    if (rows.length === 0) {
      return res.json(null);
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Potential effects error:", error);
    res.status(500).json({ error: "Failed to fetch potential effects" });
  }
});

router.get("/station/:stationId/recommended-interventions", async (req, res) => {
  const { stationId } = req.params;
  const { date } = req.query;

  try {
    const pool = getDB();
    const query = `
      SELECT
        c.name AS risk_level,
        ri.public_health,
        ri.act_management,
        ri.resource_readiness,
        ri.comm_management
      FROM heat_index hi
      JOIN classifications c
        ON hi.risk_level = c.id
      JOIN recommended_interventions ri
        ON ri.risk_level = c.id
      WHERE hi.station = $1
        AND hi.date = $2
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [stationId, date]);

    if (rows.length === 0) {
      return res.json(null);
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Recommended interventions error:", error);
    res.status(500).json({ error: "Failed to fetch recommended interventions" });
  }
});




export default router;
