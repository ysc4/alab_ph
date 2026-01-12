import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function connectDB() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log("Connected to PostgreSQL (Neon)");
    return pool;
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    throw error;
  }
}

export function getDB() {
  return pool;
}

export async function closeDB() {
  await pool.end();
  console.log("Disconnected from PostgreSQL");
}
