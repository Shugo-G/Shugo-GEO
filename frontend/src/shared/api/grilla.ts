import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import type { Params } from '@/core/api/types';

/** Grilla agente × día (endpoint /dashboard/grilla/). La usan el dashboard y el calendario. */
export interface DiaGrilla {
  fecha: string;
  fin_de_semana: boolean;
  no_laborable: { tipo: string; motivo: string } | null;
  trabajando: number;
}

export interface CeldaGrilla {
  novedad_id: number;
  tipo: string;
  color: string;
  categoria_id: number;
}

export interface FilaGrilla {
  id: number;
  nombre: string;
  foto_url: string | null;
  unidad: string;
  celdas: Record<string, CeldaGrilla[]>;
}

export interface Grilla {
  desde: string;
  hasta: string;
  dias: DiaGrilla[];
  empleados: FilaGrilla[];
}

export function useGrilla(params: Params, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'grilla', params],
    queryFn: async () => (await api.get<Grilla>('/dashboard/grilla/', { params: limpiarParams(params) })).data,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    enabled,
  });
}
