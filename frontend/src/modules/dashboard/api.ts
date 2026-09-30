import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import type { DiaNoLaborable, NovedadResumen, Params } from '@/core/api/types';

export interface FilaEstado {
  id: number;
  legajo: string;
  nombre: string;
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
  dia_habil: boolean;
  resumen: { total: number; trabajando: number; no_trabajando: number; por_tipo: ResumenArticulo[] };
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
