import { api } from '@/core/api/client';
import { crearRecurso } from '@/core/api/crud';

export type SituacionRevista = 'ACTIVO' | 'SUSPENDIDO' | 'BAJA';

export interface Empleado {
  id: number;
  apellido: string;
  nombre: string;
  nombre_completo: string;
  dni: string;
  legajo: string;
  fecha_nacimiento: string | null;
  foto_url: string | null;
  unidad: number;
  unidad_nombre: string;
  unidad_tipo: string;
  /** Ruta completa, p. ej. "Dirección de Infraestructura › Soporte técnico". */
  unidad_ruta: string;
  puesto: number | null;
  puesto_nombre: string | null;
  modalidad: number;
  modalidad_nombre: string;
  fecha_ingreso: string;
  fecha_fin_contrato: string | null;
  telefono: string;
  email: string;
  situacion_revista: SituacionRevista;
  situacion_revista_display: string;
  fecha_baja: string | null;
  observaciones: string;
}

export const SITUACIONES: { value: SituacionRevista; label: string; color: string }[] = [
  { value: 'ACTIVO', label: 'Activo', color: 'green' },
  { value: 'SUSPENDIDO', label: 'Suspendido', color: 'orange' },
  { value: 'BAJA', label: 'Baja', color: 'default' },
];

export const empleadosApi = crearRecurso<Empleado>('personal/empleados');

export const fotoEmpleadoApi = {
  subir: async (id: number, archivo: File) => {
    const datos = new FormData();
    datos.append('foto', archivo);
    return (await api.post<Empleado>(`/personal/empleados/${id}/foto/`, datos)).data;
  },
  quitar: async (id: number) => (await api.delete<Empleado>(`/personal/empleados/${id}/foto/`)).data,
};
