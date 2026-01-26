import { Router, Request, Response } from 'express';
import { getDB } from '../db';

const router = Router();
const pool = getDB();

/**
 * GET /api/classification-info/:level
 * Get effects and interventions for a specific classification level
 */
router.get('/classification-info/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;

    const result = await pool.query(
      `SELECT 
        c.id,
        c.level,
        c.min_temp,
        c.max_temp,
        c.effects,
        c.interventions,
        pe.health_risk,
        pe.daily_acts,
        pe.infra_stress,
        pe.env_stress,
        ri.public_health,
        ri.act_management,
        ri.resource_readiness,
        ri.comm_engagement
      FROM classification c
      LEFT JOIN potential_effects pe ON c.id = pe.risk_level
      LEFT JOIN recommended_interventions ri ON c.id = ri.risk_level
      WHERE LOWER(c.level) = LOWER($1)
      LIMIT 1`,
      [level]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classification level not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching classification info:', error);
    res.status(500).json({ error: 'Failed to fetch classification information' });
  }
});

/**
 * GET /api/classification-info
 * Get all classification levels with effects and interventions
 */
router.get('/classification-info', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        c.id,
        c.level,
        c.min_temp,
        c.max_temp,
        c.effects,
        c.interventions,
        pe.health_risk,
        pe.daily_acts,
        pe.infra_stress,
        pe.env_stress,
        ri.public_health,
        ri.act_management,
        ri.resource_readiness,
        ri.comm_engagement
      FROM classification c
      LEFT JOIN potential_effects pe ON c.id = pe.risk_level
      LEFT JOIN recommended_interventions ri ON c.id = ri.risk_level
      ORDER BY CAST(c.min_temp AS NUMERIC)`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching classification info:', error);
    res.status(500).json({ error: 'Failed to fetch classification information' });
  }
});

export default router;
