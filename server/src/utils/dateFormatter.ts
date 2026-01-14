export function getISOWeekRange(dateStr: string): { startDate: string; endDate: string } {
  const date = new Date(dateStr);
  
  // Get day of week (0 = Sunday, 1 = Monday, ...)
  const dayOfWeek = date.getDay();
  // Calculate days to Monday (ISO week starts on Monday)
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Get Monday of the ISO week
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - daysToMonday);
  
  // Get Sunday of the ISO week
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  return {
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0]
  };
}