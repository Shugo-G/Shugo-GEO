import { api } from '@/core/api/client';
import { crearRecurso } from '@/core/api/crud';
import type { DocumentoAdjunto } from '@/core/api/types';

export interface DocumentoNovedad extends DocumentoAdjunto {
  novedad: number;
}

export type EstadoNovedad = 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'INTERRUMPIDA' | 'ANULADA';

export const ESTADOS_NOVEDAD: Record<EstadoNovedad, { label: string; color: string }> = {
  PROGRAMADA: { label: 'Programada', color: 'blue' },
  EN_CURSO: { label: 'En curso', color: 'green' },
  FINALIZADA: { label: 'Finalizada', color: 'default' },
  INTERRUMPIDA: { label: 'Interrumpida', color: 'orange' },
  ANULADA: { label: 'Anulada', color: 'red' },
};

export interface Novedad {
  id: number;
  empleado: number;
  empleado_nombre: string;
  empleado_legajo: string;
  unidad_nombre: string;
  tipo: number;
  tipo_nombre: string;
  color: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  abierta: boolean;
  dias: number | null;
  descuenta_saldo: boolean;
  motivo: string;
  observaciones: string;
  interrumpida: boolean;
  fecha_hasta_original: string | null;
  dias_original: number | null;
  dias_reintegrados: number;
  motivo_interrupcion: string;
  estado: EstadoNovedad;
  estado_display: string;
  anulada: boolean;
  fecha_anulacion: string | null;
  motivo_anulacion: string;
  anulada_por_nombre: string | null;
  documentos_cantidad: number;
  documentacion_pendiente: boolean;
  /** null si el usuario no tiene permiso para ver documentación. */
  documentos: DocumentoNovedad[] | null;
  creado: string;
  creado_por_nombre: string | null;
  /** Programada (no empezó) o cargada hoy (corrección de un error). */
  puede_eliminarse: boolean;
}

export const novedadesApi = crearRecurso<Novedad>('novedades');

export const calcularDias = async (tipo: number, desde: string, hasta?: string) =>
  (await api.get<{ dias: number | null; computo: string }>('/novedades/calcular-dias/', { params: { tipo, desde, hasta } }))
    .data;

export const cerrarNovedad = async (id: number, fecha_hasta: string) =>
  (await api.post<Novedad>(`/novedades/${id}/cerrar/`, { fecha_hasta })).data;

/** Corta una licencia antes de lo previsto; los días no tomados vuelven al saldo. */
export const interrumpirNovedad = async (id: number, fecha_hasta: string, motivo: string) =>
  (await api.post<Novedad>(`/novedades/${id}/interrumpir/`, { fecha_hasta, motivo })).data;

/** Anula una licencia cargada por error: se conserva el registro y sus días vuelven al saldo. */
export const anularNovedad = async (id: number, motivo: string) =>
  (await api.post<Novedad>(`/novedades/${id}/anular/`, { motivo })).data;

export const documentosApi = {
  subir: async (novedad: number, archivo: File, descripcion = '') => {
    const datos = new FormData();
    datos.append('novedad', String(novedad));
    datos.append('archivo', archivo);
    datos.append('descripcion', descripcion);
    return (await api.post<DocumentoNovedad>('/novedades/documentos/', datos)).data;
  },
  eliminar: async (id: number) => api.delete(`/novedades/documentos/${id}/`),
  urlDescarga: (id: number) => `/novedades/documentos/${id}/descargar/`,
};
