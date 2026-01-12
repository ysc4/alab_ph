import { Router } from 'express';
import { getDB } from '../db';

const router = Router();

router.get('/stations', async (_req, res) => {
  try {
    const pool = getDB();
    const query = `
      SELECT 
        s.id,
        s.station as name,
        s.latitude as lat,
        s.longitude as lng,
        COALESCE(hi.actual, 0) as temp
      FROM stations s
      LEFT JOIN LATERAL (
        SELECT actual, date
        FROM heat_index
        WHERE heat_index.station = s.id
        ORDER BY date DESC
        LIMIT 1
      ) hi ON true
      ORDER BY s.id;
    `;
    
    const result = await pool.query(query);
    const stations = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      lat: parseFloat(row.lat || 0),
      lng: parseFloat(row.lng || 0),
      temp: parseFloat(row.temp || 0),
    }));
    
    res.json(stations);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

export default router;
