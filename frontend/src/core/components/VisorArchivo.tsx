import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Modal, Space, Spin, Typography } from 'antd';
import { DownloadOutlined, ExportOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { mensajeError } from '@/core/api/client';
import { descargarArchivo, obtenerArchivo } from '@/core/utils/descargar';

export interface ArchivoVisible {
  /** Endpoint de descarga autenticada (p. ej. /novedades/documentos/5/descargar/). */
  url: string;
  nombre: string;
}

const TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

const extension = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? '';

/** true si el visor puede mostrar el archivo (imágenes y PDF). */
export const esPrevisualizable = (nombre: string) => extension(nombre) in TIPOS;

interface Props {
  /** Archivos navegables (los de un mismo registro); `null` cierra el visor. */
  archivos: ArchivoVisible[];
  indice: number | null;
  onCambiar: (indice: number | null) => void;
}

/**
 * Vista previa de imágenes y PDF sin descargarlos. El archivo se pide con el
 * token de la sesión y se muestra desde memoria (blob): nunca queda una URL pública.
 */
export default function VisorArchivo({ archivos, indice, onCambiar }: Props) {
  const actual = indice !== null ? archivos[indice] : undefined;
  const [blobUrl, setBlobUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);

  const url = actual?.url;
  const nombre = actual?.nombre ?? '';

  useEffect(() => {
    if (!url || !esPrevisualizable(nombre)) return;
    let cancelado = false;
    let creada: string | undefined;
    setCargando(true);
    setError(undefined);
    setBlobUrl(undefined);
    obtenerArchivo(url)
      .then(({ blob }) => {
        if (cancelado) return;
        // El tipo se fija por la extensión para que el navegador muestre el PDF en lugar de descargarlo.
        creada = URL.createObjectURL(new Blob([blob], { type: TIPOS[extension(nombre)] }));
        setBlobUrl(creada);
      })
      .catch((e) => !cancelado && setError(mensajeError(e, 'No se pudo abrir el archivo.')))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [url, nombre]);

  // Flechas del teclado para recorrer los archivos.
  useEffect(() => {
    if (indice === null) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && indice > 0) onCambiar(indice - 1);
      if (e.key === 'ArrowRight' && indice < archivos.length - 1) onCambiar(indice + 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [indice, archivos.length, onCambiar]);

  const esPdf = actual && extension(actual.nombre) === 'pdf';

  const contenido = () => {
    if (!actual) return null;
    if (!esPrevisualizable(actual.nombre))
      return <Empty description="Vista previa no disponible para este formato: descárguelo para abrirlo." />;
    if (cargando) return <Spin size="large" />;
    if (error) return <Alert type="error" showIcon message={error} />;
    if (!blobUrl) return null;
    return esPdf ? (
      <iframe src={blobUrl} title={actual.nombre} className="visor-pdf" />
    ) : (
      <img src={blobUrl} alt={actual.nombre} className="visor-imagen" />
    );
  };

  return (
    <Modal
      open={!!actual}
      onCancel={() => onCambiar(null)}
      width="min(1100px, 96vw)"
      centered
      destroyOnHidden
      title={
        <Typography.Text ellipsis style={{ maxWidth: '70%' }}>
          {actual?.nombre}
          {archivos.length > 1 && indice !== null && (
            <Typography.Text type="secondary" style={{ fontWeight: 'normal', marginLeft: 8 }}>
              {indice + 1} de {archivos.length}
            </Typography.Text>
          )}
        </Typography.Text>
      }
      footer={
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<LeftOutlined />} disabled={!indice} onClick={() => onCambiar(indice! - 1)}>
              Anterior
            </Button>
            <Button disabled={indice === null || indice >= archivos.length - 1} onClick={() => onCambiar(indice! + 1)}>
              Siguiente <RightOutlined />
            </Button>
          </Space>
          <Space>
            {blobUrl && (
              <Button icon={<ExportOutlined />} onClick={() => window.open(blobUrl, '_blank', 'noopener')}>
                Abrir en otra pestaña
              </Button>
            )}
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => actual && descargarArchivo(actual.url, undefined, actual.nombre)}>
              Descargar
            </Button>
          </Space>
        </Space>
      }
    >
      <div className="visor-archivo">{contenido()}</div>
    </Modal>
  );
}
