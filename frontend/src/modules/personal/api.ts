import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import type { NovedadResumen, Saldo } from '@/core/api/types';
import type { Empleado } from '@/shared/api/empleados';

export interface ResumenHistorial {
  tipo_id: number;
  tipo: string;
  color: string;
  cantidad: number;
  dias: number;
  cantidad_anio: number;
  dias_anio: number;
}

export interface Ficha {
  empleado: Empleado;
  situacion_actual: { fecha: string; trabajando: boolean; novedades: NovedadResumen[] };
  proximas: NovedadResumen[];
  saldos: Saldo[];
  resumen_historial: ResumenHistorial[];
}

export function useFicha(id: number) {
  return useQuery({
    queryKey: ['personal/empleados', 'ficha', id],
    queryFn: async () => (await api.get<Ficha>(`/personal/empleados/${id}/ficha/`)).data,
  });
}
