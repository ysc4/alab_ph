export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateShort = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${year}`;
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
