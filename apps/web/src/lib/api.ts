export type ApiEndpoint = '/health' | '/auth/public' | '/auth/profile' | '/auth/admin';
export type ApiResult = { status: number; data: unknown; requestId: string | null };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly kind: 'auth' | 'forbidden' | 'network' | 'timeout' | 'server',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  onUnauthorized?: () => void;
  fetcher?: typeof fetch;
};

export function createApiClient(options: ApiOptions) {
  return async (
    endpoint: ApiEndpoint,
    authenticate = endpoint !== '/health' && endpoint !== '/auth/public',
  ): Promise<ApiResult> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authenticate) {
      let token: string | null;
      try {
        token = await options.getToken();
      } catch {
        throw new ApiError('Session refresh failed. Please log in again.', 401, 'auth');
      }
      if (!token)
        throw new ApiError('Please log in before calling a protected endpoint.', 401, 'auth');
      headers.Authorization = 'Bearer ' + token;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await (options.fetcher ?? fetch)(options.baseUrl + '/api' + endpoint, {
        method: 'GET',
        headers,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (response.status === 401) {
        if (authenticate) options.onUnauthorized?.();
        throw new ApiError(
          '401 — The API could not authenticate this request. Log in again or check issuer/audience settings.',
          401,
          'auth',
        );
      }
      if (response.status === 403)
        throw new ApiError(
          '403 — Signed in, but this account does not have the required API role.',
          403,
          'forbidden',
        );
      if (!response.ok)
        throw new ApiError(
          'The API returned HTTP ' + response.status + '. Try again later.',
          response.status,
          'server',
        );
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new ApiError(
          'The API returned an unexpected non-JSON response.',
          response.status,
          'server',
        );
      }
      return { status: response.status, data, requestId: response.headers.get('X-Request-Id') };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted)
        throw new ApiError(
          'The API took too long to respond. Check that NestJS is running.',
          null,
          'timeout',
        );
      throw new ApiError(
        'Cannot reach the API. Check its URL, that NestJS is running, and the allowed CORS origin.',
        null,
        'network',
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
