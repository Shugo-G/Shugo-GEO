import { useMemo, useState } from 'react';
import { Button, Card, Col, Row, Segmented, Space, Spin, Statistic, Tooltip, Typography } from 'antd';
import { AppstoreOutlined, ClearOutlined, LeftOutlined, RightOutlined, TableOutlined, UnorderedListOutlined } from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventInput } from '@fullcalendar/core';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '@/core/components/PageHeader';
import { useFiltrosUrl } from '@/core/hooks/useFiltrosUrl';
import { categoriasApi } from '@/shared/api/catalogos';
import GrillaPeriodo from '@/shared/components/GrillaPeriodo';
import { CategoriaSelect, EmpleadoSelect, ModalidadSelect, UnidadSelect } from '@/shared/components/Selects';
import { useEventosCalendario } from '../api';
import CeldaDia from '../components/CeldaDia';
import DetalleDiaDrawer from '../components/DetalleDiaDrawer';
import { construirDias, type InfoDia } from '../dias';

const FILTROS = ['unidad', 'modalidad', 'categoria', 'empleado', 'vista', 'mes'] as const;
type Vista = 'mes' | 'cronograma' | 'lista';

/**
 * Calendario de personal:
 * - Mes: cada día muestra quiénes no están (fotos) y se tiñe según la proporción de ausentes.
 * - Cronograma: grilla agente × día del mes (duración de cada licencia).
 * - Lista: listado cronológico del mes.
 */
