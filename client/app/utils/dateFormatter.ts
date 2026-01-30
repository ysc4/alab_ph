/**
 * Generates a time series for trend graphs (week/month) with 0 after selected date.
 * Backend already filters data to correct range, this just formats it.
 * @param selectedDate - The reference date (string or Date)
 * @param period - "Week" or "Month"
 * @param trendData - Array of objects with date and values (already filtered by backend)
 * @param keys - Array of keys to fill (e.g. ["temp", "pagasa_forecasted", "model_forecasted"])
 * @returns Array of objects for charting with day numbers
 */
export function getTrendSeries(
  selectedDate: string | Date,
  period: "Week" | "Month",
  trendData?: Array<{ date: string; [key: string]: any }> | null,
  keys: string[] = []
): Array<{ day: number; date: string; [key: string]: any }> {
  // Normalize selected date to midnight for accurate comparison
  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  // If no trend data, return empty array
  if (!trendData || trendData.length === 0) {
    return [];
  }

  // Backend already filters for Week (7 days) or Month
  // We just need to add day numbers and zero out future dates
  const result = trendData.map((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    
    const entry: any = { 
      day: dDate.getDate(),
      date: d.date 
    };
    
    // Zero out values after selected date
    if (dDate.getTime() > selected.getTime()) {
      for (const key of keys) {
        entry[key] = 0;
      }
    } else {
      for (const key of keys) {
        entry[key] = d[key] ?? 0;
      }
    }
    
    return entry;
  });

  // Special condition: Exclude March 1 for all March dates
  const selectedMonth = selected.getMonth(); // 0-indexed: March = 2
  const selectedYear = selected.getFullYear();
  
  if (selectedMonth === 2) { // March
    return result.filter(item => {
      const itemDate = new Date(item.date);
      // Exclude March 1 of the same year
      return !(itemDate.getDate() === 1 && itemDate.getMonth() === 2 && itemDate.getFullYear() === selectedYear);
    });
  }

  return result;
}

/**
 * Generates forecast error series (backend already filters to correct range)
 * @param selectedDate - The reference date
 * @param errorData - Array of forecast error objects (already filtered by backend)
 * @returns Array with future dates zeroed out
 */
export function getForecastErrorSeries<T extends { day: string | number; date?: string; [key: string]: any }>(
  selectedDate: string,
  errorData: T[]
): T[] {
  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  // Backend already filters the data, we just need to zero out future dates
  const result = errorData.map((d) => {
    let dDate: Date | null = null;
    
    // Try to use date field if available
    if (d.date && typeof d.date === 'string') {
      dDate = new Date(d.date);
    } else if (typeof d.day === 'string') {
      dDate = new Date(d.day);
    } else if (typeof d.day === 'number') {
      // Assume same month/year as selectedDate
      dDate = new Date(selected);
      dDate.setDate(d.day);
    }
    
    if (dDate) {
      dDate.setHours(0, 0, 0, 0);
      
      // Zero out values after selected date
      if (dDate.getTime() > selected.getTime()) {
        const zeroed = { ...d } as any;
        // Zero out numeric fields (typically t_plus_one, t_plus_two)
        for (const key in zeroed) {
          if (typeof zeroed[key] === 'number' && key !== 'day') {
            zeroed[key] = 0;
          }
        }
        return zeroed;
      }
    }
    
    return d;
  });

  // Special condition: Exclude March 1 for all March dates
  const selectedMonth = selected.getMonth(); // 0-indexed: March = 2
  const selectedYear = selected.getFullYear();
  
  if (selectedMonth === 2) { // March
    return result.filter(item => {
      let itemDate: Date | null = null;
      
      if (item.date && typeof item.date === 'string') {
        itemDate = new Date(item.date);
      } else if (typeof item.day === 'number') {
        itemDate = new Date(selected);
        itemDate.setDate(item.day);
      }
      
      if (itemDate) {
        // Exclude March 1 of the same year
        return !(itemDate.getDate() === 1 && itemDate.getMonth() === 2 && itemDate.getFullYear() === selectedYear);
      }
      
      return true;
    });
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