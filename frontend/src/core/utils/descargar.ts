import { api } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import type { Params } from '@/core/api/types';

/** Descarga un archivo autenticado (el token viaja en el header, no en la URL). */
export async function descargarArchivo(url: string, params?: Params, nombrePorDefecto = 'archivo') {
  const respuesta = await api.get<Blob>(url, { params: limpiarParams(params), responseType: 'blob' });
  const disposicion = respuesta.headers['content-disposition'] as string | undefined;
  const nombre = disposicion?.match(/filename="?([^";]+)"?/)?.[1] ?? nombrePorDefecto;
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(respuesta.data);
  enlace.download = decodeURIComponent(nombre);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
