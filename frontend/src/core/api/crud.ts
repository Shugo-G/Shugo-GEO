import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { CambioHistorial, Paginado, Params } from './types';

/** Limpia parámetros vacíos y une arrays con coma (formato que espera el backend). */
export function limpiarParams(params: Params = {}): Record<string, string | number | boolean> {
  const salida: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    if (Array.isArray(valor)) {
      if (valor.length) salida[clave] = valor.join(',');
      return;
    }
    salida[clave] = valor;
  });
  return salida;
}

/**
 * Fábrica de API + hooks para un recurso REST estándar (ModelViewSet).
 * Uso: export const modalidadesApi = crearRecurso<Modalidad>('organizacion/modalidades');
 */
export function crearRecurso<T extends { id: number }, TInput = Partial<T>>(ruta: string) {
  const base = `/${ruta.replace(/^\/|\/$/g, '')}/`;
  const claveBase = [ruta] as const;

  const listar = async (params?: Params) => (await api.get<Paginado<T>>(base, { params: limpiarParams(params) })).data;
  const todos = async (params?: Params) =>
    (await api.get<T[]>(base, { params: limpiarParams({ page_size: 0, ...params }) })).data;
  const obtener = async (id: number) => (await api.get<T>(`${base}${id}/`)).data;
  const crear = async (datos: TInput) => (await api.post<T>(base, datos)).data;
  const actualizar = async ({ id, ...datos }: TInput & { id: number }) => (await api.patch<T>(`${base}${id}/`, datos)).data;
  const eliminar = async (id: number) => {
    await api.delete(`${base}${id}/`);
  };
  const historial = async (id: number) => (await api.get<CambioHistorial[]>(`${base}${id}/historial/`)).data;

  return {
    ruta: base,
    clave: claveBase,
    listar,
    todos,
    obtener,
    crear,
    actualizar,
    eliminar,
    historial,

    useLista: (params?: Params, enabled = true) =>
      useQuery({ queryKey: [...claveBase, 'lista', params], queryFn: () => listar(params), placeholderData: keepPreviousData, enabled }),
    useTodos: (params?: Params, enabled = true) =>
      useQuery({ queryKey: [...claveBase, 'todos', params], queryFn: () => todos(params), staleTime: 60_000, enabled }),
    useDetalle: (id?: number) =>
      useQuery({ queryKey: [...claveBase, 'detalle', id], queryFn: () => obtener(id!), enabled: !!id }),
    useHistorial: (id?: number, enabled = true) =>
      useQuery({ queryKey: [...claveBase, 'historial', id], queryFn: () => historial(id!), enabled: !!id && enabled }),

    useGuardar: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (datos: TInput & { id?: number }) =>
          datos.id ? actualizar(datos as TInput & { id: number }) : crear(datos),
        onSuccess: () => qc.invalidateQueries(),
      });
    },
    useEliminar: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: eliminar, onSuccess: () => qc.invalidateQueries() });
    },
  };
}
