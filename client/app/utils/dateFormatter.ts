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

  if (period === "Week") {
    // Rolling 7-day window ending at selected date
    const dataMap = new Map(
      trendData.map(d => [new Date(d.date).toISOString().slice(0, 10), d])
    );
    const weekSeries = [];
    let current = new Date(selected);
    current.setDate(current.getDate() - 6); // Start 6 days before selected date
    
    for (let i = 0; i < 7; i++) {
      const dateStr = current.toISOString().slice(0, 10);
      const d = dataMap.get(dateStr);
      const dDate = new Date(dateStr);
      dDate.setHours(0, 0, 0, 0);
      
      let entry: any = { date: dateStr };
      
      if (d) {
        for (const key of keys) {
          // Only show data up to and including selected date
          entry[key] = dDate.getTime() > selected.getTime() ? 0 : d[key] ?? 0;
        }
      } else {
        for (const key of keys) {
          entry[key] = 0;
        }
      }
      
      weekSeries.push(entry);
      current.setDate(current.getDate() + 1);
    }
    return weekSeries;
  } else if (period === "Month") {
    const filtered = trendData.filter(d => {
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
  
  return [];
}

/**
 * Generates forecast error series with rolling 7-day window ending at selected date
 * @param selectedDate - The reference date
 * @param errorData - Array of forecast error objects
 * @returns Filtered array for the 7-day window
 */
export function getForecastErrorSeries<T extends { day: string | number; [key: string]: any }>(
  selectedDate: string,
  errorData: T[]
): T[] {
  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  // Create 7-day window: 6 days before selected date + selected date
  const startDate = new Date(selected);
  startDate.setDate(selected.getDate() - 6);

  // Map error data by date for quick lookup
  const dataMap = new Map<string, T>();
  
  for (const d of errorData) {
    let dDate: Date | null = null;
    
    if (typeof d.day === 'string') {
      dDate = new Date(d.day);
    } else if (typeof d.day === 'number') {
      // Assume same month/year as selectedDate
      dDate = new Date(selected);
      dDate.setDate(d.day);
    }
    
    if (dDate) {
      dDate.setHours(0, 0, 0, 0);
      const dateStr = dDate.toISOString().slice(0, 10);
      dataMap.set(dateStr, d);
    }
  }

  // Generate 7-day series
  const result: T[] = [];
  let current = new Date(startDate);
  
  for (let i = 0; i < 7; i++) {
    const dateStr = current.toISOString().slice(0, 10);
    const data = dataMap.get(dateStr);
    const currentDate = new Date(current);
    currentDate.setHours(0, 0, 0, 0);
    
    if (data) {
      // Zero out values after selected date
      if (currentDate.getTime() > selected.getTime()) {
        const zeroed = { ...data } as any;
        // Zero out numeric fields (typically t_plus_one, t_plus_two)
        for (const key in zeroed) {
          if (typeof zeroed[key] === 'number' && key !== 'day') {
            zeroed[key] = 0;
          }
        }
        result.push(zeroed);
      } else {
        result.push(data);
      }
    } else {
      // Create empty entry with day as current day number
      const emptyEntry = { day: current.getDate() } as any;
      for (const key in errorData[0]) {
        if (key !== 'day' && typeof errorData[0][key] === 'number') {
          emptyEntry[key] = 0;
        }
      }
      result.push(emptyEntry);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return result;
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

  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return {
    week,
    year: d.getUTCFullYear(),
  };
}

/**
 * Get rolling 7-day range (6 days before selected date + selected date)
 * @param dateStr - The selected date
 * @returns Object with startDate and endDate in YYYY-MM-DD format
 */
export function getISOWeekRange(dateStr: string): { startDate: string; endDate: string } {
  const date = new Date(dateStr);
  
  // Start date: 6 days before selected date
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - 6);
  
  // End date: selected date itself
  const endOfWeek = new Date(date);
  
  return {
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0]
  };
}