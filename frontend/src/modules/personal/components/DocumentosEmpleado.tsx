import { PERMISOS_DOCUMENTOS_EMPLEADO, documentosEmpleadoApi } from '@/shared/api/empleados';
import ListaDocumentos from '@/shared/components/ListaDocumentos';

/** Adjuntos del acto administrativo del cargo de un agente. */
export default function DocumentosEmpleado({ empleadoId }: { empleadoId: number }) {
  return (
    <ListaDocumentos
      fuente={{
        clave: ['personal/documentos', empleadoId],
        listar: () => documentosEmpleadoApi.listar(empleadoId),
        subir: (archivo) => documentosEmpleadoApi.subir(empleadoId, archivo),
        eliminar: documentosEmpleadoApi.eliminar,
        urlDescarga: documentosEmpleadoApi.urlDescarga,
      }}
      permisos={PERMISOS_DOCUMENTOS_EMPLEADO}
      textoVacio="Sin adjuntos: puede subir el acto administrativo del cargo."
      textoBoton="Adjuntar acto administrativo"
    />
  );
}
