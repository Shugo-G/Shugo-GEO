import { App, Badge, Button, Card, Checkbox, Empty, Popover, Space, Table, Tooltip, Typography, type TableColumnsType } from 'antd';
import { EyeOutlined, UndoOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import { guardarPreferenciaSaldo } from '@/shared/api/saldos';
import type { Saldo } from '@/core/api/types';
import { Can } from '@/core/auth/guards';
import { COLOR_ACTIVO } from '@/app/theme';

interface Props {
  empleadoId: number;
  saldos: Saldo[];
  onCompensar: () => void;
}

type Fila =
  | { clave: string; clase: 'bolsa'; saldo: Saldo }
  | { clave: string; clase: 'subtotal' | 'total'; titulo: string; valores: Totales };

type Totales = Pick<Saldo, 'acreditados' | 'usados' | 'programados' | 'disponible'>;

const sumar = (saldos: Saldo[]): Totales => ({
  acreditados: saldos.reduce((t, s) => t + s.acreditados, 0),
  usados: saldos.reduce((t, s) => t + s.usados, 0),
  programados: saldos.reduce((t, s) => t + s.programados, 0),
  disponible: saldos.reduce((t, s) => t + s.disponible, 0),
});

const valores = (f: Fila): Totales => (f.clase === 'bolsa' ? f.saldo : f.valores);

function Disponible({ valor, fuerte }: { valor: number; fuerte?: boolean }) {
  return (
    <Typography.Text strong style={{ color: valor < 0 ? '#f5222d' : valor > 0 ? COLOR_ACTIVO : undefined, fontSize: fuerte ? 16 : undefined }}>
      {valor}
    </Typography.Text>
  );
}

/** Lista de bolsas con casillas para elegir cuáles se muestran en la ficha. */
function ElegirVisibles({ empleadoId, saldos }: { empleadoId: number; saldos: Saldo[] }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const cambiar = async (s: Saldo, visible: boolean | null) => {
    try {
      await guardarPreferenciaSaldo(empleadoId, s.tipo_id, visible);
      qc.invalidateQueries();
    } catch (e) {
      message.error(mensajeError(e));
    }
  };
  return (
    <Space direction="vertical" size={4} style={{ minWidth: 280 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Marque las bolsas a mostrar. El total suma sólo las visibles.
      </Typography.Text>
      {saldos.map((s) => (
        <div key={s.tipo_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Checkbox checked={s.visible} onChange={(e) => cambiar(s, e.target.checked)}>
            <Badge color={s.color} text={s.tipo} />{' '}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ({s.disponible} disp.)
            </Typography.Text>
          </Checkbox>
          {s.eleccion_manual && (
            <Tooltip title="Volver a la regla automática (visible si tiene movimientos)">
              <Button type="text" size="small" icon={<UndoOutlined />} onClick={() => cambiar(s, null)} />
            </Tooltip>
          )}
        </div>
      ))}
    </Space>
  );
}

/**
 * Saldos del agente en una sola tabla: una fila por bolsa de días, subtotal por
 * categoría (p. ej. todas las licencias de vacaciones, de cualquier año) y total
 * general. Qué bolsas se ven se elige por agente; sin elección, se muestran las
 * que tienen movimientos (y no están marcadas "no mostrar saldo" en el tipo).
 */
export default function SaldosEmpleado({ empleadoId, saldos, onCompensar }: Props) {
  const puedeElegir = usePermiso('personal.change_empleado');
  const visibles = saldos.filter((s) => s.visible);
  const ocultas = saldos.length - visibles.length;

  // Agrupar por categoría, respetando el orden en que llegan.
  const grupos = new Map<number, Saldo[]>();
  visibles.forEach((s) => grupos.set(s.categoria_id, [...(grupos.get(s.categoria_id) ?? []), s]));

  const filas: Fila[] = [];
  grupos.forEach((grupo) => {
    grupo.forEach((s) => filas.push({ clave: `b${s.tipo_id}`, clase: 'bolsa', saldo: s }));
    if (grupo.length > 1) {
      filas.push({ clave: `c${grupo[0].categoria_id}`, clase: 'subtotal', titulo: `Total ${grupo[0].categoria}`, valores: sumar(grupo) });
    }
  });
  if (visibles.length > 1) filas.push({ clave: 'total', clase: 'total', titulo: 'TOTAL', valores: sumar(visibles) });

  const columnas: TableColumnsType<Fila> = [
    {
      title: 'Licencia',
      key: 'licencia',
      render: (_, f) =>
        f.clase === 'bolsa' ? (
          <>
            <Badge color={f.saldo.color} text={f.saldo.tipo} />
            {f.saldo.incluye.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 14 }}>
                  incluye {f.saldo.incluye.join(', ')}
                </Typography.Text>
              </div>
            )}
          </>
        ) : (
          <Typography.Text strong>{f.titulo}</Typography.Text>
        ),
    },
    { title: <Tooltip title="Acreditados">Acred.</Tooltip>, key: 'acreditados', align: 'right', width: 62, render: (_, f) => valores(f).acreditados },
    { title: <Tooltip title="Utilizados">Usados</Tooltip>, key: 'usados', align: 'right', width: 64, render: (_, f) => valores(f).usados },
    { title: <Tooltip title="Programados (licencias futuras ya registradas)">Prog.</Tooltip>, key: 'programados', align: 'right', width: 54, render: (_, f) => valores(f).programados },
    {
      title: <Tooltip title="Disponibles">Disp.</Tooltip>,
      width: 58,
      key: 'disponible',
      align: 'right',
      render: (_, f) => <Disponible valor={valores(f).disponible} fuerte={f.clase === 'total'} />,
    },
  ];

  return (
    <Card
      title="Saldos de licencias"
      size="small"
      style={{ marginBottom: 16 }}
      extra={
        <Space size={0}>
          {puedeElegir && saldos.length > 0 && (
            <Popover trigger="click" placement="bottomRight" title="Bolsas visibles" content={<ElegirVisibles empleadoId={empleadoId} saldos={saldos} />}>
              <Button size="small" type="link" icon={<EyeOutlined />}>
                Elegir visibles
              </Button>
            </Popover>
          )}
          <Can permiso="vacaciones.add_movimientosaldo">
            <Button size="small" type="link" onClick={onCompensar}>
              + Compensar día trabajado
            </Button>
          </Can>
        </Space>
      }
    >
      {filas.length ? (
        <Table
          rowKey="clave"
          size="small"
          pagination={false}
          columns={columnas}
          dataSource={filas}
          rowClassName={(f) => `saldo-fila-${f.clase}`}
          className="tabla-saldos"
          expandable={{
            rowExpandable: (f) => f.clase === 'bolsa',
            expandedRowRender: (f) =>
              f.clase === 'bolsa' && (
                <>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Asignados {f.saldo.asignados} · Compensaciones {f.saldo.compensados} · Ajustes {f.saldo.ajustes}
                  </Typography.Text>
                  {f.saldo.incluye.length > 0 && (
                    <Table
                      size="small"
                      rowKey="tipo_id"
                      pagination={false}
                      style={{ marginTop: 6 }}
                      dataSource={f.saldo.desglose}
                      columns={[
                        { title: 'Por tipo', dataIndex: 'tipo' },
                        { title: 'Acreditados', dataIndex: 'acreditados', align: 'right' },
                        { title: 'Utilizados', dataIndex: 'usados', align: 'right' },
                        { title: 'Programados', dataIndex: 'programados', align: 'right' },
                      ]}
                    />
                  )}
                </>
              ),
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay bolsas visibles" />
      )}
      {ocultas > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          {ocultas} bolsa(s) oculta(s){puedeElegir ? ' · use "Elegir visibles" para mostrarlas' : ''}
        </Typography.Text>
      )}
    </Card>
  );
}
