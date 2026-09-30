import { Link } from 'react-router-dom';
import { Alert, Empty, Modal, Spin, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import type { TipoNovedad } from '@/shared/api/catalogos';

interface UsoPorEmpleado {
  empleado_id: number;
  empleado: string;
  cantidad: number;
  dias: number;
  anuladas?: number;
}

interface Uso {
  movimientos: UsoPorEmpleado[];
  novedades: UsoPorEmpleado[];
  tipos_que_comparten_saldo: string[];
  anuladas: number;
  bloquea_eliminacion: boolean;
}

/**
 * Quiénes usan un artículo de licencia (días asignados y licencias registradas).
 * Es lo que impide eliminarlo; desde acá se llega a cada ficha o a los listados filtrados.
 */
export default function UsoTipoModal({ tipo, onClose }: { tipo: TipoNovedad | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['novedades/tipos', 'uso', tipo?.id],
    queryFn: async () => (await api.get<Uso>(`/novedades/tipos/${tipo!.id}/uso/`)).data,
    enabled: !!tipo,
  });
  const sinUso = data && !data.movimientos.length && !data.novedades.length && !data.tipos_que_comparten_saldo.length;
  const soloAnuladas = data && !sinUso && !data.bloquea_eliminacion;
  const columnaEmpleado = {
    title: 'Empleado',
    dataIndex: 'empleado',
    render: (t: string, r: UsoPorEmpleado) => (
      <Link to={`/personal/${r.empleado_id}`} onClick={onClose}>
        {t}
      </Link>
    ),
  };

  return (
    <Modal open={!!tipo} title={`Uso de "${tipo?.nombre ?? ''}"`} footer={null} onCancel={onClose} width={640} destroyOnHidden>
      <Spin spinning={isLoading}>
        {sinUso && <Empty description="No está en uso: puede eliminarse." />}
        {soloAnuladas && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
            message="Puede eliminarse."
            description={`Sólo tiene ${data!.anuladas} licencia(s) anulada(s), que se eliminarán junto con el artículo.`}
          />
        )}
        {!!data?.tipos_que_comparten_saldo.length && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Otros artículos usan su saldo: ${data.tipos_que_comparten_saldo.join(', ')}. Cámbielos antes de eliminarlo.`}
          />
        )}
        {!!data?.movimientos.length && (
          <>
            <Typography.Title level={5}>
              Días asignados{' '}
              <Link to={`/vacaciones?vista=movimientos&tipo=${tipo?.id}`} onClick={onClose} style={{ fontSize: 13, fontWeight: 400 }}>
                ver movimientos
              </Link>
            </Typography.Title>
            <Table
              size="small"
              rowKey="empleado_id"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              dataSource={data.movimientos}
              columns={[
                columnaEmpleado,
                { title: 'Movimientos', dataIndex: 'cantidad', align: 'right' },
                { title: 'Días', dataIndex: 'dias', align: 'right' },
              ]}
            />
          </>
        )}
        {!!data?.novedades.length && (
          <>
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              Licencias registradas{' '}
              <Link to={`/novedades?tipo=${tipo?.id}&situacion=todas`} onClick={onClose} style={{ fontSize: 13, fontWeight: 400 }}>
                ver licencias
              </Link>
            </Typography.Title>
            <Table
              size="small"
              rowKey="empleado_id"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              dataSource={data.novedades}
              columns={[
                columnaEmpleado,
                {
                  title: 'Licencias',
                  dataIndex: 'cantidad',
                  align: 'right',
                  render: (c: number, r: UsoPorEmpleado) => (r.anuladas ? `${c} (${r.anuladas} anuladas)` : c),
                },
                { title: 'Días', dataIndex: 'dias', align: 'right' },
              ]}
            />
          </>
        )}
        {data?.bloquea_eliminacion && data.anuladas > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="Las licencias anuladas no impiden eliminarlo (se borran junto con el tipo); sí lo impiden los días asignados y las licencias no anuladas."
          />
        )}
        {data?.bloquea_eliminacion && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            Mientras tenga datos asociados no se puede eliminar (se conservan por historial). Si ya no se usa, desactívelo o
            desmarque "Mostrar saldo" para ocultarlo de las vistas.
          </Typography.Paragraph>
        )}
      </Spin>
    </Modal>
  );
}
