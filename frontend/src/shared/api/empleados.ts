import { api } from '@/core/api/client';
import { crearRecurso } from '@/core/api/crud';
import type { DocumentoAdjunto } from '@/core/api/types';

export type SituacionRevista = 'ACTIVO' | 'SUSPENDIDO' | 'BAJA';

export interface Empleado {
  id: number;
  apellido: string;
  nombre: string;
  nombre_completo: string;
  /** Nombre para la tarjeta del Inicio; vacío = primer apellido y primer nombre. */
  etiqueta: string;
  nombre_tarjeta: string;
  dni: string;
  /** 11 dígitos, sin guiones. */
  cuit: string;
  legajo: string;
  fecha_nacimiento: string | null;
  titulo: string;
  unidad: number;
  unidad_nombre: string;
  unidad_tipo: string;
  /** Ruta completa, p. ej. "Dirección de Infraestructura › Soporte técnico". */
  unidad_ruta: string;
  modalidad: number;
  modalidad_nombre: string;
  fecha_ingreso: string;
  fecha_fin_contrato: string | null;
  numero_proveedor: string;
  /** "HH:mm:ss" */
  hora_entrada: string;
  hora_salida: string;
  /** "08:00 a 15:00" */
  horario: string;
  cargo: number | null;
  cargo_nombre: string | null;
  cargo_acto_administrativo: string;
  /** Adjuntos del acto administrativo del cargo. */
  documentos_count: number;
  adicionales: number[];
  adicionales_nombres: string[];
  telefono: string;
  email: string;
  situacion_revista: SituacionRevista;
  situacion_revista_display: string;
  fecha_baja: string | null;
  observaciones: string;
}

export const SITUACIONES: { value: SituacionRevista; label: string; color: string }[] = [
  { value: 'ACTIVO', label: 'Activo', color: 'green' },
  { value: 'SUSPENDIDO', label: 'Suspendido', color: 'orange' },
  { value: 'BAJA', label: 'Baja', color: 'default' },
];

export const empleadosApi = crearRecurso<Empleado>('personal/empleados');

/** "20301112220" → "20-30111222-0" */
export const fmtCuit = (cuit?: string | null) => (cuit && cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit || '—');

export const PERMISOS_DOCUMENTOS_EMPLEADO = {
  ver: 'personal.view_documentoempleado',
  subir: 'personal.add_documentoempleado',
  eliminar: 'personal.delete_documentoempleado',
};

/** Adjuntos de la ficha: el acto administrativo del cargo. Quedan aunque el agente cambie de cargo. */
export const documentosEmpleadoApi = {
  listar: async (empleado: number) =>
    (await api.get<DocumentoAdjunto[]>('/personal/documentos/', { params: { empleado } })).data,
  subir: async (empleado: number, archivo: File) => {
    const datos = new FormData();
    datos.append('empleado', String(empleado));
    datos.append('archivo', archivo);
    return (await api.post<DocumentoAdjunto>('/personal/documentos/', datos)).data;
  },
  eliminar: async (id: number) => api.delete(`/personal/documentos/${id}/`),
  urlDescarga: (id: number) => `/personal/documentos/${id}/descargar/`,
};
