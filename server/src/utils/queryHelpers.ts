import { getISOWeekRange } from './dateFormatter';

/**
 * Generate a date range condition for SQL queries
 * Supports Week and Month ranges
 */
export const getDateRangeCondition = (date: string | undefined, range: string | undefined): string => {
  if (!date) {
    const days = range === 'Month' ? 31 : 7;
    return `date >= CURRENT_DATE - INTERVAL '${days} days'`;
  }

  const selectedDate = new Date(date);
  
  if (range === 'Month') {
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return `date >= '${startOfMonth.toISOString().split('T')[0]}' AND date <= '${endOfMonth.toISOString().split('T')[0]}'`;
  }
  
  const { startDate, endDate } = getISOWeekRange(date);
  return `date >= '${startDate}' AND date <= '${endDate}'`;
};

/**
 * Common classification JOIN clause
 * Used across multiple endpoints to determine risk level
 */
export const CLASSIFICATION_JOIN = `
  LEFT JOIN classification c 
  ON hi.model_forecasted >= c.min_temp 
  AND hi.model_forecasted < CAST(c.max_temp AS NUMERIC) + 1
`;

/**
 * Get risk level CASE statement
 */
export const getRiskLevelCase = (tempColumn: string = 'model_forecasted'): string => {
  return `CASE 
    WHEN ${tempColumn} IS NULL THEN 'N/A'
    ELSE COALESCE(c.level, 'N/A')
  END`;
};

/**
 * Round numeric value with default
 */
export const roundNumeric = (column: string, defaultValue: number = 0, decimals: number = 1): string => {
  return `ROUND(COALESCE(${column}, ${defaultValue})::numeric, ${decimals})`;
};
