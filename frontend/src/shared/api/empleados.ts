import { crearRecurso } from '@/core/api/crud';

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
