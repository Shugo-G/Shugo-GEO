import { App, Button, List, Popconfirm, Typography, Upload } from 'antd';
import { DeleteOutlined, DownloadOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import { descargarArchivo } from '@/core/utils/descargar';
import { fmtFechaHora, fmtTamanio } from '@/core/utils/format';
import { documentosApi, type DocumentoNovedad } from '@/shared/api/novedades';

/** Documentación respaldatoria de una novedad (sólo visible con permiso). */
export default function DocumentosNovedad({ novedadId }: { novedadId: number }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const puedeVer = usePermiso('novedades.view_documentonovedad');
  const puedeSubir = usePermiso('novedades.add_documentonovedad');
  const puedeEliminar = usePermiso('novedades.delete_documentonovedad');

  const { data = [], isLoading } = useQuery({
    queryKey: ['novedades/documentos', novedadId],
    queryFn: async () => (await api.get<DocumentoNovedad[]>('/novedades/documentos/', { params: { novedad: novedadId } })).data,
    enabled: puedeVer,
  });

  if (!puedeVer) return null;
  const refrescar = () => qc.invalidateQueries();

  return (
    <div>
      <List
        size="small"
        loading={isLoading}
        locale={{ emptyText: 'Sin documentación adjunta' }}
        dataSource={data}
        renderItem={(doc) => (
          <List.Item
            actions={[
              <Button
                key="d"
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => descargarArchivo(documentosApi.urlDescarga(doc.id), undefined, doc.nombre_original)}
              />,
              puedeEliminar && (
                <Popconfirm
                  key="e"
                  title="¿Eliminar el documento?"
                  onConfirm={async () => {
                    await documentosApi.eliminar(doc.id);
                    refrescar();
                  }}
                >
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            ].filter(Boolean)}
          >
            <List.Item.Meta
              avatar={<PaperClipOutlined />}
              title={doc.nombre_original}
              description={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {fmtTamanio(doc.tamanio)} · {fmtFechaHora(doc.subido)} · {doc.subido_por_nombre ?? ''}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
      {puedeSubir && (
        <Upload
          multiple
          showUploadList={false}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.odt"
          customRequest={async ({ file, onSuccess, onError }) => {
            try {
              await documentosApi.subir(novedadId, file as File);
              message.success(`${(file as File).name} adjuntado`);
              onSuccess?.({});
              refrescar();
            } catch (e) {
              message.error(mensajeError(e));
              onError?.(e as Error);
            }
          }}
        >
          <Button icon={<UploadOutlined />} style={{ marginTop: 8 }}>
            Adjuntar documentación
          </Button>
        </Upload>
      )}
    </div>
  );
}
