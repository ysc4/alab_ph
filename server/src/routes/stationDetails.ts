import { Router } from 'express';
import { getDB } from '../db';

const router = Router();

router.get('/station/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { date } = req.query;
    const pool = getDB();

    console.log('🔍 Station Details Route Called');
    console.log('  Station ID:', stationId);
    console.log('  Date:', date);

    const dateFilter = date ? `AND hi.date = '${date}'` : '';
    console.log('  Query Params:', [stationId, stationId]);
    console.log('  Date Filter:', dateFilter || 'No date filter');

    /* ===============================
       1. Station + Latest Observation
    ================================ */
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

    console.log('  📍 Station Query Result:', stationResult.rows.length, 'rows');
    if (stationResult.rows.length > 0) {
      console.log('    Station Data:', stationResult.rows[0]);
    }

    if (stationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const station = stationResult.rows[0];

    /* ===============================
       1b. Calculate Rank (Heat Index Ranking for that day)
    ================================ */
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
        console.log('  🏆 Rank Data:', rankData);
      }
    }

    /* ===============================
       2. Model Forecast (Tomorrow + Day After)
    ================================ */
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

    console.log('  📅 Forecast Query Result:', forecastResult.rows.length, 'rows');
    console.log('    Forecast Data:', forecast);

    /* ===============================
       3. Trend Data (Last 31 Days)
    ================================ */
    const trendQuery = `
      SELECT
        date,
        actual AS temp
      FROM heat_index
      WHERE station = ${stationId}
      ${date ? `AND date = '${date}'` : ''}
      ORDER BY date DESC
      LIMIT 31
    `;

    const trendResult = await pool.query(trendQuery);

    const temps = trendResult.rows.map(r => Number(r.temp));
    const tempChange =
      temps.length > 1 ? (temps[0] - temps[1]).toFixed(2) : '0';

    /* ===============================
       4. Response
    ================================ */
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

      forecasts: [
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
      ],

      trend: trendResult.rows
        .map(row => ({
          date: row.date,
          temp: Number(row.temp),
        }))
        .reverse(),

      modelMetrics: {
        rmse: '2.1',
        mae: '2.1',
        r2: '0.85',
        bias: '0.2',
      },
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch station data' });
  }
});

export default router;
