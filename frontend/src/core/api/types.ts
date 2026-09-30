/** Tipos compartidos entre módulos. Los tipos propios de cada módulo viven en su carpeta. */

export interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Catalogo {
  id: number;
  nombre: string;
  descripcion: string;
  orden: number;
  activo: boolean;
}

export interface Opcion<V = string> {
  value: V;
  label: string;
}

/** Resumen de una novedad tal como la devuelven el Inicio y la ficha. */
export interface NovedadResumen {
  id: number;
  tipo_id: number;
  tipo: string;
  color: string;
  desde: string;
  hasta: string | null;
  dias: number | null;
  motivo: string;
  interrumpida: boolean;
}

export interface SaldoDetalle {
  tipo_id: number;
  tipo: string;
  asignados: number;
  compensados: number;
  ajustes: number;
  acreditados: number;
  usados: number;
  programados: number;
  disponible: number;
}

/**
 * Saldo de una bolsa de días. `tipo` es el tipo dueño de la bolsa; `incluye`
 * lista los tipos que la comparten (p. ej. Licencia invernal) y `desglose`
 * detalla acreditados/usados por cada tipo.
 */
export interface Saldo {
  tipo_id: number;
  tipo: string;
  color: string;
  /** false si el tipo está marcado "no mostrar saldo" (p. ej. licencia de un año ya consumida). */
  mostrar: boolean;
  /** El agente tiene asignaciones, ajustes o licencias en esta bolsa. */
  con_movimientos: boolean;
  /** Se muestra en la ficha (regla por defecto o elección manual). */
  visible: boolean;
  visible_por_defecto: boolean;
  /** La visibilidad fue elegida a mano para este agente. */
  eleccion_manual: boolean;
  incluye: string[];
  desglose: SaldoDetalle[];
  asignados: number;
  compensados: number;
  ajustes: number;
  acreditados: number;
  usados: number;
  programados: number;
  disponible: number;
}

export interface DiaNoLaborable {
  id: number;
  fecha: string;
  tipo: string;
  tipo_display: string;
  motivo: string;
  norma: string;
  observaciones: string;
}

/** Archivo adjunto (documentación de licencias, planillas de cargo...). Se descarga sólo por la API. */
export interface DocumentoAdjunto {
  id: number;
  nombre_original: string;
  descripcion: string;
  subido: string;
  subido_por_nombre: string | null;
  tamanio: number | null;
}

/** Formatos aceptados por el backend (apps/core/archivos.py). */
export const FORMATOS_ADJUNTO = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.odt';

export interface CambioHistorial {
  fecha: string;
  tipo: string;
  usuario: string | null;
  cambios: { campo: string; anterior: string; nuevo: string }[];
}

export type Params = Record<string, string | number | boolean | undefined | null | (string | number)[]>;
