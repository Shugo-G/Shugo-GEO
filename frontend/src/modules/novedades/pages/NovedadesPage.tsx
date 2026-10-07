import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Col, DatePicker, Input, Row, Segmented, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { ClearOutlined, PaperClipOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Can } from '@/core/auth/guards';
import PageHeader from '@/core/components/PageHeader';
import { useFiltrosUrl } from '@/core/hooks/useFiltrosUrl';
import { FORMATO_FECHA, fmtFecha } from '@/core/utils/format';
import { novedadesApi, type Novedad } from '@/shared/api/novedades';
import AccionesNovedad from '@/shared/components/AccionesNovedad';
import AnularNovedadModal from '@/shared/components/AnularNovedadModal';
import EstadoNovedadTag from '@/shared/components/EstadoNovedadTag';
import InterrumpirNovedadModal from '@/shared/components/InterrumpirNovedadModal';
import NovedadFormModal from '@/shared/components/NovedadFormModal';
import { EmpleadoSelect, TipoNovedadSelect, UnidadSelect } from '@/shared/components/Selects';
import CerrarNovedadModal from '../components/CerrarNovedadModal';

const FILTROS = ['q', 'desde', 'hasta', 'tipo', 'unidad', 'empleado', 'situacion', 'page', 'ordering'] as const;

/** Por defecto se muestran las activas (programadas y en curso); el resto está en el historial. */
const SITUACIONES = [
  { label: 'Activas', value: 'activas' },
  { label: 'Abiertas', value: 'abiertas' },
  { label: 'Historial', value: 'historial' },
  { label: 'Todas', value: 'todas' },
];

export default function NovedadesPage() {
  const { filtros, setFiltros, limpiar, lista } = useFiltrosUrl(FILTROS, { situacion: 'activas' });
  const [modal, setModal] = useState<{ abierto: boolean; novedad?: Novedad | null }>({ abierto: false });
  const [aCerrar, setACerrar] = useState<Novedad | null>(null);
  const [aInterrumpir, setAInterrumpir] = useState<Novedad | null>(null);
  const [aAnular, setAAnular] = useState<Novedad | null>(null);
  const situacion = filtros.situacion ?? 'activas';
  const pagina = Number(filtros.page ?? 1);

  const { data, isFetching } = novedadesApi.useLista({
    search: filtros.q,
    desde: filtros.desde,
    hasta: filtros.hasta,
    tipo: filtros.tipo,
    unidad: filtros.unidad,
    empleado: filtros.empleado,
    situacion: situacion === 'activas' || situacion === 'historial' ? situacion : undefined,
    abierta: situacion === 'abiertas' ? true : undefined,
    ordering: filtros.ordering ?? '-fecha_desde',
    page: pagina,
  });

  const columnas: TableColumnsType<Novedad> = [
    {
      title: 'Empleado',
      dataIndex: 'empleado_nombre',
      key: 'empleado__apellido',
      sorter: true,
      render: (t, n) => (
        <>
          <Link to={`/personal/${n.empleado}`}>{t}</Link>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {n.unidad_nombre}
            </Typography.Text>
          </div>
        </>
      ),
    },
    { title: 'Artículo', dataIndex: 'tipo_nombre', render: (t, n) => <Badge color={n.color} text={n.anio_saldo ? `${t} · ${n.anio_saldo}` : t} /> },
    { title: 'Desde', dataIndex: 'fecha_desde', key: 'fecha_desde', sorter: true, defaultSortOrder: 'descend', render: fmtFecha, width: 110 },
    {
      title: 'Hasta',
      dataIndex: 'fecha_hasta',
      key: 'fecha_hasta',
      sorter: true,
      width: 110,
      render: (v) => (v ? fmtFecha(v) : '—'),
    },
    { title: 'Estado', key: 'estado', width: 150, render: (_, n) => <EstadoNovedadTag novedad={n} /> },
    { title: 'Días', dataIndex: 'dias', key: 'dias', sorter: true, width: 80, align: 'right', render: (v) => v ?? '—' },
    { title: 'Motivo', dataIndex: 'motivo', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Doc.',
      dataIndex: 'documentos_cantidad',
      width: 90,
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
      width: 140,
      fixed: 'right',
      render: (_, n) => (
        <AccionesNovedad
          novedad={n}
          onEditar={(x) => setModal({ abierto: true, novedad: x })}
          onInterrumpir={setAInterrumpir}
          onAnular={setAAnular}
          onCerrar={setACerrar}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Licencias del personal"
        acciones={
          <Can permiso="novedades.add_novedad">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ abierto: true })}>
              Registrar licencia
            </Button>
          </Can>
        }
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col flex="240px">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Buscar empleado o motivo"
              defaultValue={filtros.q}
              onChange={(e) => setFiltros({ q: e.target.value, page: undefined })}
            />
          </Col>
          <Col>
            <DatePicker.RangePicker
              format={FORMATO_FECHA}
              placeholder={['Desde', 'Hasta']}
              value={filtros.desde && filtros.hasta ? [dayjs(filtros.desde), dayjs(filtros.hasta)] : null}
              onChange={(r) =>
                setFiltros({ desde: r?.[0]?.format('YYYY-MM-DD'), hasta: r?.[1]?.format('YYYY-MM-DD'), page: undefined })
              }
            />
          </Col>
          <Col flex="200px">
            <TipoNovedadSelect mode="multiple" style={{ width: '100%' }} soloActivos={false} value={lista('tipo').map(Number)} onChange={(v) => setFiltros({ tipo: v, page: undefined })} />
          </Col>
          <Col flex="260px">
            <UnidadSelect
              multiple
              style={{ width: '100%' }}
              value={lista('unidad').map(Number)}
              onChange={(v: number[]) => setFiltros({ unidad: v, page: undefined })}
            />
          </Col>
          <Col flex="220px">
            <EmpleadoSelect mode="multiple" incluirBajas style={{ width: '100%' }} value={lista('empleado').map(Number)} onChange={(v) => setFiltros({ empleado: v, page: undefined })} />
          </Col>
          <Col>
            <Segmented
              value={situacion}
              onChange={(v) => setFiltros({ situacion: String(v), page: undefined })}
              options={SITUACIONES}
            />
          </Col>
          <Col>
            <Button icon={<ClearOutlined />} onClick={limpiar}>
              Limpiar
            </Button>
          </Col>
        </Row>
      </Card>
      <Card size="small">
        <Table
          rowKey="id"
          columns={columnas}
          dataSource={data?.results}
          loading={isFetching}
          scroll={{ x: 1000 }}
          rowClassName={(n) => (n.estado === 'ANULADA' ? 'fila-anulada' : '')}
          pagination={{ current: pagina, pageSize: 25, total: data?.count, showSizeChanger: false, showTotal: (t) => `${t} novedades` }}
          onChange={(p, _f, sorter) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const orden = s?.order ? `${s.order === 'descend' ? '-' : ''}${s.columnKey}` : undefined;
            setFiltros({ page: p.current && p.current > 1 ? String(p.current) : undefined, ordering: orden });
          }}
        />
      </Card>
      <NovedadFormModal open={modal.abierto} novedad={modal.novedad} onClose={() => setModal({ abierto: false })} />
      <CerrarNovedadModal novedad={aCerrar} onClose={() => setACerrar(null)} />
      <InterrumpirNovedadModal novedad={aInterrumpir} onClose={() => setAInterrumpir(null)} />
      <AnularNovedadModal novedad={aAnular} onClose={() => setAAnular(null)} />
    </>
  );
}
