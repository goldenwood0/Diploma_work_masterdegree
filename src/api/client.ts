export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Same-origin API, proxied to Nest by Vite in development.
// Return unknown so domain modules must validate responses before using them.
export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API path must begin with a single slash');
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-ZhPath-Request': '1', ...Object.fromEntries(new Headers(options.headers)) },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'Нет связи с сервером. Попробуйте ещё раз.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof error?.message === 'string' && response.status < 500
      ? error.message : 'Сервис временно недоступен. Попробуйте ещё раз.');
  }
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, 'Сервер вернул некорректный ответ.');
  }
}
