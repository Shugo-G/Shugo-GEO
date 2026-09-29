import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * Cliente HTTP único de la aplicación.
 * - Agrega el token JWT a cada request.
 * - Si el access token vence, lo renueva con el refresh token una sola vez
 *   (aunque haya varios requests en paralelo) y reintenta.
 */
const ACCESS_KEY = 'shugo.access';
const REFRESH_KEY = 'shugo.refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  guardar(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  limpiar() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({
  baseURL: '/api',
  paramsSerializer: { indexes: null },
});

api.interceptors.request.use((config) => {
  const access = tokens.access;
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

let refrescando: Promise<string> | null = null;
let alExpirarSesion: () => void = () => undefined;

export function onSesionExpirada(callback: () => void) {
  alExpirarSesion = callback;
}

async function refrescarToken(): Promise<string> {
  const refresh = tokens.refresh;
  if (!refresh) throw new Error('Sin refresh token');
  const { data } = await axios.post('/api/auth/token/refresh/', { refresh });
  tokens.guardar(data.access, data.refresh);
  return data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _reintento?: boolean }) | undefined;
    const esLogin = original?.url?.includes('auth/token');
    if (error.response?.status === 401 && original && !original._reintento && !esLogin) {
      original._reintento = true;
      try {
        refrescando ??= refrescarToken().finally(() => {
          refrescando = null;
        });
        const nuevo = await refrescando;
        original.headers.Authorization = `Bearer ${nuevo}`;
        return api(original);
      } catch {
        tokens.limpiar();
        alExpirarSesion();
      }
    }
    return Promise.reject(error);
  },
);

/** Extrae un mensaje legible de un error de la API (DRF). */
export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string {
  if (axios.isAxiosError(error)) {
    const estado = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | string | undefined;
    if (!error.response) return 'No se pudo conectar con el servidor.';
    // Respuesta que no es JSON de la API (página HTML de Django o nginx): 400 por host no
    // permitido (DJANGO_ALLOWED_HOSTS), 500 del servidor, 502 si el backend no responde...
    if (!data || typeof data !== 'object') {
      if (estado === 400) return 'El servidor rechazó la solicitud (400). Revise DJANGO_ALLOWED_HOSTS en el .env del servidor.';
      if (estado === 502 || estado === 503 || estado === 504) return `El servidor no responde (${estado}). Revise que el backend esté levantado.`;
      if (estado && estado >= 500) return `Error interno del servidor (${estado}). Revise los logs del backend.`;
      return error.message || porDefecto;
    }
    if (typeof data.detail === 'string') return data.detail;
    const primero = Object.entries(data)[0];
    if (primero) {
      const [campo, valor] = primero;
      const texto = Array.isArray(valor) ? valor.join(' ') : String(valor);
      return campo === 'non_field_errors' ? texto : `${campo}: ${texto}`;
    }
  }
  return porDefecto;
}

/** Convierte errores de validación de DRF al formato de antd Form.setFields. */
export function erroresDeCampos(error: unknown): { name: string; errors: string[] }[] {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return [];
  const data = error.response.data as Record<string, unknown>;
  return Object.entries(data)
    .filter(([campo]) => campo !== 'detail' && campo !== 'non_field_errors')
    .map(([campo, valor]) => ({ name: campo, errors: Array.isArray(valor) ? valor.map(String) : [String(valor)] }));
}
