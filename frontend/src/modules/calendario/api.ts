import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import type { DiaNoLaborable, Params } from '@/core/api/types';

export interface EventoNovedad {
  id: number;
  empleado_id: number;
  empleado: string;
  foto_url: string | null;
  unidad: string;
  tipo: string;
  categoria_id: number;
  categoria: string;
  cuenta_como_presente: boolean;
  color: string;
  desde: string;
  hasta: string | null;
  abierta: boolean;
  motivo: string;
}

export interface RespuestaEventos {
  desde: string;
  hasta: string;
  total_empleados: number;
  novedades: EventoNovedad[];
  no_laborables: DiaNoLaborable[];
}

export function useEventosCalendario(params: Params, enabled: boolean) {
  return useQuery({
    queryKey: ['calendario', params],
    queryFn: async () => (await api.get<RespuestaEventos>('/calendario/eventos/', { params: limpiarParams(params) })).data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
