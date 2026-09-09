export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Future API modules use a same-origin /api prefix. No server is connected yet.
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
      headers: { Accept: 'application/json', ...Object.fromEntries(new Headers(options.headers)) },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'Нет связи с сервером. Попробуйте ещё раз.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, response.status === 401
      ? 'Необходимо войти в аккаунт.'
      : 'Не удалось выполнить запрос. Попробуйте ещё раз.');
  }
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, 'Сервер вернул некорректный ответ.');
  }
}
