export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(input, init);
  const rawText = await res.text();
  const contentType = res.headers.get('content-type') || '';

  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 80);
      const hint =
        res.status === 404
          ? 'API endpoint returned 404 (not found). Verify the backend API routes are deployed.'
          : contentType.includes('text/html')
          ? `Server returned HTML instead of JSON (HTTP ${res.status}).`
          : `Unexpected server response (HTTP ${res.status}): ${preview || 'empty response'}`;
      throw new Error(hint);
    }
  }

  if (!res.ok) {
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Request failed with status ${res.status}.`;
    throw new Error(errMsg);
  }

  return {
    ok: res.ok,
    status: res.status,
    data: (parsed ?? {}) as T,
  };
}
