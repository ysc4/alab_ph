export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateShort = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
};

export const getWeekOfMonth = (dateString: string | Date): number => {
  const date = new Date(dateString);
  const dayOfMonth = date.getDate();
  // Simple week calculation: Week 1 = days 1-7, Week 2 = days 8-14, etc.
  return Math.ceil(dayOfMonth / 7);
};

export const formatDateWithWeek = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const week = getWeekOfMonth(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `W${week} ${month}/${day}/${year}`;
};

// utils/dateFormatter.ts

export function getISOWeek(dateStr: string): { week: number; year: number } {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // ISO week starts Monday
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return {
    week,
    year: d.getUTCFullYear(),
  };
}

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
