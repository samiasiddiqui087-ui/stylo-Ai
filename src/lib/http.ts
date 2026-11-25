export async function parseJsonResponse<T>(
  resp: Response,
  fallbackError = 'Unable to process server response.'
): Promise<T> {
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  const rawText = await resp.text();

  if (!rawText) {
    if (!resp.ok) {
      throw new Error(formatHttpErrorMessage(resp.status, fallbackError));
    }
    return {} as T;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const trimmed = rawText.trim();
    const isNotFoundText =
      resp.status === 404 ||
      contentType.includes('text/html') ||
      trimmed.startsWith('<!') ||
      trimmed.startsWith('<html') ||
      /the page could not be found/i.test(trimmed);

    if (isNotFoundText) {
      let pathname = '';
      try {
        pathname = resp.url ? new URL(resp.url).pathname : '';
      } catch {
        pathname = '';
      }
      throw new Error(
        `API route${pathname ? ` (${pathname})` : ''} returned a non-JSON 404 response. Verify Vercel serverless API routing is active.`
      );
    }

    throw new Error(formatHttpErrorMessage(resp.status, fallbackError));
  }

  return parsed as T;
}

export async function tryParseJson<T>(resp: Response): Promise<T | null> {
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    const rawText = await resp.text();
    if (!rawText) return null;
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

export function formatHttpErrorMessage(status: number, fallback: string): string {
  if (status === 404) return 'Requested API endpoint was not found (404).';
  if (status === 401) return 'Authentication required or session expired (401).';
  if (status === 403) return 'Access denied for this request (403).';
  if (status === 413) return 'Uploaded data exceeds the server size limit (413).';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return `Server error (HTTP ${status}). Please try again shortly.`;
  return status ? `${fallback} (HTTP ${status})` : fallback;
}

export function toFriendlyNetworkError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return 'Network error while contacting the server. Please check your connection and try again.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
