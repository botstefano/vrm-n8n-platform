let accessToken: string | null = null;

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
const API_BASE_URL = configuredBaseUrl.replace(/\/$/, '');

export function setApiAccessToken(token: string | null): void {
  accessToken = token;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function apiRequest<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!accessToken) throw new Error('No hay una sesión autenticada. Vuelve a iniciar sesión.');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json'
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new Error('No se pudo conectar con la API VRM. Comprueba VITE_API_BASE_URL y el estado de Render.');
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error de API HTTP ${response.status}`);
  return payload as T;
}
