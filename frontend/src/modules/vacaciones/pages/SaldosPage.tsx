import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Checkbox, Col, Input, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography, type TableColumnsType } from 'antd';
import { ClearOutlined, DeleteOutlined, EditOutlined, FileExcelOutlined, PlusOutlined, SearchOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { usePermiso } from '@/core/auth/AuthContext';
import { Can } from '@/core/auth/guards';
import PageHeader from '@/core/components/PageHeader';
import { useFiltrosUrl } from '@/core/hooks/useFiltrosUrl';
import { descargarArchivo } from '@/core/utils/descargar';
import { fmtFecha } from '@/core/utils/format';
import type { Saldo } from '@/core/api/types';
import { CONCEPTOS, movimientosApi, obtenerSaldos, type FilaSaldos, type MovimientoSaldo } from '@/shared/api/saldos';
import MovimientoFormModal from '@/shared/components/MovimientoFormModal';
import { nombreBolsa } from '@/shared/components/NombreBolsa';
import { EmpleadoSelect, ModalidadSelect, TipoNovedadSelect, UnidadSelect } from '@/shared/components/Selects';
import { COLOR_ACTIVO } from '@/app/theme';
import AsignacionMasivaModal from '@/shared/components/AsignacionMasivaModal';

const FILTROS = ['q', 'unidad', 'modalidad', 'empleado', 'tipo', 'vista', 'concepto', 'anio', 'page', 'todas'] as const;

export default function SaldosPage() {
  const { filtros, setFiltros, limpiar, lista } = useFiltrosUrl(FILTROS);
  const [asignacion, setAsignacion] = useState(false);
  const [movModal, setMovModal] = useState<{ abierto: boolean; movimiento?: MovimientoSaldo | null }>({ abierto: false });
  const puedeEditar = usePermiso('vacaciones.change_movimientosaldo');
  const eliminar = movimientosApi.useEliminar();
  const vista = filtros.vista ?? 'saldos';

  const comunes = { unidad: filtros.unidad, modalidad: filtros.modalidad, empleado: filtros.empleado, q: filtros.q };
  const { data: saldos, isFetching } = useQuery({
    queryKey: ['vacaciones/saldos', comunes, filtros.tipo, filtros.todas],
    queryFn: () => obtenerSaldos({ ...comunes, tipo: filtros.tipo, incluir_ocultas: filtros.todas }),
    enabled: vista === 'saldos',
  });
  const { data: movimientos, isFetching: cargandoMov } = movimientosApi.useLista(
    {
      search: filtros.q,
      unidad: filtros.unidad,
      empleado: filtros.empleado,
      tipo_novedad: filtros.tipo,
      concepto: filtros.concepto,
      anio: filtros.anio,
      page: filtros.page,
    },
    vista === 'movimientos',
  );

  // Una fila por empleado y tipo de licencia con saldo.
  // Por defecto, las bolsas visibles de cada agente (las mismas que su ficha); "todas" muestra también el resto.
  const verTodas = filtros.todas === '1';
  const filasSaldo = (saldos?.resultados ?? []).flatMap((f) =>
    f.saldos
      .filter((s) => verTodas || s.visible)
      .map((s) => ({ ...s, fila: f, key: `${f.empleado_id}-${s.tipo_id}` })),
  );
  const mostrarBolsa = (saldos?.tipos.length ?? 0) > 1 || filasSaldo.some((f) => f.incluye.length > 0);

  const columnasSaldo: TableColumnsType<Saldo & { fila: FilaSaldos; key: string }> = [
    {
      title: 'Empleado',
      key: 'empleado',
      sorter: (a, b) => a.fila.empleado.localeCompare(b.fila.empleado),
      render: (_, r) => (
        <>
          <Link to={`/personal/${r.fila.empleado_id}`}>{r.fila.empleado}</Link>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {r.fila.legajo} · {r.fila.unidad}
            </Typography.Text>
          </div>
        </>
      ),
    },
    ...(mostrarBolsa ? [{ title: 'Bolsa de días', key: 'bolsa', render: (_: unknown, r: Saldo) => nombreBolsa(r), responsive: ['lg' as const] }] : []),
    { title: 'Asignados', dataIndex: 'asignados', align: 'right', sorter: (a, b) => a.asignados - b.asignados },
    { title: 'Compensados', dataIndex: 'compensados', align: 'right', responsive: ['md'] },
    { title: 'Ajustes', dataIndex: 'ajustes', align: 'right', responsive: ['lg'] },
    { title: 'Utilizados', dataIndex: 'usados', align: 'right', sorter: (a, b) => a.usados - b.usados },
    { title: 'Programados', dataIndex: 'programados', align: 'right', responsive: ['md'] },
    {
      title: 'Disponibles',
      dataIndex: 'disponible',
      align: 'right',
      sorter: (a, b) => a.disponible - b.disponible,
      render: (v: number) => (
        <Typography.Text strong style={{ color: v < 0 ? '#f5222d' : v > 0 ? COLOR_ACTIVO : undefined }}>
          {v}
        </Typography.Text>
      ),
    },
  ];

  const columnasMov: TableColumnsType<MovimientoSaldo> = [
    { title: 'Fecha', dataIndex: 'fecha', render: fmtFecha, width: 110 },
    { title: 'Empleado', dataIndex: 'empleado_nombre', render: (t, m) => <Link to={`/personal/${m.empleado}`}>{t}</Link> },
    { title: 'Tipo', dataIndex: 'tipo_novedad_nombre', responsive: ['lg'] },
    { title: 'Concepto', dataIndex: 'concepto', render: (c, m) => <Tag color={CONCEPTOS.find((x) => x.value === c)?.color}>{m.concepto_display}</Tag> },
    { title: 'Año', dataIndex: 'anio', width: 70 },
    { title: 'Días', dataIndex: 'dias', width: 70, align: 'right', render: (d: number) => (d > 0 ? `+${d}` : d) },
    {
      title: 'Detalle',
      dataIndex: 'motivo',
      ellipsis: true,
      render: (m, mov) => (
        <>
          {m}
          {mov.fecha_trabajada && <Typography.Text type="secondary"> (trabajó el {fmtFecha(mov.fecha_trabajada)})</Typography.Text>}
        </>
      ),
    },
    { title: 'Cargado por', dataIndex: 'creado_por_nombre', responsive: ['xl'] },
    {
      key: 'acciones',
      width: 90,
      render: (_, m) =>
        puedeEditar && (
          <Space size={0}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setMovModal({ abierto: true, movimiento: m })} />
            <Popconfirm title="¿Eliminar el movimiento?" onConfirm={() => eliminar.mutateAsync(m.id)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Vacaciones y saldos"
        subtitulo="Días asignados, compensados, utilizados y disponibles por empleado"
        acciones={
          <>
            <Button icon={<FileExcelOutlined />} onClick={() => descargarArchivo('/reportes/saldos/', { ...comunes, tipo_saldo: filtros.tipo, formato: 'xlsx' })}>
              Exportar
            </Button>
            <Can permiso="vacaciones.add_movimientosaldo">
              <Button icon={<PlusOutlined />} onClick={() => setMovModal({ abierto: true })}>
                Nuevo movimiento
              </Button>
              <Button type="primary" icon={<UsergroupAddOutlined />} onClick={() => setAsignacion(true)}>
                Asignación masiva
              </Button>
            </Can>
          </>
        }
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col flex="240px">
            <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar empleado" defaultValue={filtros.q} onChange={(e) => setFiltros({ q: e.target.value, page: undefined })} />
          </Col>
          <Col flex="200px">
            <TipoNovedadSelect soloConSaldo style={{ width: '100%' }} value={filtros.tipo ? Number(filtros.tipo) : undefined} onChange={(v) => setFiltros({ tipo: v ? String(v) : undefined })} />
          </Col>
          <Col flex="260px">
            <UnidadSelect
              multiple
              style={{ width: '100%' }}
              value={lista('unidad').map(Number)}
              onChange={(v: number[]) => setFiltros({ unidad: v, page: undefined })}
            />
          </Col>
          {vista === 'saldos' ? (
            <Col flex="200px">
              <ModalidadSelect mode="multiple" style={{ width: '100%' }} value={lista('modalidad').map(Number)} onChange={(v) => setFiltros({ modalidad: v })} />
            </Col>
          ) : (
            <>
              <Col flex="220px">
                <Select allowClear placeholder="Concepto" style={{ width: '100%' }} options={CONCEPTOS} value={filtros.concepto} onChange={(v) => setFiltros({ concepto: v, page: undefined })} />
              </Col>
              <Col flex="110px">
                <Select
                  allowClear
                  placeholder="Año"
                  style={{ width: '100%' }}
                  value={filtros.anio ? Number(filtros.anio) : undefined}
                  options={Array.from({ length: 6 }, (_, i) => dayjs().year() + 1 - i).map((a) => ({ value: a, label: a }))}
                  onChange={(v) => setFiltros({ anio: v ? String(v) : undefined, page: undefined })}
                />
              </Col>
            </>
          )}
          <Col flex="220px">
            <EmpleadoSelect mode="multiple" style={{ width: '100%' }} value={lista('empleado').map(Number)} onChange={(v) => setFiltros({ empleado: v, page: undefined })} />
          </Col>
          {vista === 'saldos' && (
            <Col>
              <Checkbox checked={verTodas} onChange={(e) => setFiltros({ todas: e.target.checked ? '1' : undefined })}>
                Incluir ocultas y sin movimientos
              </Checkbox>
            </Col>
          )}
          <Col>
            <Button icon={<ClearOutlined />} onClick={limpiar}>
              Limpiar
            </Button>
          </Col>
        </Row>
      </Card>
      <Card size="small" styles={{ body: { paddingTop: 0 } }}>
        <Tabs
          activeKey={vista}
          onChange={(k) => setFiltros({ vista: k === 'saldos' ? undefined : k, page: undefined })}
          items={[
            {
              key: 'saldos',
              label: 'Saldos',
              children: (
                <Table
                  rowKey="key"
                  columns={columnasSaldo}
                  dataSource={filasSaldo}
                  expandable={{
                    rowExpandable: (r) => r.incluye.length > 0,
                    expandedRowRender: (r) => (
                      <Table
                        size="small"
                        rowKey="tipo_id"
                        pagination={false}
                        dataSource={r.desglose}
                        columns={[
                          { title: 'Detalle por tipo', dataIndex: 'tipo' },
                          { title: 'Asignados', dataIndex: 'asignados', align: 'right' },
                          { title: 'Compensados', dataIndex: 'compensados', align: 'right' },
                          { title: 'Ajustes', dataIndex: 'ajustes', align: 'right' },
                          { title: 'Utilizados', dataIndex: 'usados', align: 'right' },
                          { title: 'Programados', dataIndex: 'programados', align: 'right' },
                        ]}
                      />
                    ),
                  }}
                  loading={isFetching}
                  pagination={{ pageSize: 50, hideOnSinglePage: true }}
                  scroll={{ x: 700 }}
                />
              ),
            },
            {
              key: 'movimientos',
              label: 'Movimientos',
              children: (
                <Table
                  rowKey="id"
                  columns={columnasMov}
                  dataSource={movimientos?.results}
                  loading={cargandoMov}
                  scroll={{ x: 800 }}
                  pagination={{ current: Number(filtros.page ?? 1), pageSize: 25, total: movimientos?.count, showSizeChanger: false }}
                  onChange={(p) => setFiltros({ page: p.current && p.current > 1 ? String(p.current) : undefined })}
                />
              ),
            },
          ]}
        />
      </Card>
      <AsignacionMasivaModal open={asignacion} onClose={() => setAsignacion(false)} />
      <MovimientoFormModal open={movModal.abierto} movimiento={movModal.movimiento} onClose={() => setMovModal({ abierto: false })} />
    </>
  );
}
