import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { crearRecurso } from '@/core/api/crud';
import type { Catalogo, DiaNoLaborable } from '@/core/api/types';

export type TipoUnidad = 'DIRECCION_GENERAL' | 'DIRECCION' | 'AREA';

/** Niveles de la estructura, de mayor a menor (mismo orden que en el backend). */
export const TIPOS_UNIDAD: { value: TipoUnidad; label: string; color: string }[] = [
  { value: 'DIRECCION_GENERAL', label: 'Dirección General', color: 'geekblue' },
  { value: 'DIRECCION', label: 'Dirección', color: 'blue' },
  { value: 'AREA', label: 'Área', color: 'cyan' },
];

/** Unidad organizativa: Dirección General › Dirección › Área. */
export interface UnidadOrganizativa extends Catalogo {
  tipo: TipoUnidad;
  tipo_display: string;
  padre: number | null;
  padre_nombre: string | null;
  ruta: string;
}

/** Nodo del árbol de estructura (endpoint /organizacion/unidades/arbol/). */
export interface NodoUnidad {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: TipoUnidad;
  tipo_display: string;
  padre: number | null;
  orden: number;
  activo: boolean;
  ruta: string;
  /** Agentes activos asignados directamente a la unidad. */
  empleados: number;
  /** Incluye los de las unidades dependientes. */
  empleados_total: number;
  children: NodoUnidad[];
}

export interface Modalidad extends Catalogo {
  usa_dni_como_legajo: boolean;
  requiere_fecha_fin: boolean;
  color: string;
}

/** Artículo de licencia (TipoNovedad en el backend). */
export interface TipoNovedad extends Catalogo {
  /** Color con el que se muestra en el Inicio y el calendario. */
  color: string;
  computo_dias: 'HABILES' | 'CORRIDOS';
  computo_dias_display: string;
  descuenta_saldo: boolean;
  /** Tipo cuya bolsa de días usa (null = saldo propio). */
  saldo_de: number | null;
  saldo_de_nombre: string | null;
  /** Si es false, la bolsa no se muestra en fichas, saldos ni reportes. */
  mostrar_saldo: boolean;
  requiere_documentacion: boolean;
  permite_sin_fecha_fin: boolean;
}

export const unidadesApi = crearRecurso<UnidadOrganizativa>('organizacion/unidades');

export function useArbolUnidades(soloActivas = false) {
  return useQuery({
    queryKey: ['organizacion/unidades', 'arbol', soloActivas],
    queryFn: async () =>
      (await api.get<NodoUnidad[]>('/organizacion/unidades/arbol/', { params: soloActivas ? { activo: true } : {} })).data,
    staleTime: 60_000,
  });
}
export const modalidadesApi = crearRecurso<Modalidad>('organizacion/modalidades');
export const tiposNovedadApi = crearRecurso<TipoNovedad>('novedades/tipos');
export const noLaborablesApi = crearRecurso<DiaNoLaborable>('calendario/no-laborables');
