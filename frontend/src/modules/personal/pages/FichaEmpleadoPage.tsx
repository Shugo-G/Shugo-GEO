import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Popconfirm,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  PaperClipOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePermiso } from '@/core/auth/AuthContext';
import { Can } from '@/core/auth/guards';
import PageHeader from '@/core/components/PageHeader';
import { descargarArchivo } from '@/core/utils/descargar';
import { fmtFecha } from '@/core/utils/format';
import { SITUACIONES, empleadosApi } from '@/shared/api/empleados';
import { novedadesApi, type Novedad } from '@/shared/api/novedades';
import { CONCEPTOS, movimientosApi, type ConceptoMovimiento, type MovimientoSaldo } from '@/shared/api/saldos';
import { EstadoNovedades } from '@/shared/components/EstadoNovedades';
import HistorialCambios from '@/core/components/HistorialCambios';
import MovimientoFormModal from '@/shared/components/MovimientoFormModal';
import AccionesNovedad from '@/shared/components/AccionesNovedad';
import AnularNovedadModal from '@/shared/components/AnularNovedadModal';
import EstadoNovedadTag from '@/shared/components/EstadoNovedadTag';
import InterrumpirNovedadModal from '@/shared/components/InterrumpirNovedadModal';
import CerrarNovedadModal from '@/modules/novedades/components/CerrarNovedadModal';
import NovedadFormModal from '@/shared/components/NovedadFormModal';
import { COLOR_ACTIVO } from '@/app/theme';
import { useFicha } from '../api';
import { cargosApi } from '@/shared/api/patrimonio';
import BienesEmpleado from '@/shared/components/patrimonio/BienesEmpleado';
import EmpleadoFormModal from '../components/EmpleadoFormModal';
import IconoPersona from '@/shared/components/IconoPersona';
import SaldosEmpleado from '../components/SaldosEmpleado';

