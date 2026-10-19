import { useMemo, useState } from 'react';
import { usePermiso } from '@/core/auth/AuthContext';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Input,
  Row,
  Segmented,
  Space,
  Table,
  Tabs,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd';
import {
  CalendarOutlined,
  ClearOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  TableOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import PageHeader from '@/core/components/PageHeader';
import { useFiltrosUrl } from '@/core/hooks/useFiltrosUrl';
import { descargarArchivo } from '@/core/utils/descargar';
import { FORMATO_FECHA, fmtFecha, hoyApi } from '@/core/utils/format';
import { EstadoNovedades } from '@/shared/components/EstadoNovedades';
import IconoPersona from '@/shared/components/IconoPersona';
import { COLOR_ACTIVO } from '@/app/theme';
import RutaUnidad from '@/shared/components/RutaUnidad';
import { EmpleadoSelect, EstadoSelect, ModalidadSelect, UnidadSelect } from '@/shared/components/Selects';
import { useEstadoPersonal, type FilaEstado } from '../api';
import GrillaPeriodo from '@/shared/components/GrillaPeriodo';
import TarjetasPorDireccion from '../components/TarjetasPorDireccion';
import ResumenCards from '../components/ResumenCards';
import CalendarioMensual, { type VistaCalendario } from '../calendario/CalendarioMensual';

const FILTROS = ['modo', 'fecha', 'desde', 'hasta', 'unidad', 'modalidad', 'estado', 'empleado', 'vista', 'mes', 'cal'] as const;
const VISTAS = ['tabla', 'grilla', 'calendario'];

const PRESETS_PERIODO: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: 'Esta semana', value: [dayjs().startOf('isoWeek'), dayjs().endOf('isoWeek')] },
  { label: 'Próxima semana', value: [dayjs().add(1, 'week').startOf('isoWeek'), dayjs().add(1, 'week').endOf('isoWeek')] },
  { label: 'Próximos 15 días', value: [dayjs(), dayjs().add(14, 'day')] },
  { label: 'Este mes', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Próximo mes', value: [dayjs().add(1, 'month').startOf('month'), dayjs().add(1, 'month').endOf('month')] },
];

/** Días que muestra la grilla en modo "día" (desde la fecha elegida). */
const DIAS_GRILLA_MODO_DIA = 14;

