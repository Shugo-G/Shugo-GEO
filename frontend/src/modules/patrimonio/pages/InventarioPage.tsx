import { useState } from 'react';
import { Button, Card, Col, Dropdown, Input, Row, Segmented, Statistic } from 'antd';
import { ClearOutlined, DownloadOutlined, FileExcelOutlined, FilePdfOutlined, LaptopOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Can } from '@/core/auth/guards';
import PageHeader from '@/core/components/PageHeader';
import { useFiltrosUrl } from '@/core/hooks/useFiltrosUrl';
import { descargarArchivo } from '@/core/utils/descargar';
import { cargosApi, useResumenPatrimonio } from '@/shared/api/patrimonio';
import CargoFormModal from '@/shared/components/patrimonio/CargoFormModal';
import TablaCargos from '@/shared/components/patrimonio/TablaCargos';
import { EmpleadoSelect, UnidadSelect } from '@/shared/components/Selects';

const FILTROS = ['q', 'tipo_insumo', 'unidad', 'empleado', 'situacion', 'page', 'ordering'] as const;

/**
 * Inventario de bienes patrimoniales: cantidad a cargo por insumo (tarjetas que
 * filtran) y listado con filtros. Buscar por IUB muestra la trayectoria del bien.
 */
export default function InventarioPage() {
  const { filtros, setFiltros, limpiar, lista } = useFiltrosUrl(FILTROS, { situacion: 'vigentes' });
  const [asignar, setAsignar] = useState(false);
  const situacion = filtros.situacion ?? 'vigentes';
  const pagina = Number(filtros.page ?? 1);
  const comunes = { unidad: filtros.unidad, empleado: filtros.empleado, search: filtros.q };

  const { data: resumen } = useResumenPatrimonio(comunes);
  const { data, isFetching } = cargosApi.useLista({
    ...comunes,
    tipo_insumo: filtros.tipo_insumo,
    situacion: situacion === 'todos' ? undefined : situacion,
    ordering: filtros.ordering ?? 'tipo_insumo__nombre',
    page: pagina,
  });

  const insumosActivos = lista('tipo_insumo');
  const toggleInsumo = (id: string) =>
    setFiltros({ tipo_insumo: insumosActivos.includes(id) ? insumosActivos.filter((x) => x !== id) : [...insumosActivos, id], page: undefined });

  const exportar = (formato: 'xlsx' | 'pdf') =>
    descargarArchivo('/reportes/cargos_patrimoniales/', {
      formato,
      situacion_cargo: situacion,
      tipo_insumo: filtros.tipo_insumo,
      unidad: filtros.unidad,
      empleado: filtros.empleado,
    });

  return (
    <>
      <PageHeader
        titulo="Inventario patrimonial"
        subtitulo="Bienes a cargo del personal, con planilla de cargo, IUB y legajo del responsable"
        acciones={
          <>
            <Dropdown
              menu={{
                items: [
                  { key: 'xlsx', icon: <FileExcelOutlined />, label: 'Excel', onClick: () => exportar('xlsx') },
                  { key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => exportar('pdf') },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Exportar</Button>
            </Dropdown>
            <Can permiso="patrimonio.add_cargopatrimonial">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAsignar(true)}>
                Asignar bien
              </Button>
            </Can>
          </>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="280px">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Buscar IUB, planilla, descripción o legajo"
              defaultValue={filtros.q}
              onChange={(e) => setFiltros({ q: e.target.value, page: undefined })}
            />
          </Col>
          <Col flex="260px">
            <UnidadSelect multiple style={{ width: '100%' }} value={lista('unidad').map(Number)} onChange={(v: number[]) => setFiltros({ unidad: v, page: undefined })} />
          </Col>
          <Col flex="240px">
            <EmpleadoSelect mode="multiple" incluirBajas style={{ width: '100%' }} value={lista('empleado').map(Number)} onChange={(v) => setFiltros({ empleado: v, page: undefined })} />
          </Col>
          <Col>
            <Segmented
              value={situacion}
              onChange={(v) => setFiltros({ situacion: String(v), page: undefined })}
              options={[
                { label: 'A cargo', value: 'vigentes' },
                { label: 'Historial', value: 'historial' },
                { label: 'Todos', value: 'todos' },
              ]}
            />
          </Col>
          <Col>
            <Button icon={<ClearOutlined />} onClick={limpiar}>
              Limpiar
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Bienes a cargo por insumo (clic para filtrar) */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} flex="1 1 120px">
          <Card
            size="small"
            className={`kpi-card ${insumosActivos.length === 0 ? 'activa' : ''}`}
            style={{ borderTopColor: '#1F4E79' }}
            onClick={() => setFiltros({ tipo_insumo: undefined, page: undefined })}
          >
            <Statistic title={<><LaptopOutlined /> Bienes a cargo</>} value={resumen?.total ?? 0} />
          </Card>
        </Col>
        {resumen?.por_insumo.map((i) => (
          <Col key={i.id} xs={12} sm={8} flex="1 1 120px">
            <Card
              size="small"
              className={`kpi-card ${insumosActivos.includes(String(i.id)) ? 'activa' : ''}`}
              style={{ borderTopColor: i.cantidad ? '#2e75b6' : '#d9d9d9' }}
              onClick={() => toggleInsumo(String(i.id))}
            >
              <Statistic title={i.nombre} value={i.cantidad} valueStyle={{ color: i.cantidad ? undefined : '#bfbfbf' }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small">
        <TablaCargos
          mostrarResponsable
          cargos={data?.results ?? []}
          loading={isFetching}
          pagination={{ current: pagina, pageSize: 25, total: data?.count, showSizeChanger: false, showTotal: (t) => `${t} registros` }}
          onChange={(p, _f, sorter) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const orden = s?.order ? `${s.order === 'descend' ? '-' : ''}${s.columnKey}` : undefined;
            setFiltros({ page: p.current && p.current > 1 ? String(p.current) : undefined, ordering: orden });
          }}
        />
      </Card>
      <CargoFormModal open={asignar} onClose={() => setAsignar(false)} />
    </>
  );
}
