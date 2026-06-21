
const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiEnvelope =
  | { ok: true; data: unknown; meta?: { generatedAt?: number; requestId?: string } }
  | { ok: false; code: string; message: string; details?: unknown };

function assertEnvelope(body: unknown): asserts body is ApiEnvelope {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError('INVALID_RESPONSE', 'Malformed API response: not an object');
  }
  const obj = body as Record<string, unknown>;
  if (typeof obj.ok !== 'boolean') {
    throw new ApiError('INVALID_RESPONSE', 'Malformed API response: missing ok field');
  }
  if (obj.ok === true) {
    if (!('data' in obj)) {
      throw new ApiError('INVALID_RESPONSE', 'Malformed API response: success envelope missing data');
    }
  } else {
    if (typeof obj.code !== 'string' || typeof obj.message !== 'string') {
      throw new ApiError('INVALID_RESPONSE', 'Malformed API response: error envelope missing code/message');
    }
  }
}

export type QueryParamValue = string | number | boolean | undefined;

function buildUrl(path: string, params?: Record<string, QueryParamValue>): string {
  if (!path.startsWith('/')) {
    throw new ApiError('INVALID_PATH', `API path must start with '/', got: ${path}`);
  }
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  // Arrays are not supported in query serialization yet.
  // Multi-value params will need a separate strategy (repeat key, comma-join, etc.)
  return url.toString();
}

/** Full response is buffered into memory before parsing. Acceptable for analytics payloads,
 *  but large event exports or streaming responses will need a different approach. */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    params?: Record<string, QueryParamValue>;
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const url = method === 'GET' ? buildUrl(path, options?.params) : buildUrl(path);
  const init: RequestInit = {
    method,
    signal: options?.signal,
  };
  if ((method === 'POST' || method === 'PUT') && options?.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Network request failed');
  }

  const text = await res.text();

  if (!res.ok) {
    try {
      const parsed: unknown = JSON.parse(text);
      assertEnvelope(parsed);
      if (parsed.ok === false) {
        throw new ApiError(parsed.code, parsed.message, parsed.details);
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // Include raw response snippet for proxy/nginx/HTML error debugging
      throw new ApiError('HTTP_ERROR', `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    throw new ApiError('HTTP_ERROR', `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError('INVALID_JSON', 'Server returned invalid JSON response');
  }
  assertEnvelope(parsed);
  if (parsed.ok === false) {
    throw new ApiError(parsed.code, parsed.message, parsed.details);
  }
  return parsed.data as T;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, QueryParamValue>,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>('GET', path, { params, signal });
}

export function apiPost<TReq, TRes>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): Promise<TRes> {
  return request<TRes>('POST', path, { body, signal });
}

export function apiPut<TReq, TRes>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): Promise<TRes> {
  return request<TRes>('PUT', path, { body, signal });
}

export function apiDelete<TRes>(
  path: string,
  signal?: AbortSignal,
): Promise<TRes> {
  return request<TRes>('DELETE', path, { signal });
}
