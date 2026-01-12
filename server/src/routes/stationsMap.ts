import { Router } from 'express';
import { getDB } from '../db';

const router = Router();

router.get('/stationMarkers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDB();

    const query = `
      SELECT 
        s.id,
        s.station AS name,
        s.latitude AS lat,
        s.longitude AS lng,
        COALESCE(hi.actual, 0) AS temp,
        COALESCE(hi.pagasa_forecasted, 0) AS forecasted,
        COALESCE(hi.model_forecasted, 0) AS model_forecasted,
        COALESCE(c.level, 'N/A') AS risk_level
      FROM stations s
      LEFT JOIN LATERAL (
        SELECT 
          actual,
          pagasa_forecasted,
          model_forecasted,
          risk_level
        FROM heat_index
        WHERE heat_index.station = s.id
        ORDER BY date DESC
        LIMIT 1
      ) hi ON true
      LEFT JOIN classification c
        ON hi.risk_level = c.id
      WHERE s.id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Station marker not found' });
    }

    const marker = result.rows[0];

    const markerData = {
      id: marker.id,
      name: marker.name,
      lat: parseFloat(marker.lat ?? 0),
      lng: parseFloat(marker.lng ?? 0),
      temp: parseFloat(marker.temp ?? 0),
      forecasted: parseFloat(marker.forecasted ?? 0),
      modelForecasted: parseFloat(marker.model_forecasted ?? 0),
      riskLevel: marker.risk_level,
    };

    res.json(markerData);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch station marker details' });
  }
});


export default router;
