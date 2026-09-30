import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Col, Input, Row, Select, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { ClearOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Can } from '@/core/auth/guards';
import PageHeader from '@/core/components/PageHeader';
import { useFiltrosUrl } from '@/core/hooks/useFiltrosUrl';
import { fmtFecha } from '@/core/utils/format';
import { SITUACIONES, empleadosApi, type Empleado } from '@/shared/api/empleados';
import { ModalidadSelect, UnidadSelect } from '@/shared/components/Selects';
import RutaUnidad from '@/shared/components/RutaUnidad';
import EmpleadoFormModal from '../components/EmpleadoFormModal';

const FILTROS = ['q', 'unidad', 'modalidad', 'situacion_revista', 'page', 'ordering'] as const;
/** Por defecto se listan sólo los activos; este valor indica "todas las situaciones". */
const TODOS = 'TODOS';

export default function EmpleadosPage() {
  const navigate = useNavigate();
  const { filtros, setFiltros, limpiar, lista } = useFiltrosUrl(FILTROS, { situacion_revista: 'ACTIVO' });
  const [modalAbierto, setModalAbierto] = useState(false);
  const pagina = Number(filtros.page ?? 1);

  const { data, isFetching } = empleadosApi.useLista({
    search: filtros.q,
    unidad: filtros.unidad,
    modalidad: filtros.modalidad,
    situacion_revista: filtros.situacion_revista === TODOS ? undefined : filtros.situacion_revista,
    ordering: filtros.ordering,
    page: pagina,
  });

  const columnas: TableColumnsType<Empleado> = [
    { title: 'Legajo', dataIndex: 'legajo', width: 110, sorter: true, key: 'legajo' },
    {
      title: 'Apellido y nombre',
      dataIndex: 'nombre_completo',
      key: 'apellido',
      sorter: true,
      render: (texto, e) => <Link to={`/personal/${e.id}`}>{texto}</Link>,
    },
    { title: 'DNI', dataIndex: 'dni', width: 110, responsive: ['lg'] },
    {
      title: 'Unidad organizativa',
      dataIndex: 'unidad_ruta',
      key: 'unidad__nombre',
      sorter: true,
      render: (ruta: string) => <RutaUnidad ruta={ruta} />,
    },
    { title: 'Modalidad', dataIndex: 'modalidad_nombre', key: 'modalidad__nombre', sorter: true, responsive: ['md'] },
    { title: 'Ingreso', dataIndex: 'fecha_ingreso', key: 'fecha_ingreso', sorter: true, render: fmtFecha, responsive: ['lg'], width: 110 },
    {
      title: 'Situación',
      dataIndex: 'situacion_revista',
      width: 110,
      render: (v, e) => <Tag color={SITUACIONES.find((s) => s.value === v)?.color}>{e.situacion_revista_display}</Tag>,
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Personal"
        acciones={
          <Can permiso="personal.add_empleado">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalAbierto(true)}>
              Nuevo empleado
            </Button>
          </Can>
        }
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col flex="280px">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Buscar por apellido, nombre, DNI o legajo"
              defaultValue={filtros.q}
              onChange={(e) => setFiltros({ q: e.target.value, page: undefined })}
            />
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
            <ModalidadSelect mode="multiple" style={{ width: '100%' }} value={lista('modalidad').map(Number)} onChange={(v) => setFiltros({ modalidad: v, page: undefined })} />
          </Col>
          <Col flex="220px">
            <Select
              mode="multiple"
              allowClear
              placeholder="Situación de revista"
              style={{ width: '100%' }}
              options={SITUACIONES}
              value={lista('situacion_revista').filter((v) => v !== TODOS)}
              onChange={(v: string[]) => setFiltros({ situacion_revista: v.length ? v : TODOS, page: undefined })}
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
          scroll={{ x: 700 }}
          onRow={(e) => ({ onDoubleClick: () => navigate(`/personal/${e.id}`) })}
          pagination={{
            current: pagina,
            pageSize: 25,
            total: data?.count,
            showSizeChanger: false,
            showTotal: (t) => `${t} empleados`,
          }}
          onChange={(p, _f, sorter) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const orden = s?.order ? `${s.order === 'descend' ? '-' : ''}${s.columnKey}` : undefined;
            setFiltros({ page: p.current && p.current > 1 ? String(p.current) : undefined, ordering: orden });
          }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Doble clic en una fila para abrir la ficha.
        </Typography.Text>
      </Card>
      <EmpleadoFormModal
        open={modalAbierto}
        onClose={(guardado) => {
          setModalAbierto(false);
          if (guardado) navigate(`/personal/${guardado.id}`);
        }}
      />
    </>
  );
}