export default function DashboardPage() {
  const { filtros, setFiltros, limpiar, lista } = useFiltrosUrl(FILTROS);
  const [busqueda, setBusqueda] = useState('');
  const modo = filtros.modo === 'periodo' ? 'periodo' : 'dia';
  const verCalendario = usePermiso(['novedades.view_novedad', 'calendario.view_dianolaborable']);
  const vista = filtros.vista && VISTAS.includes(filtros.vista) && (filtros.vista !== 'calendario' || verCalendario) ? filtros.vista : 'direcciones';
  const mesCalendario = filtros.mes && dayjs(`${filtros.mes}-01`).isValid() ? dayjs(`${filtros.mes}-01`) : dayjs().startOf('month');
  const vistaCalendario: VistaCalendario = filtros.cal === 'lista' ? 'lista' : 'mes';
  const fecha = filtros.fecha ?? hoyApi();
  const desde = modo === 'dia' ? fecha : filtros.desde ?? hoyApi();
  const hasta = modo === 'dia' ? fecha : filtros.hasta ?? dayjs().add(14, 'day').format('YYYY-MM-DD');

  const filtrosComunes = {
    unidad: filtros.unidad,
    modalidad: filtros.modalidad,
    empleado: filtros.empleado,
    estado: filtros.estado,
  };
  const { data, isFetching, refetch, dataUpdatedAt } = useEstadoPersonal({ desde, hasta, ...filtrosComunes });

  const paramsGrilla =
    modo === 'dia'
      ? { ...filtrosComunes, desde: fecha, hasta: dayjs(fecha).add(DIAS_GRILLA_MODO_DIA - 1, 'day').format('YYYY-MM-DD') }
      : { ...filtrosComunes, desde, hasta };

  const estados = lista('estado');
  const toggleEstado = (estado: string | null) => {
    if (estado === null) return setFiltros({ estado: undefined });
    setFiltros({ estado: estados.includes(estado) ? estados.filter((e) => e !== estado) : [...estados, estado] });
  };

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const empleados = data?.empleados ?? [];
    return texto ? empleados.filter((e) => `${e.nombre} ${e.legajo}`.toLowerCase().includes(texto)) : empleados;
  }, [data, busqueda]);

  const esHoy = modo === 'dia' && fecha === hoyApi();
  const textoFecha =
    modo === 'dia'
      ? `${esHoy ? 'Hoy, ' : ''}${dayjs(fecha).format('dddd D [de] MMMM [de] YYYY')}`
      : `Período del ${fmtFecha(desde)} al ${fmtFecha(hasta)}`;

  /** Flechas del encabezado: un día por vez, o el período completo hacia atrás/adelante. */
  const mover = (sentido: -1 | 1) => {
    if (modo === 'dia') {
      const nueva = dayjs(fecha).add(sentido, 'day').format('YYYY-MM-DD');
      setFiltros({ fecha: nueva === hoyApi() ? undefined : nueva });
    } else {
      const largo = dayjs(hasta).diff(dayjs(desde), 'day') + 1;
      setFiltros({
        desde: dayjs(desde).add(sentido * largo, 'day').format('YYYY-MM-DD'),
        hasta: dayjs(hasta).add(sentido * largo, 'day').format('YYYY-MM-DD'),
      });
    }
  };
  const etiqueta = modo === 'dia' ? 'día' : 'período';
  const flecha = (sentido: -1 | 1) => (
    <Tooltip title={`${modo === 'dia' ? 'Día' : 'Período'} ${sentido < 0 ? 'anterior' : 'siguiente'}`}>
      <Button
        icon={sentido < 0 ? <LeftOutlined /> : <RightOutlined />}
        onClick={() => mover(sentido)}
        aria-label={`${etiqueta} ${sentido < 0 ? 'anterior' : 'siguiente'}`}
      />
    </Tooltip>
  );
  const subtitulo = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);

  const exportar = (formato: 'xlsx' | 'pdf') => {
    const base = { unidad: filtros.unidad, modalidad: filtros.modalidad, empleado: filtros.empleado, formato };
    return modo === 'dia'
      ? descargarArchivo('/reportes/estado_fecha/', { ...base, fecha })
      : descargarArchivo('/reportes/novedades_periodo/', { ...base, desde, hasta });
  };

  const columnas: TableColumnsType<FilaEstado> = [
    {
      title: 'Empleado',
      dataIndex: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
      render: (_, fila) => (
        <Space>
          <IconoPersona color={fila.novedades[0]?.color ?? COLOR_ACTIVO} tamanio={36} />
          <div>
            <Link to={`/personal/${fila.id}`}>{fila.nombre}</Link>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Legajo {fila.legajo}
              </Typography.Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Unidad',
      dataIndex: 'unidad_ruta',
      sorter: (a, b) => a.unidad_ruta.localeCompare(b.unidad_ruta),
      responsive: ['md'],
      render: (_, fila) => <RutaUnidad ruta={fila.unidad_ruta} />,
    },
    { title: 'Modalidad', dataIndex: 'modalidad', sorter: (a, b) => a.modalidad.localeCompare(b.modalidad), responsive: ['lg'] },
    {
      title: modo === 'dia' ? 'Estado actual' : 'Estado en el período',
      key: 'estado',
      sorter: (a, b) => Number(b.trabajando) - Number(a.trabajando) || a.novedades.length - b.novedades.length,
      render: (_, fila) => <EstadoNovedades novedades={fila.novedades} />,
    },
    {
      title: 'Desde',
      key: 'desde',
      width: 110,
      render: (_, fila) =>
        fila.novedades.length ? fila.novedades.map((n) => <div key={n.id}>{fmtFecha(n.desde)}</div>) : '—',
    },
    {
      title: 'Hasta',
      key: 'hasta',
      width: 110,
      render: (_, fila) =>
        fila.novedades.length
          ? fila.novedades.map((n) => (
              <div key={n.id}>{n.hasta ? fmtFecha(n.hasta) : <Typography.Text type="danger">abierta</Typography.Text>}</div>
            ))
          : '—',
    },
  ];

  const feriados = data?.no_laborables ?? [];
  const esFinDeSemana = modo === 'dia' && [0, 6].includes(dayjs(fecha).day());

  return (
    <>
      <PageHeader
        titulo="Estado del personal"
        subtitulo={subtitulo}
        acciones={
          <>
            <Tooltip title={dataUpdatedAt ? `Actualizado ${dayjs(dataUpdatedAt).format('HH:mm:ss')} · se actualiza cada minuto` : ''}>
              <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>
                Actualizar
              </Button>
            </Tooltip>
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
          </>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col>
            <Segmented
              value={modo}
              onChange={(v) => setFiltros({ modo: v === 'dia' ? undefined : String(v) })}
              options={[
                { label: 'Día', value: 'dia', icon: <CalendarOutlined /> },
                { label: 'Período', value: 'periodo', icon: <TableOutlined /> },
              ]}
            />
          </Col>
          <Col>
            {modo === 'dia' ? (
              <Space.Compact>
                {flecha(-1)}
                <DatePicker
                  value={dayjs(fecha)}
                  format={FORMATO_FECHA}
                  allowClear={false}
                  onChange={(d) => setFiltros({ fecha: d && d.format('YYYY-MM-DD') !== hoyApi() ? d.format('YYYY-MM-DD') : undefined })}
                />
                {flecha(1)}
                <Button disabled={esHoy} onClick={() => setFiltros({ fecha: undefined })}>
                  Hoy
                </Button>
              </Space.Compact>
            ) : (
              <Space.Compact>
                {flecha(-1)}
                <DatePicker.RangePicker
                  value={[dayjs(desde), dayjs(hasta)]}
                  format={FORMATO_FECHA}
                  allowClear={false}
                  presets={PRESETS_PERIODO}
                  onChange={(r) => r?.[0] && r[1] && setFiltros({ desde: r[0].format('YYYY-MM-DD'), hasta: r[1].format('YYYY-MM-DD') })}
                />
                {flecha(1)}
              </Space.Compact>
            )}
          </Col>
          <Col flex="260px">
            <UnidadSelect
              multiple
              style={{ width: '100%' }}
              value={lista('unidad').map(Number)}
              onChange={(v: number[]) => setFiltros({ unidad: v })}
            />
          </Col>
          <Col flex="200px">
            <ModalidadSelect mode="multiple" style={{ width: '100%' }} value={lista('modalidad').map(Number)} onChange={(v) => setFiltros({ modalidad: v })} />
          </Col>
          <Col flex="200px">
            <EstadoSelect mode="multiple" style={{ width: '100%' }} value={estados} onChange={(v) => setFiltros({ estado: v })} />
          </Col>
          <Col flex="240px">
            <EmpleadoSelect mode="multiple" style={{ width: '100%' }} value={lista('empleado').map(Number)} onChange={(v) => setFiltros({ empleado: v })} />
          </Col>
          <Col>
            <Button icon={<ClearOutlined />} onClick={limpiar}>
              Limpiar
            </Button>
          </Col>
        </Row>
      </Card>

      {modo === 'dia' && (esFinDeSemana || feriados.length > 0) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={feriados.length ? `${feriados[0].tipo_display}: ${feriados[0].motivo}` : 'Día no hábil (fin de semana)'}
          description={feriados[0]?.norma ? `Norma: ${feriados[0].norma}` : undefined}
        />
      )}
      {modo === 'periodo' && feriados.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Días no laborables en el período: ${feriados.map((f) => `${fmtFecha(f.fecha)} (${f.motivo})`).join(' · ')}`}
        />
      )}

      {data && (
        <div style={{ marginBottom: 16 }}>
          <ResumenCards resumen={data.resumen} esUnDia={data.es_un_dia} estadosActivos={estados} onToggleEstado={toggleEstado} />
        </div>
      )}

      <Card
        size="small"
        styles={{ body: { paddingTop: 0 } }}
      >
        <Tabs
          activeKey={vista}
          onChange={(k) => setFiltros({ vista: k === 'direcciones' ? undefined : k })}
          tabBarExtraContent={
            (vista === 'direcciones' || vista === 'tabla') && (
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Buscar por nombre o legajo"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: 240 }}
              />
            )
          }
          items={[
            {
              key: 'direcciones',
              label: (
                <span>
                  <AppstoreOutlined /> Por dirección
                </span>
              ),
              children: data ? (
                <TarjetasPorDireccion datos={data} filas={filas} ocultarVacias={!!(filtros.unidad || filtros.empleado || filtros.estado || busqueda)} />
              ) : null,
            },
            {
              key: 'tabla',
              label: (
                <span>
                  <UnorderedListOutlined /> Tabla
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  size="middle"
                  columns={columnas}
                  dataSource={filas}
                  loading={isFetching && !data}
                  pagination={{ pageSize: 50, hideOnSinglePage: true, showTotal: (t) => `${t} empleados` }}
                  scroll={{ x: 700 }}
                />
              ),
            },
            {
              key: 'grilla',
              label: (
                <span>
                  <TableOutlined /> Vista por período
                </span>
              ),
              children: (
                <>
                  {modo === 'dia' && (
                    <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
                      Próximos {DIAS_GRILLA_MODO_DIA} días desde la fecha seleccionada. Use el modo "Período" para elegir otro rango (máx. 92 días).
                    </Typography.Paragraph>
                  )}
                  <GrillaPeriodo params={paramsGrilla} articulos={data?.resumen.por_tipo ?? []} />
                </>
              ),
            },
            ...(verCalendario
              ? [
                  {
                    key: 'calendario',
                    label: (
                      <span>
                        <CalendarOutlined /> Calendario
                      </span>
                    ),
                    children: vista === 'calendario' && (
                      <CalendarioMensual
                        filtros={{
                          unidad: filtros.unidad,
                          modalidad: filtros.modalidad,
                          empleado: filtros.empleado,
                          // "trabajando" no tiene licencias que mostrar en el calendario.
                          tipo: estados.filter((e) => e !== 'trabajando').join(',') || undefined,
                        }}
                        mes={mesCalendario}
                        onCambiarMes={(m) => setFiltros({ mes: m.isSame(dayjs(), 'month') ? undefined : m.format('YYYY-MM') })}
                        vista={vistaCalendario}
                        onCambiarVista={(v) => setFiltros({ cal: v === 'mes' ? undefined : v })}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  );
}