export default function FichaEmpleadoPage() {
  const { id } = useParams();
  const empleadoId = Number(id);
  const navigate = useNavigate();
  const { data: ficha, isLoading, isError } = useFicha(empleadoId);

  const [editarEmpleado, setEditarEmpleado] = useState(false);
  const [novedadModal, setNovedadModal] = useState<{ abierto: boolean; novedad?: Novedad | null }>({ abierto: false });
  const [movimientoModal, setMovimientoModal] = useState<{ abierto: boolean; movimiento?: MovimientoSaldo | null; concepto?: ConceptoMovimiento }>({ abierto: false });
  const [anio, setAnio] = useState<number | undefined>();
  const [aInterrumpir, setAInterrumpir] = useState<Novedad | null>(null);
  const [aAnular, setAAnular] = useState<Novedad | null>(null);
  const [aCerrar, setACerrar] = useState<Novedad | null>(null);

  const puedeVerSaldos = usePermiso('vacaciones.view_movimientosaldo');
  const puedeEditarMov = usePermiso('vacaciones.change_movimientosaldo');
  const puedeVerCambios = usePermiso('personal.change_empleado');
  const puedeVerPatrimonio = usePermiso('patrimonio.view_cargopatrimonial');

  // Vigentes y programadas por un lado; finalizadas, interrumpidas y anuladas en el historial.
  const { data: activas = [], isFetching: cargandoActivas } = novedadesApi.useTodos({ empleado: empleadoId, situacion: 'activas' });
  const { data: historial = [], isFetching: cargandoHistorial } = novedadesApi.useTodos({
    empleado: empleadoId,
    situacion: 'historial',
    anio,
  });
  const { data: listaMovimientos = [] } = movimientosApi.useTodos({ empleado: empleadoId }, puedeVerSaldos);
  // Misma consulta que la pestaña de bienes (comparten caché): sirve para el contador.
  const { data: bienes = [] } = cargosApi.useTodos({ empleado: empleadoId, situacion: 'vigentes' }, puedeVerPatrimonio);
  const { data: cambios, isLoading: cargandoCambios } = empleadosApi.useHistorial(empleadoId, puedeVerCambios);
  const eliminarMovimiento = movimientosApi.useEliminar();

  if (isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (isError || !ficha) return <Result status="404" title="Empleado no encontrado" />;

  const { empleado, situacion_actual, saldos, proximas, resumen_historial } = ficha;
  const situacion = SITUACIONES.find((s) => s.value === empleado.situacion_revista);
  const anios = Array.from({ length: 6 }, (_, i) => dayjs().year() + 1 - i);

  const columnasNovedades: TableColumnsType<Novedad> = [
    { title: 'Artículo', dataIndex: 'tipo_nombre', render: (t, n) => <Badge color={n.color} text={n.anio_saldo ? `${t} · ${n.anio_saldo}` : t} /> },
    { title: 'Desde', dataIndex: 'fecha_desde', render: fmtFecha, width: 110 },
    { title: 'Hasta', dataIndex: 'fecha_hasta', width: 110, render: (v) => (v ? fmtFecha(v) : '—') },
    { title: 'Estado', key: 'estado', width: 150, render: (_, n) => <EstadoNovedadTag novedad={n} /> },
    { title: 'Días', dataIndex: 'dias', width: 70, align: 'right', render: (v) => v ?? '—' },
    { title: 'Motivo', dataIndex: 'motivo', ellipsis: true },
    {
      title: 'Doc.',
      dataIndex: 'documentos_cantidad',
      width: 70,
      align: 'center',
      render: (c, n) =>
        n.documentacion_pendiente ? (
          <Tag color="warning">Pendiente</Tag>
        ) : c ? (
          <span>
            <PaperClipOutlined /> {c}
          </span>
        ) : null,
    },
    {
      key: 'acciones',
      width: 130,
      render: (_, n) => (
        <AccionesNovedad
          novedad={n}
          onEditar={(x) => setNovedadModal({ abierto: true, novedad: x })}
          onInterrumpir={setAInterrumpir}
          onAnular={setAAnular}
          onCerrar={setACerrar}
        />
      ),
    },
  ];

  const columnasMovimientos: TableColumnsType<MovimientoSaldo> = [
    { title: 'Fecha', dataIndex: 'fecha', render: fmtFecha, width: 110 },
    { title: 'Artículo', dataIndex: 'tipo_novedad_nombre' },
    {
      title: 'Concepto',
      dataIndex: 'concepto',
      render: (c, m) => <Tag color={CONCEPTOS.find((x) => x.value === c)?.color}>{m.concepto_display}</Tag>,
    },
    { title: 'Año', dataIndex: 'anio', width: 70 },
    {
      title: 'Días',
      dataIndex: 'dias',
      width: 70,
      align: 'right',
      render: (d: number) => <Typography.Text type={d < 0 ? 'danger' : 'success'}>{d > 0 ? `+${d}` : d}</Typography.Text>,
    },
    {
      title: 'Detalle',
      dataIndex: 'motivo',
      render: (m, mov) => (
        <>
          {m}
          {mov.fecha_trabajada && (
            <Typography.Text type="secondary"> (trabajó el {fmtFecha(mov.fecha_trabajada)})</Typography.Text>
          )}
        </>
      ),
    },
    {
      key: 'acciones',
      width: 90,
      render: (_, m) =>
        puedeEditarMov && (
          <Space size={0}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setMovimientoModal({ abierto: true, movimiento: m })} />
            <Popconfirm title="¿Eliminar el movimiento?" onConfirm={() => eliminarMovimiento.mutateAsync(m.id)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
            {empleado.nombre_completo}
            <Tag color={situacion?.color}>{empleado.situacion_revista_display}</Tag>
          </Space>
        }
        subtitulo={`Legajo ${empleado.legajo} · ${empleado.unidad_ruta} · ${empleado.modalidad_nombre}`}
        acciones={
          <>
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => descargarArchivo('/reportes/historial_empleado/', { empleado: empleadoId, formato: 'xlsx' })}
            >
              Historial
            </Button>
            <Can permiso="novedades.add_novedad">
              <Button icon={<PlusOutlined />} onClick={() => setNovedadModal({ abierto: true })}>
                Registrar licencia
              </Button>
            </Can>
            <Can permiso="personal.change_empleado">
              <Button type="primary" icon={<EditOutlined />} onClick={() => setEditarEmpleado(true)}>
                Editar
              </Button>
            </Can>
          </>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Información personal y laboral" size="small" style={{ height: '100%' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <IconoPersona color={situacion_actual.novedades[0]?.color ?? COLOR_ACTIVO} tamanio={96} />
              <Descriptions
                column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
                size="small"
                style={{ flex: 1, minWidth: 280 }}
              >
              <Descriptions.Item label="DNI">{empleado.dni}</Descriptions.Item>
              <Descriptions.Item label="Legajo">{empleado.legajo}</Descriptions.Item>
              <Descriptions.Item label="Unidad organizativa" span="filled">
                {empleado.unidad_ruta}{' '}
                <Tag bordered={false} style={{ marginInlineStart: 4 }}>
                  {empleado.unidad_tipo}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nacimiento">
                {fmtFecha(empleado.fecha_nacimiento)}
                {empleado.fecha_nacimiento && ` (${dayjs().diff(empleado.fecha_nacimiento, 'year')} años)`}
              </Descriptions.Item>
              <Descriptions.Item label="Modalidad">{empleado.modalidad_nombre}</Descriptions.Item>
              <Descriptions.Item label="Ingreso">
                {fmtFecha(empleado.fecha_ingreso)} ({dayjs().diff(empleado.fecha_ingreso, 'year')} años de antigüedad)
              </Descriptions.Item>
              <Descriptions.Item label="Fin de contrato">
                {empleado.fecha_fin_contrato ? (
                  <Typography.Text type={dayjs(empleado.fecha_fin_contrato).diff(dayjs(), 'day') < 30 ? 'danger' : undefined}>
                    {fmtFecha(empleado.fecha_fin_contrato)}
                  </Typography.Text>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              {empleado.fecha_baja && <Descriptions.Item label="Fecha de baja">{fmtFecha(empleado.fecha_baja)}</Descriptions.Item>}
              <Descriptions.Item label="Teléfono">{empleado.telefono || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email" span="filled">{empleado.email || '—'}</Descriptions.Item>
            </Descriptions>
            </div>
            {empleado.observaciones && (
              <Alert type="info" message="Observaciones" description={empleado.observaciones} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }} />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title={`Situación actual · ${fmtFecha(situacion_actual.fecha)}`} size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ fontSize: 16 }}>
                <EstadoNovedades novedades={situacion_actual.novedades} />
              </div>
              {situacion_actual.novedades.map((n) => (
                <Typography.Text key={n.id} type="secondary">
                  {n.tipo}: desde {fmtFecha(n.desde)} {n.hasta ? `hasta ${fmtFecha(n.hasta)}` : '(sin fecha de fin)'}
                  {n.motivo && ` · ${n.motivo}`}
                </Typography.Text>
              ))}
              {!situacion_actual.novedades.length && <Badge color={COLOR_ACTIVO} text="Sin licencias para hoy" />}
              {proximas.length > 0 && (
                <>
                  <Typography.Text strong style={{ marginTop: 8 }}>
                    Próximas licencias
                  </Typography.Text>
                  {proximas.map((n) => (
                    <span key={n.id}>
                      <Badge color={n.color} text={n.tipo} />{' '}
                      <Typography.Text type="secondary">
                        {fmtFecha(n.desde)} → {fmtFecha(n.hasta)}
                      </Typography.Text>
                    </span>
                  ))}
                </>
              )}
            </Space>
          </Card>

          {puedeVerSaldos && (
            <SaldosEmpleado empleadoId={empleadoId} saldos={saldos} onCompensar={() => setMovimientoModal({ abierto: true, concepto: 'COMPENSACION' })} />
          )}
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'vigentes',
              label: `Vigentes y programadas (${activas.length})`,
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  columns={columnasNovedades}
                  dataSource={activas}
                  loading={cargandoActivas}
                  pagination={{ pageSize: 15, hideOnSinglePage: true }}
                  scroll={{ x: 800 }}
                  locale={{ emptyText: 'Sin licencias en curso ni programadas' }}
                />
              ),
            },
            {
              key: 'historial',
              label: 'Historial',
              children: (
                <>
                  <Space style={{ marginBottom: 12 }}>
                    <Select
                      allowClear
                      placeholder="Todos los años"
                      style={{ width: 160 }}
                      value={anio}
                      onChange={setAnio}
                      options={anios.map((a) => ({ value: a, label: a }))}
                    />
                    <Typography.Text type="secondary">Finalizadas, interrumpidas y anuladas</Typography.Text>
                  </Space>
                  <Table
                    rowKey="id"
                    size="small"
                    columns={columnasNovedades}
                    dataSource={historial}
                    loading={cargandoHistorial}
                    pagination={{ pageSize: 15, hideOnSinglePage: true }}
                    scroll={{ x: 800 }}
                    rowClassName={(n) => (n.estado === 'ANULADA' ? 'fila-anulada' : '')}
                  />
                  <Divider orientation="left" plain>
                    Resumen por tipo (no incluye anuladas)
                  </Divider>
                  {resumen_historial.length ? (
                    <Table
                      rowKey="tipo_id"
                      size="small"
                      pagination={false}
                      dataSource={resumen_historial}
                      columns={[
                        { title: 'Artículo', dataIndex: 'tipo', render: (t, r) => <Badge color={r.color} text={t} /> },
                        { title: `Registros ${dayjs().year()}`, dataIndex: 'cantidad_anio', align: 'right' },
                        { title: `Días ${dayjs().year()}`, dataIndex: 'dias_anio', align: 'right' },
                        { title: 'Registros totales', dataIndex: 'cantidad', align: 'right' },
                        { title: 'Días totales', dataIndex: 'dias', align: 'right' },
                      ]}
                    />
                  ) : (
                    <Empty description="Sin licencias registradas" />
                  )}
                </>
              ),
            },
            ...(puedeVerPatrimonio
              ? [{ key: 'bienes', label: `Bienes a cargo (${bienes.length})`, children: <BienesEmpleado empleadoId={empleadoId} /> }]
              : []),
            ...(puedeVerSaldos
              ? [
                  {
                    key: 'saldo',
                    label: 'Movimientos de saldo',
                    children: (
                      <>
                        <Can permiso="vacaciones.add_movimientosaldo">
                          <Button icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setMovimientoModal({ abierto: true })}>
                            Nuevo movimiento
                          </Button>
                        </Can>
                        <Table rowKey="id" size="small" columns={columnasMovimientos} dataSource={listaMovimientos} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 700 }} />
                      </>
                    ),
                  },
                ]
              : []),
            ...(puedeVerCambios
              ? [{ key: 'cambios', label: 'Historial de cambios', children: <HistorialCambios datos={cambios} cargando={cargandoCambios} /> }]
              : []),
          ]}
        />
      </Card>

      <EmpleadoFormModal open={editarEmpleado} empleado={empleado} onClose={() => setEditarEmpleado(false)} />
      <NovedadFormModal
        open={novedadModal.abierto}
        novedad={novedadModal.novedad}
        empleadoId={empleadoId}
        onClose={() => setNovedadModal({ abierto: false })}
      />
      <InterrumpirNovedadModal novedad={aInterrumpir} onClose={() => setAInterrumpir(null)} />
      <AnularNovedadModal novedad={aAnular} onClose={() => setAAnular(null)} />
      <CerrarNovedadModal novedad={aCerrar} onClose={() => setACerrar(null)} />
      <MovimientoFormModal
        open={movimientoModal.abierto}
        movimiento={movimientoModal.movimiento}
        conceptoInicial={movimientoModal.concepto}
        empleadoId={empleadoId}
        onClose={() => setMovimientoModal({ abierto: false })}
      />
    </>
  );
}
