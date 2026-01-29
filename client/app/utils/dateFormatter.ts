/**
 * Generates a time series for trend graphs (week/month) with 0 after selected date.
 * @param selectedDate - The reference date (string or Date)
 * @param period - "Week" or "Month"
 * @param trendData - Array of objects with date and values (optional)
 * @param keys - Array of keys to fill (e.g. ["temp", "pagasa_forecasted", "model_forecasted"])
 * @returns Array of objects for charting
 */
export function getTrendSeries(
  selectedDate: string | Date,
  period: "Week" | "Month",
  trendData?: Array<{ date: string; [key: string]: any }> | null,
  keys: string[] = []
): Array<{ date: string; [key: string]: any }> {
  // Normalize selected date to midnight for accurate comparison
  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  // If no trend data, return empty array
  if (!trendData || trendData.length === 0) {
    return [];
  }

  // Filter for week or month
  let filtered = trendData;
  if (period === "Week") {
    // Rolling 7-day window ending at selected date
    const dataMap = new Map(
      trendData.map(d => [new Date(d.date).toISOString().slice(0, 10), d])
    );
    const weekSeries = [];
    let current = new Date(selected);
    current.setDate(current.getDate() - 6); // 6 days before selected date
    for (let i = 0; i < 7; i++) {
      const dateStr = current.toISOString().slice(0, 10);
      const d = dataMap.get(dateStr);
      const dDate = new Date(dateStr);
      dDate.setHours(0, 0, 0, 0);
      let entry: any = { date: dateStr };
      if (d) {
        for (const key of keys) {
          entry[key] = dDate.getTime() > selected.getTime() ? 0 : d[key] ?? 0;
        }
      } else {
        for (const key of keys) {
          entry[key] = dDate.getTime() > selected.getTime() ? 0 : 0;
        }
      }
      weekSeries.push(entry);
      current.setDate(current.getDate() + 1);
    }
    return weekSeries;
  } else if (period === "Month") {
    filtered = trendData.filter(d => {
      const dDate = new Date(d.date);
      return dDate.getFullYear() === selected.getFullYear() && dDate.getMonth() === selected.getMonth();
    });
    return filtered.map((d) => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      if (dDate.getTime() > selected.getTime()) {
        const entry: any = { date: d.date };
        for (const key of keys) {
          entry[key] = 0;
        }
        return entry;
      }
      const entry: any = { date: d.date };
      for (const key of keys) {
        entry[key] = d[key] ?? 0;
      }
      return entry;
    });
  }
  // Fallback: if period is not Week or Month, return empty array
  return [];
}

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