import { documentosApi, type DocumentoNovedad } from '@/shared/api/novedades';
import { api } from '@/core/api/client';
import ListaDocumentos from './ListaDocumentos';

/** Documentación respaldatoria de una novedad (sólo visible con permiso). */
export default function DocumentosNovedad({ novedadId }: { novedadId: number }) {
  return (
    <ListaDocumentos
      fuente={{
        clave: ['novedades/documentos', novedadId],
        listar: async () => (await api.get<DocumentoNovedad[]>('/novedades/documentos/', { params: { novedad: novedadId } })).data,
        subir: (archivo) => documentosApi.subir(novedadId, archivo),
        eliminar: documentosApi.eliminar,
        urlDescarga: documentosApi.urlDescarga,
      }}
      permisos={{
        ver: 'novedades.view_documentonovedad',
        subir: 'novedades.add_documentonovedad',
        eliminar: 'novedades.delete_documentonovedad',
      }}
      textoVacio="Sin documentación adjunta"
      textoBoton="Adjuntar documentación"
    />
  );
}
