export function tryParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export function formatHeaders(headersStr: string): Record<string, string> {
  try {
    const headers = JSON.parse(headersStr);
    return headers;
  } catch {
    return {};
  }
}

export function prettyPrintJSON(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function formatBangkokTime(timestamp: number | string): string {
  try {
    // Handle both timestamp (number) and ISO string formats
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return String(timestamp);
  }
}

export function formatBangkokDate(timestamp: number | string): string {
  try {
    // Handle both timestamp (number) and ISO string formats
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return String(timestamp);
  }
}

export function convertBangkokDateToTimestamp(dateStr: string): number {
  // Convert Bangkok timezone datetime-local input value to timestamp
  // datetime-local gives us YYYY-MM-DDThh:mm in local timezone
  // We need to parse this as Bangkok time and convert to UTC timestamp
  const [datePart, timePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create a date in Bangkok timezone
  const bangkokDate = new Date();
  // getTimezoneOffset returns minutes, Bangkok is UTC+7 = -420 minutes
  const bangkokOffset = -420;
  const localOffset = bangkokDate.getTimezoneOffset();
  // Adjust for the difference between local and Bangkok timezone
  const offsetDiff = localOffset - bangkokOffset;
  
  // Set the date components
  bangkokDate.setFullYear(year);
  bangkokDate.setMonth(month - 1); // month is 0-based
  bangkokDate.setDate(day);
  bangkokDate.setHours(hours);
  bangkokDate.setMinutes(minutes - offsetDiff); // Adjust for timezone difference
  bangkokDate.setSeconds(0);
  bangkokDate.setMilliseconds(0);
  
  return bangkokDate.getTime();
}