import { useState } from 'react';
import { Link } from 'react-router-dom';
import { App, Button, Popconfirm, Space, Table, Tag, Tooltip, Typography, type TableColumnsType, type TableProps } from 'antd';
import { DeleteOutlined, EditOutlined, PaperClipOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import { mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import { fmtFecha } from '@/core/utils/format';
import { cargosApi, type CargoPatrimonial } from '@/shared/api/patrimonio';
import CargoFormModal from './CargoFormModal';
import CierreCargoModal, { type AccionCierre } from './CierreCargoModal';
import { DocumentosCargoModal, PERMISOS_DOCUMENTOS_CARGO } from './DocumentosCargo';

interface Props extends Pick<TableProps<CargoPatrimonial>, 'loading' | 'pagination' | 'onChange'> {
  cargos: CargoPatrimonial[];
  /** Muestra responsable, legajo y unidad (vista general). En la ficha no hace falta. */
  mostrarResponsable?: boolean;
}

/** Estado del cargo: a cargo o cómo se cerró (con destino). */
export function EstadoCargo({ cargo }: { cargo: CargoPatrimonial }) {
  if (cargo.vigente) return <Tag color="green" bordered={false}>A cargo</Tag>;
  const color = cargo.tipo_cierre === 'BAJA' ? 'red' : cargo.tipo_cierre === 'TRANSFERENCIA_EXTERNA' ? 'purple' : 'blue';
  return (
    <Tooltip title={[cargo.motivo_cierre, `Cierre: ${fmtFecha(cargo.fecha_cierre)}`].filter(Boolean).join(' · ')}>
      <span>
        <Tag color={color} bordered={false}>
          {cargo.tipo_cierre_display}
        </Tag>
        {cargo.destino && <Typography.Text type="secondary" style={{ fontSize: 12 }}>→ {cargo.destino}</Typography.Text>}
      </span>
    </Tooltip>
  );
}

/** Tabla de cargos patrimoniales con sus acciones (editar, transferir, dar de baja, eliminar). */
export default function TablaCargos({ cargos, mostrarResponsable = false, ...tabla }: Props) {
  const { message } = App.useApp();
  const puedeEditar = usePermiso('patrimonio.change_cargopatrimonial');
  const puedeEliminar = usePermiso('patrimonio.delete_cargopatrimonial');
  const puedeVerArchivos = usePermiso(PERMISOS_DOCUMENTOS_CARGO.ver);
  const [archivos, setArchivos] = useState<CargoPatrimonial | null>(null);
  const eliminar = cargosApi.useEliminar();
  const [editando, setEditando] = useState<CargoPatrimonial | null>(null);
  const [cierre, setCierre] = useState<{ cargo: CargoPatrimonial | null; accion: AccionCierre }>({ cargo: null, accion: 'baja' });

  const columnas: TableColumnsType<CargoPatrimonial> = [
    { title: 'Insumo', dataIndex: 'tipo_insumo_nombre', key: 'tipo_insumo__nombre', sorter: mostrarResponsable, width: 150 },
    { title: 'IUB', dataIndex: 'iub', key: 'iub', sorter: mostrarResponsable, width: 120, render: (v) => v || '—' },
    { title: 'Planilla', dataIndex: 'planilla_cargo', width: 120, render: (v) => v || '—' },
    { title: 'Descripción', dataIndex: 'descripcion', ellipsis: { showTitle: true } },
    ...(mostrarResponsable
      ? ([
          {
            title: 'Responsable',
            dataIndex: 'empleado_nombre',
            key: 'empleado__apellido',
            sorter: true,
            width: 210,
            render: (t: string, c: CargoPatrimonial) => (
              <>
                <Link to={`/personal/${c.empleado}`}>{t}</Link>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Legajo {c.legajo} · {c.unidad_nombre}
                  </Typography.Text>
                </div>
              </>
            ),
          },
        ] as TableColumnsType<CargoPatrimonial>)
      : ([{ title: 'Legajo', dataIndex: 'legajo', width: 90 }] as TableColumnsType<CargoPatrimonial>)),
    { title: 'Asignado', dataIndex: 'fecha_asignacion', key: 'fecha_asignacion', sorter: mostrarResponsable, width: 105, render: fmtFecha },
    { title: 'Estado', key: 'estado', width: 220, render: (_, c) => <EstadoCargo cargo={c} /> },
    ...(puedeVerArchivos
      ? ([
          {
            title: 'Archivos',
            key: 'archivos',
            width: 90,
            align: 'center',
            render: (_: unknown, c: CargoPatrimonial) => (
              <Tooltip title={c.documentos_count ? 'Ver archivos' : 'Sin archivos: adjuntar la planilla'}>
                <Button
                  type={c.documentos_count ? 'link' : 'text'}
                  size="small"
                  icon={<PaperClipOutlined />}
                  onClick={() => setArchivos(c)}
                  style={c.documentos_count ? undefined : { color: 'var(--ant-color-text-quaternary, #bfbfbf)' }}
                >
                  {c.documentos_count || ''}
                </Button>
              </Tooltip>
            ),
          },
        ] as TableColumnsType<CargoPatrimonial>)
      : []),
    {
      key: 'acciones',
      width: 130,
      fixed: 'right',
      render: (_, c) => (
        <Space size={0}>
          {puedeEditar && c.vigente && (
            <>
              <Tooltip title="Transferir (a otro empleado o a otra área)">
                <Button type="text" size="small" icon={<SwapOutlined />} onClick={() => setCierre({ cargo: c, accion: 'transferir' })} />
              </Tooltip>
              <Tooltip title="Dar de baja (fuera de servicio)">
                <Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => setCierre({ cargo: c, accion: 'baja' })} />
              </Tooltip>
            </>
          )}
          {puedeEditar && (
            <Tooltip title={c.vigente ? 'Editar datos' : 'Corregir planilla o descripción'}>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditando(c)} />
            </Tooltip>
          )}
          {puedeEliminar && (
            <Popconfirm
              title="¿Eliminar el registro?"
              description="Use esta opción sólo para errores de carga: se pierde del historial. Para cerrar un cargo use Transferir o Dar de baja."
              onConfirm={() => eliminar.mutateAsync(c.id).catch((e) => message.error(mensajeError(e)))}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table
        rowKey="id"
        size="small"
        columns={columnas}
        dataSource={cargos}
        scroll={{ x: 1250 }}
        rowClassName={(c) => (c.vigente ? '' : 'fila-cargo-cerrado')}
        {...tabla}
      />
      <CargoFormModal open={!!editando} cargo={editando} onClose={() => setEditando(null)} />
      <CierreCargoModal cargo={cierre.cargo} accion={cierre.accion} onClose={() => setCierre({ cargo: null, accion: 'baja' })} />
      <DocumentosCargoModal cargo={archivos} onClose={() => setArchivos(null)} />
    </>
  );
}
