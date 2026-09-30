import { crearRecurso } from '@/core/api/crud';
import type { Catalogo } from '@/core/api/types';

export interface LineaMovil {
  id: number;
  numero: string;
  numero_sim: string;
  tipo_sim: number | null;
  tipo_sim_nombre: string | null;
  proveedor: number;
  proveedor_nombre: string;
  estado: number;
  estado_nombre: string;
  /** Texto libre: puede ser alguien ajeno a Informática. */
  responsable: string;
  area: string;
  secretaria: string;
  descripcion: string;
}

export interface ServicioInternet {
  id: number;
  sitio: string;
  direccion: string;
  proveedor: number;
  proveedor_nombre: string;
  numero_cliente: string;
  numero_fsan: string;
  velocidad: string;
  ip_publica: string;
}

export const proveedoresApi = crearRecurso<Catalogo>('servicios/proveedores');
export const tiposSimApi = crearRecurso<Catalogo>('servicios/tipos-sim');
export const estadosLineaApi = crearRecurso<Catalogo>('servicios/estados-linea');
export const lineasApi = crearRecurso<LineaMovil>('servicios/lineas');
export const internetApi = crearRecurso<ServicioInternet>('servicios/internet');
