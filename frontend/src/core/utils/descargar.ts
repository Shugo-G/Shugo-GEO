import { api } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import type { Params } from '@/core/api/types';

/** Obtiene un archivo autenticado (el token viaja en el header, no en la URL). */
export async function obtenerArchivo(url: string, params?: Params) {
  const respuesta = await api.get<Blob>(url, { params: limpiarParams(params), responseType: 'blob' });
  const disposicion = respuesta.headers['content-disposition'] as string | undefined;
  const nombre = disposicion?.match(/filename="?([^";]+)"?/)?.[1];
  return { blob: respuesta.data, nombre: nombre ? decodeURIComponent(nombre) : undefined };
}

/** Descarga un archivo autenticado. */
export async function descargarArchivo(url: string, params?: Params, nombrePorDefecto = 'archivo') {
  const { blob, nombre } = await obtenerArchivo(url, params);
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre ?? nombrePorDefecto;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