export default function CalendarioPage() {
  const navigate = useNavigate();
  const { filtros, setFiltros, limpiar, lista } = useFiltrosUrl(FILTROS);
  const vista: Vista = filtros.vista === 'cronograma' || filtros.vista === 'lista' ? filtros.vista : 'mes';
  const mes = filtros.mes && dayjs(`${filtros.mes}-01`).isValid() ? dayjs(`${filtros.mes}-01`) : dayjs().startOf('month');
  const [rangoVisible, setRangoVisible] = useState<{ desde: string; hasta: string } | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<InfoDia | null>(null);
  const { data: categorias = [] } = categoriasApi.useTodos({ activo: true });

  const filtrosApi = { unidad: filtros.unidad, modalidad: filtros.modalidad, categoria: filtros.categoria, empleado: filtros.empleado };
  // La vista mensual incluye los días de los meses vecinos que muestra la cuadrícula.
  const rango =
    vista === 'mes' && rangoVisible
      ? rangoVisible
      : { desde: mes.startOf('month').format('YYYY-MM-DD'), hasta: mes.endOf('month').format('YYYY-MM-DD') };
  const { data, isFetching } = useEventosCalendario({ ...rango, ...filtrosApi }, true);

  const dias = useMemo(
    () => (data ? construirDias(data.desde, data.hasta, data.novedades, data.no_laborables) : new Map<string, InfoDia>()),
    [data],
  );
  const total = data?.total_empleados ?? 0;

  // Agentes distintos por categoría con alguna novedad dentro del mes (las abiertas, hasta hoy).
  const agentesPorCategoria = useMemo(() => {
    const conteo = new Map<number, Set<number>>();
    const inicio = mes.startOf('month').format('YYYY-MM-DD');
    const fin = mes.endOf('month').format('YYYY-MM-DD');
    const hoy = dayjs().format('YYYY-MM-DD');
    data?.novedades.forEach((n) => {
      const hasta = n.hasta ?? (n.desde > hoy ? n.desde : hoy);
      if (n.desde > fin || hasta < inicio) return;
      conteo.set(n.categoria_id, (conteo.get(n.categoria_id) ?? new Set()).add(n.empleado_id));
    });
    return new Map([...conteo].map(([id, empleados]) => [id, empleados.size]));
  }, [data, mes]);
  const ordenCategorias = categorias.map((c) => c.id);

  const eventosLista = useMemo<EventInput[]>(() => {
    if (!data) return [];
    const hoy = dayjs().format('YYYY-MM-DD');
    return data.novedades.map((n) => {
      // Las abiertas se muestran hasta hoy (su fin es desconocido).
      const fin = n.hasta ?? (n.desde > hoy ? n.desde : hoy);
      return {
        id: String(n.id),
        title: `${n.empleado} · ${n.tipo}${n.abierta ? ' (abierta)' : ''}`,
        start: n.desde,
        end: dayjs(fin).add(1, 'day').format('YYYY-MM-DD'),
        allDay: true,
        backgroundColor: n.color,
        borderColor: n.color,
        extendedProps: { empleadoId: n.empleado_id },
      };
    });
  }, [data]);

  const irAMes = (m: dayjs.Dayjs) => setFiltros({ mes: m.isSame(dayjs(), 'month') ? undefined : m.format('YYYY-MM') });

  const alCambiarFechas = (inicio: Date, fin: Date, inicioMes: Date) => {
    setRangoVisible({ desde: dayjs(inicio).format('YYYY-MM-DD'), hasta: dayjs(fin).subtract(1, 'day').format('YYYY-MM-DD') });
    const nuevoMes = dayjs(inicioMes);
    if (!nuevoMes.isSame(mes, 'month')) irAMes(nuevoMes);
  };

  return (
    <>
      <PageHeader
        titulo="Calendario de personal"
        subtitulo="Quiénes no están cada día: vacaciones, licencias, ausencias, feriados y asuetos"
        acciones={
          <Segmented
            value={vista}
            onChange={(v) => setFiltros({ vista: v === 'mes' ? undefined : String(v) })}
            options={[
              { label: 'Mes', value: 'mes', icon: <AppstoreOutlined /> },
              { label: 'Cronograma', value: 'cronograma', icon: <TableOutlined /> },
              { label: 'Lista', value: 'lista', icon: <UnorderedListOutlined /> },
            ]}
          />
        }
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="260px">
            <UnidadSelect multiple style={{ width: '100%' }} value={lista('unidad').map(Number)} onChange={(v: number[]) => setFiltros({ unidad: v })} />
          </Col>
          <Col flex="200px">
            <ModalidadSelect mode="multiple" style={{ width: '100%' }} value={lista('modalidad').map(Number)} onChange={(v) => setFiltros({ modalidad: v })} />
          </Col>
          <Col flex="200px">
            <CategoriaSelect mode="multiple" style={{ width: '100%' }} value={lista('categoria').map(Number)} onChange={(v) => setFiltros({ categoria: v })} />
          </Col>
          <Col flex="240px">
            <EmpleadoSelect mode="multiple" style={{ width: '100%' }} value={lista('empleado').map(Number)} onChange={(v) => setFiltros({ empleado: v })} />
          </Col>
          <Col>
            <Button icon={<ClearOutlined />} onClick={() => limpiar()}>
              Limpiar
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Referencias de colores, con el mismo formato que las tarjetas del dashboard. */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {categorias.map((c) => {
          const activa = lista('categoria').includes(String(c.id));
          return (
            <Col key={c.id} xs={12} sm={8} flex="1 1 120px">
              <Tooltip title={`Agentes con ${c.nombre.toLowerCase()} en ${mes.format('MMMM')}. Clic para filtrar.`}>
                <Card
                  size="small"
                  className={`kpi-card ${activa ? 'activa' : ''}`}
                  style={{ borderTopColor: c.color }}
                  onClick={() => {
                    const actuales = lista('categoria');
                    setFiltros({ categoria: activa ? actuales.filter((x) => x !== String(c.id)) : [...actuales, String(c.id)] });
                  }}
                >
                  <Statistic
                    title={
                      <>
                        <span className="leyenda-punto" style={{ background: c.color }} /> {c.nombre}
                      </>
                    }
                    value={agentesPorCategoria.get(c.id) ?? 0}
                    valueStyle={{ color: agentesPorCategoria.get(c.id) ? c.color : undefined }}
                  />
                </Card>
              </Tooltip>
            </Col>
          );
        })}
        {vista === 'mes' && (
          <Col xs={12} sm={8} flex="1 1 120px">
            <Tooltip title="El fondo de cada día se tiñe de rojo según la proporción de personal ausente.">
              <Card size="small" className="kpi-card leyenda-tinte-card" style={{ borderTopColor: '#f5222d', cursor: 'default' }}>
                <Statistic title="Días con más ausencias" valueRender={() => <span className="leyenda-tinte-barra" />} />
              </Card>
            </Tooltip>
          </Col>
        )}
      </Row>

      <Card size="small">
        {vista === 'cronograma' ? (
          <>
            <div className="calendario-navegacion">
              <Space>
                <Button icon={<LeftOutlined />} onClick={() => irAMes(mes.subtract(1, 'month'))} />
                <Button icon={<RightOutlined />} onClick={() => irAMes(mes.add(1, 'month'))} />
                <Button disabled={mes.isSame(dayjs(), 'month')} onClick={() => irAMes(dayjs())}>
                  Hoy
                </Button>
              </Space>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {mes.format('MMMM [de] YYYY').replace(/^./, (c) => c.toUpperCase())}
              </Typography.Title>
              <span />
            </div>
            <GrillaPeriodo
              params={{
                desde: mes.startOf('month').format('YYYY-MM-DD'),
                hasta: mes.endOf('month').format('YYYY-MM-DD'),
                unidad: filtros.unidad,
                modalidad: filtros.modalidad,
                empleado: filtros.empleado,
                estado: filtros.categoria,
              }}
              categorias={categorias}
              ocultarLeyenda
            />
          </>
        ) : (
          <Spin spinning={isFetching}>
            <FullCalendar
              key={vista}
              plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
              locale={esLocale}
              initialView={vista === 'mes' ? 'dayGridMonth' : 'listMonth'}
              initialDate={mes.toDate()}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              buttonText={{ today: 'Hoy' }}
              height="auto"
              firstDay={1}
              fixedWeekCount={false}
              events={vista === 'lista' ? eventosLista : []}
              noEventsContent="Sin novedades en el mes"
              datesSet={(info) => alCambiarFechas(info.start, info.end, info.view.currentStart)}
              dayCellContent={
                vista === 'mes'
                  ? (arg) => (
                      <CeldaDia
                        numero={arg.dayNumberText}
                        info={dias.get(dayjs(arg.date).format('YYYY-MM-DD'))}
                        total={total}
                        esHoy={arg.isToday}
                        ordenCategorias={ordenCategorias}
                      />
                    )
                  : undefined
              }
              dateClick={(arg) => {
                const info = dias.get(dayjs(arg.date).format('YYYY-MM-DD'));
                if (info) setDiaSeleccionado(info);
              }}
              eventClick={(info) => navigate(`/personal/${info.event.extendedProps.empleadoId}`)}
            />
          </Spin>
        )}
      </Card>

      <DetalleDiaDrawer info={diaSeleccionado} total={total} ordenCategorias={ordenCategorias} onClose={() => setDiaSeleccionado(null)} />
    </>
  );
}
