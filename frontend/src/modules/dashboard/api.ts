import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import type { DiaNoLaborable, NovedadResumen, Params } from '@/core/api/types';

export interface FilaEstado {
  id: number;
  legajo: string;
  nombre: string;
  /** Nombre corto para la tarjeta (etiqueta o primer apellido y primer nombre). */
  nombre_tarjeta: string;
  cargo: string;
  /** Área acortada ("SOPORTE TÉCNICO"); vacío si depende directamente de la dirección. */
  area: string;
  /** "08:00 a 15:00" */
  horario: string;
  /** Sólo al mirar hoy: está dentro de su horario en un día hábil. null = no aplica. */
  en_horario: boolean | null;
  unidad_id: number;
  unidad: string;
  unidad_tipo: string;
  unidad_ruta: string;
  /** Dirección a la que pertenece (o la Dirección General si depende de ella). */
  direccion_id: number | null;
  direccion: string;
  modalidad_id: number;
  modalidad: string;
  trabajando: boolean;
  /** Cumple años el día consultado (sólo al mirar un día). */
  cumpleanios: boolean;
  novedades: NovedadResumen[];
}

/** Cantidad de agentes con cada artículo de licencia vigente. */
export interface ResumenArticulo {
  id: number;
  nombre: string;
  color: string;
  cantidad: number;
}

export interface EstadoPersonal {
  desde: string;
  hasta: string;
  es_un_dia: boolean;
  es_hoy: boolean;
  dia_habil: boolean;
  /** `inactivos`: sin licencias pero fuera de horario; null cuando no se mira el día de hoy. */
  resumen: { total: number; trabajando: number; inactivos: number | null; no_trabajando: number; por_tipo: ResumenArticulo[] };
  empleados: FilaEstado[];
  /** Columnas de la vista por dirección (Dirección General y sus direcciones), en orden. */
  grupos: { id: number; nombre: string; tipo: string }[];
  no_laborables: DiaNoLaborable[];
}

/** Intervalo de actualización automática del Inicio ("tiempo real"). */
const REFRESCO_MS = 60_000;

export function useEstadoPersonal(params: Params) {
  return useQuery({
    queryKey: ['dashboard', 'estado', params],
    queryFn: async () => (await api.get<EstadoPersonal>('/dashboard/estado/', { params: limpiarParams(params) })).data,
    refetchInterval: REFRESCO_MS,
    placeholderData: keepPreviousData,
  });
}

/** Sin licencias pero fuera de su horario (sólo al mirar el día de hoy). */
export const esInactivo = (fila: Pick<FilaEstado, 'trabajando' | 'en_horario'>) => fila.trabajando && fila.en_horario === false;
