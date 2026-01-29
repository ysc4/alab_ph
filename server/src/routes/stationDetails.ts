import { Router } from 'express';
import { getDB } from '../db';
import { getDateRangeCondition, roundNumeric } from '../utils/queryHelpers';

const router = Router();

router.get('/station/:stationId/summary', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const pool = getDB();

    // Fetch all static station data in parallel
    const [stationResult, rankResult, trendResult, forecastResult, metricsResult, absErrorResult] = await Promise.all([
      // Station info
      pool.query(
        `SELECT 
          s.id,
          s.station AS name,
          s.latitude AS lat,
          s.longitude AS lng,
          ROUND(hi.actual::numeric, 1) AS current_temp,
          hi.date,
          COALESCE(c.level, 'N/A') AS risk_level,
          ROUND(hi.trend::numeric, 1) AS trend
        FROM stations s
        LEFT JOIN heat_index hi
          ON s.id = hi.station
          ${date ? 'AND hi.date = $2' : ''}
        LEFT JOIN classification c
          ON hi.actual >= c.min_temp AND hi.actual < CAST(c.max_temp AS NUMERIC) + 1
        WHERE s.id = $1
        ORDER BY hi.date DESC
        LIMIT 1`,
        date ? [stationId, date] : [stationId]
      ),
      // Rank data
      pool.query(
        `SELECT hi.actual, hi.station
        FROM heat_index hi
        WHERE hi.date = ${date ? '$1' : '(SELECT MAX(date) FROM heat_index)'}
        ORDER BY hi.actual DESC`,
        date ? [date] : []
      ),
      // Temperature history for trend calculation
      pool.query(
        `SELECT actual AS temp
        FROM heat_index
        WHERE station = $1
        ${date ? 'AND date <= $2' : ''}
        ORDER BY date DESC
        LIMIT 2`,
        date ? [stationId, date] : [stationId]
      ),
      // Forecasts
      pool.query(
        `SELECT
          date,
          ROUND(tomorrow::numeric, 1) AS tomorrow,
          ROUND(day_after_tomorrow::numeric, 1) AS day_after_tomorrow
        FROM model_heat_index
        WHERE station = $1
        ${date ? 'AND date = $2' : ''}
        ORDER BY date DESC
        LIMIT 1`,
        date ? [stationId, date] : [stationId]
      ),
      // Model metrics
      pool.query(
        `SELECT 
          ROUND(COALESCE(rmse_1day, 0)::numeric, 1) as rmse_1day,
          ROUND(COALESCE(mae_1day, 0)::numeric, 1) as mae_1day,
          ROUND(COALESCE(rsquared_1day, 0)::numeric, 1) as rsquared_1day,
          ROUND(COALESCE(rmse_2day, 0)::numeric, 1) as rmse_2day,
          ROUND(COALESCE(mae_2day, 0)::numeric, 1) as mae_2day,
          ROUND(COALESCE(rsquared_2day, 0)::numeric, 1) as rsquared_2day
        FROM model_metrics
        WHERE station = $1`,
        [stationId]
      ),
      // Absolute errors from model_heat_index
      pool.query(
        `SELECT
          ROUND(COALESCE("1day_abs_error", 0)::numeric, 1) as "1day_abs_error",
          ROUND(COALESCE("2day_abs_error", 0)::numeric, 1) as "2day_abs_error"
        FROM model_heat_index
        WHERE station = $1
        ${date ? 'AND date = $2' : ''}
        ORDER BY date DESC
        LIMIT 1`,
        date ? [stationId, date] : [stationId]
      )
    ]);

    if (stationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const station = stationResult.rows[0];

    // Compute rank
    let rankData: { rank: number | null, totalStations: number | null } = { rank: null, totalStations: null };
    if (rankResult.rows.length > 0) {
      const stationRankIndex = rankResult.rows.findIndex(row => Number(row.station) === Number(stationId));
      rankData = {
        rank: stationRankIndex >= 0 ? stationRankIndex + 1 : null,
        totalStations: rankResult.rows.length
      };
    }

    // Compute temp change
    const temps = trendResult.rows.map(r => Number(r.temp));
    const tempChange = temps.length > 1 ? Number((temps[0] - temps[1]).toFixed(1)) : 0;

    // Process forecasts
    const forecast = forecastResult.rows[0] || {};
    // Use the selected date or current date as the base, not the forecast.date
    const baseDate = date ? new Date(date as string) : new Date();
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(baseDate);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const forecasts = [
      {
        label: 'Tomorrow',
        date: tomorrow.toISOString().split('T')[0],
        temp: forecast.tomorrow ?? null,
      },
      {
        label: 'Day After Tomorrow',
        date: dayAfterTomorrow.toISOString().split('T')[0],
        temp: forecast.day_after_tomorrow ?? null,
      },
    ];

    // Process metrics
    const metrics = metricsResult.rows[0] || {
      rmse_1day: 0,
      mae_1day: 0,
      rsquared_1day: 0,
      rmse_2day: 0,
      mae_2day: 0,
      rsquared_2day: 0,
    };
    const absErrors = absErrorResult.rows[0] || {
      "1day_abs_error": 0,
      "2day_abs_error": 0,
    };

    res.json({
      station: {
        id: station.id,
        name: station.name,
        lat: Number(station.lat),
        lng: Number(station.lng),
      },
      currentData: {
        observedTemp: Number(station.current_temp),
        tempChange,
        riskLevel: station.risk_level || 'N/A',
        date: station.date,
        rank: rankData.rank,
        totalStations: rankData.totalStations,
      },
      forecasts,
      metrics: {
        rmse_1day: metrics.rmse_1day,
        mae_1day: metrics.mae_1day,
        rsquared_1day: metrics.rsquared_1day,
        rmse_2day: metrics.rmse_2day,
        mae_2day: metrics.mae_2day,
        rsquared_2day: metrics.rsquared_2day,
        absError1Day: absErrors['1day_abs_error'],
        absError2Day: absErrors['2day_abs_error'],
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch station summary' });
  }
});

// Station trend data (KEEP - has range toggle)
router.get('/station/:stationId/trend', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date, range } = req.query;
    const pool = getDB();

    let dateCondition = '';
    
    if (date) {
      if (range === 'Week' || range === 'Month') {
        dateCondition = `AND ${getDateRangeCondition(date as string, range as string)}`;
      } else {
        dateCondition = `AND date <= '${date}'`;
      }
    }

    // Only apply LIMIT when no range is specified
    const limitClause = (range === 'Week' || range === 'Month') ? '' : 'LIMIT 31';
    
    const trendQuery = `
      SELECT
        TO_CHAR(date, 'YYYY-MM-DD') as date,
        ${roundNumeric('actual')} AS temp,
        ${roundNumeric('pagasa_forecasted')} AS pagasa_forecasted,
        ${roundNumeric('model_forecasted')} AS model_forecasted
      FROM heat_index
      WHERE station = $1
      ${dateCondition}
      ORDER BY date DESC
      ${limitClause}
    `;

    const trendResult = await pool.query(trendQuery, [stationId]);

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


// Station-specific forecast error trend (KEEP - has range toggle)
router.get('/station/:stationId/forecast-error', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { range, date } = req.query;
    const pool = getDB();
    const isMonth = range === 'Month';

    const dateCondition = getDateRangeCondition(date as string, range as string);

    const result = await pool.query(
      `SELECT
        EXTRACT(DAY FROM date)::integer AS day,
        COALESCE("one_day_abs_error", 0) AS t_plus_one,
        COALESCE("two_day_abs_error", 0) AS t_plus_two
      FROM model_heat_index
      WHERE station = $1 AND ${dateCondition}
      ORDER BY date ASC`,
      [stationId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch forecast error data' });
  }
});

export default router;
