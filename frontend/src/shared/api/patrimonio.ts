import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { crearRecurso, limpiarParams } from '@/core/api/crud';
import type { Catalogo, DocumentoAdjunto, Params } from '@/core/api/types';

export type TipoInsumo = Catalogo;

export type TipoCierre = 'BAJA' | 'TRANSFERENCIA_EMPLEADO' | 'TRANSFERENCIA_EXTERNA';

/** Período en que un bien estuvo (o está) a cargo de un agente. */
export interface CargoPatrimonial {
  id: number;
  empleado: number;
  empleado_nombre: string;
  /** Legajo del agente al momento de la asignación. */
  legajo: string;
  unidad_nombre: string;
  tipo_insumo: number;
  tipo_insumo_nombre: string;
  planilla_cargo: string;
  iub: string;
  descripcion: string;
  fecha_asignacion: string;
  vigente: boolean;
  fecha_cierre: string | null;
  tipo_cierre: TipoCierre | '';
  tipo_cierre_display: string;
  destino: string;
  motivo_cierre: string;
  /** Cargo abierto para el receptor en una transferencia a otro empleado. */
  transferido_a: number | null;
  documentos_count: number;
  creado: string;
  creado_por_nombre: string | null;
}

export const insumosApi = crearRecurso<TipoInsumo>('patrimonio/insumos');
export const cargosApi = crearRecurso<CargoPatrimonial>('patrimonio/cargos');

/** El insumo queda fuera de servicio (su IUB no puede volver a asignarse). */
export const darDeBajaCargo = async (id: number, datos: { fecha: string; motivo: string }) =>
  (await api.post<CargoPatrimonial>(`/patrimonio/cargos/${id}/dar-de-baja/`, datos)).data;

/**
 * A otro empleado (`empleado` + `planilla_cargo` nueva y distinta; el IUB se mantiene)
 * o a un área ajena a Informática (`area_externa`).
 */
export const transferirCargo = async (
  id: number,
  datos: { fecha: string; motivo: string; empleado?: number; area_externa?: string; planilla_cargo?: string },
) => (await api.post<CargoPatrimonial>(`/patrimonio/cargos/${id}/transferir/`, datos)).data;

export interface ResumenPatrimonio {
  total: number;
  por_insumo: { id: number; nombre: string; cantidad: number }[];
}

export function useResumenPatrimonio(params: Params) {
  return useQuery({
    queryKey: ['patrimonio/cargos', 'resumen', params],
    queryFn: async () =>
      (await api.get<ResumenPatrimonio>('/patrimonio/cargos/resumen/', { params: limpiarParams(params) })).data,
  });
}

export interface DocumentoCargo extends DocumentoAdjunto {
  cargo: number;
}

/** Archivos de un cargo: planilla de cargo firmada, actas de transferencia o baja. */
export const documentosCargoApi = {
  listar: async (cargo: number) =>
    (await api.get<DocumentoCargo[]>('/patrimonio/documentos/', { params: { cargo } })).data,
  subir: async (cargo: number, archivo: File, descripcion = '') => {
    const datos = new FormData();
    datos.append('cargo', String(cargo));
    datos.append('archivo', archivo);
    datos.append('descripcion', descripcion);
    return (await api.post<DocumentoCargo>('/patrimonio/documentos/', datos)).data;
  },
  eliminar: async (id: number) => api.delete(`/patrimonio/documentos/${id}/`),
  urlDescarga: (id: number) => `/patrimonio/documentos/${id}/descargar/`,
};
