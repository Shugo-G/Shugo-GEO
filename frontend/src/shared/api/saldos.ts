import { api } from '@/core/api/client';
import { crearRecurso } from '@/core/api/crud';
import type { Saldo } from '@/core/api/types';

export type ConceptoMovimiento = 'ASIGNACION' | 'COMPENSACION' | 'AJUSTE';

export const CONCEPTOS: { value: ConceptoMovimiento; label: string; color: string }[] = [
  { value: 'ASIGNACION', label: 'Asignación de días', color: 'blue' },
  { value: 'COMPENSACION', label: 'Compensación por día trabajado', color: 'green' },
  { value: 'AJUSTE', label: 'Ajuste manual', color: 'orange' },
];

export interface MovimientoSaldo {
  id: number;
  empleado: number;
  empleado_nombre: string;
  tipo_novedad: number;
  tipo_novedad_nombre: string;
  concepto: ConceptoMovimiento;
  concepto_display: string;
  anio: number;
  dias: number;
  fecha: string;
  fecha_trabajada: string | null;
  motivo: string;
  creado: string;
  creado_por_nombre: string | null;
}

export interface FilaSaldos {
  empleado_id: number;
  empleado: string;
  legajo: string;
  unidad: string;
  modalidad: string;
  saldos: Saldo[];
}

/** Muestra u oculta una bolsa en la ficha del agente; `null` vuelve a la regla por defecto. */
export const guardarPreferenciaSaldo = async (empleado: number, tipo: number, visible: boolean | null) =>
  (await api.post('/vacaciones/preferencias/', { empleado, tipo, visible })).data;

export const movimientosApi = crearRecurso<MovimientoSaldo>('vacaciones/movimientos');

export const obtenerSaldos = async (params: Record<string, string | undefined>) =>
  (await api.get<{ tipos: { id: number; nombre: string }[]; resultados: FilaSaldos[] }>('/vacaciones/saldos/', { params }))
    .data;

export const asignacionMasiva = async (datos: {
  tipo_novedad: number;
  anio: number;
  dias: number;
  motivo?: string;
  unidad?: number[];
  modalidad?: number[];
  empleados?: number[];
  omitir_existentes: boolean;
}) => (await api.post<{ creados: number; omitidos: number }>('/vacaciones/movimientos/asignacion-masiva/', datos)).data;
