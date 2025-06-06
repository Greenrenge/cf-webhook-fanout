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