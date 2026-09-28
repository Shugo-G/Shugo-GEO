import { App, Button, List, Popconfirm, Typography, Upload, type UploadFile } from 'antd';
import { useState } from 'react';
import { DeleteOutlined, DownloadOutlined, EyeOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mensajeError } from '@/core/api/client';
import { FORMATOS_ADJUNTO, type DocumentoAdjunto } from '@/core/api/types';
import { usePermiso } from '@/core/auth/AuthContext';
import VisorArchivo, { esPrevisualizable } from '@/core/components/VisorArchivo';
import { descargarArchivo } from '@/core/utils/descargar';
import { fmtFechaHora, fmtTamanio } from '@/core/utils/format';

/** Cómo acceder a los archivos de un registro (novedad, cargo patrimonial...). */
export interface FuenteDocumentos {
  clave: readonly unknown[];
  listar: () => Promise<DocumentoAdjunto[]>;
  subir: (archivo: File) => Promise<unknown>;
  eliminar: (id: number) => Promise<unknown>;
  urlDescarga: (id: number) => string;
}

interface Props {
  fuente: FuenteDocumentos;
  /** Permisos "app.codename" para ver, subir y eliminar. */
  permisos: { ver: string; subir: string; eliminar: string };
  textoVacio?: string;
  textoBoton?: string;
}

/** Lista de archivos de un registro con descarga autenticada, subida y eliminación según permisos. */
export default function ListaDocumentos({ fuente, permisos, textoVacio = 'Sin archivos adjuntos', textoBoton = 'Adjuntar archivos' }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const puedeVer = usePermiso(permisos.ver);
  const puedeSubir = usePermiso(permisos.subir);
  const puedeEliminar = usePermiso(permisos.eliminar);

  const { data = [], isLoading } = useQuery({ queryKey: fuente.clave, queryFn: fuente.listar, enabled: puedeVer });
  const [visible, setVisible] = useState<number | null>(null);
  // El visor recorre sólo los archivos que puede mostrar (imágenes y PDF).
  const visibles = data.filter((d) => esPrevisualizable(d.nombre_original));
  const ver = (doc: DocumentoAdjunto) => setVisible(visibles.findIndex((d) => d.id === doc.id));

  if (!puedeVer) return null;
  const refrescar = () => qc.invalidateQueries();

  return (
    <div>
      <List
        size="small"
        loading={isLoading}
        locale={{ emptyText: textoVacio }}
        dataSource={data}
        renderItem={(doc) => (
          <List.Item
            actions={[
              esPrevisualizable(doc.nombre_original) && (
                <Button key="v" type="link" size="small" icon={<EyeOutlined />} title="Ver" onClick={() => ver(doc)} />
              ),
              <Button
                key="d"
                title="Descargar"
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => descargarArchivo(fuente.urlDescarga(doc.id), undefined, doc.nombre_original)}
              />,
              puedeEliminar && (
                <Popconfirm
                  key="e"
                  title="¿Eliminar el archivo?"
                  onConfirm={async () => {
                    await fuente.eliminar(doc.id);
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
              title={
                esPrevisualizable(doc.nombre_original) ? (
                  <Typography.Link onClick={() => ver(doc)}>{doc.nombre_original}</Typography.Link>
                ) : (
                  doc.nombre_original
                )
              }
              description={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {fmtTamanio(doc.tamanio)} · {fmtFechaHora(doc.subido)} · {doc.subido_por_nombre ?? ''}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
      <VisorArchivo
        archivos={visibles.map((d) => ({ url: fuente.urlDescarga(d.id), nombre: d.nombre_original }))}
        indice={visible}
        onCambiar={setVisible}
      />
      {puedeSubir && (
        <Upload
          multiple
          showUploadList={false}
          accept={FORMATOS_ADJUNTO}
          customRequest={async ({ file, onSuccess, onError }) => {
            try {
              await fuente.subir(file as File);
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
            {textoBoton}
          </Button>
        </Upload>
      )}
    </div>
  );
}

/**
 * Archivos elegidos en un formulario antes de que exista el registro
 * (se suben después de guardarlo con `subirPendientes`).
 */
export function AdjuntosPendientes({ value = [], onChange, texto = 'Adjuntar archivos' }: {
  value?: UploadFile[];
  onChange?: (archivos: UploadFile[]) => void;
  texto?: string;
}) {
  return (
    <Upload multiple accept={FORMATOS_ADJUNTO} fileList={value} beforeUpload={() => false} onChange={({ fileList }) => onChange?.(fileList)}>
      <Button icon={<PaperClipOutlined />}>{texto}</Button>
    </Upload>
  );
}

/** Sube los archivos pendientes uno por uno. Devuelve los nombres de los que fallaron. */
export async function subirPendientes(archivos: UploadFile[], subir: (archivo: File) => Promise<unknown>): Promise<string[]> {
  const fallidos: string[] = [];
  for (const archivo of archivos) {
    try {
      await subir(archivo.originFileObj as File);
    } catch {
      fallidos.push(archivo.name);
    }
  }
  return fallidos;
}
