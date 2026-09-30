import { useMemo, useState } from 'react';
import { Segmented, Spin, Tooltip } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventInput } from '@fullcalendar/core';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Params } from '@/core/api/types';
import { tiposNovedadApi } from '@/shared/api/catalogos';
import { useEventosCalendario } from './api';
import CeldaDia from './CeldaDia';
import DetalleDiaDrawer from './DetalleDiaDrawer';
import { construirDias, type InfoDia } from './dias';

export type VistaCalendario = 'mes' | 'lista';

interface Props {
  /** Filtros del Inicio (unidad, modalidad, empleado) y artículos de licencia elegidos. */
  filtros: Params & { tipo?: string };
  /** Primer día del mes que se muestra. */
  mes: dayjs.Dayjs;
  onCambiarMes: (mes: dayjs.Dayjs) => void;
  vista: VistaCalendario;
  onCambiarVista: (vista: VistaCalendario) => void;
}

/**
 * Pestaña Calendario del Inicio:
 * - Mes: cada día muestra quiénes no están (con el color de su licencia) y se
 *   tiñe según la proporción de ausentes.
 * - Lista: listado cronológico del mes.
 * El cronograma agente × día es la pestaña "Vista por período".
 */
export default function CalendarioMensual({ filtros, mes, onCambiarMes, vista, onCambiarVista }: Props) {
  const navigate = useNavigate();
  const [rangoVisible, setRangoVisible] = useState<{ desde: string; hasta: string } | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<InfoDia | null>(null);
  const { data: articulos = [] } = tiposNovedadApi.useTodos({ activo: true });

  // La vista mensual incluye los días de los meses vecinos que muestra la cuadrícula.
  const rango =
    vista === 'mes' && rangoVisible
      ? rangoVisible
      : { desde: mes.startOf('month').format('YYYY-MM-DD'), hasta: mes.endOf('month').format('YYYY-MM-DD') };
  const { data, isFetching } = useEventosCalendario({ ...rango, ...filtros }, true);

  const dias = useMemo(
    () => (data ? construirDias(data.desde, data.hasta, data.novedades, data.no_laborables) : new Map<string, InfoDia>()),
    [data],
  );
  const total = data?.total_empleados ?? 0;
  const ordenArticulos = articulos.map((t) => t.id);

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

  const alCambiarFechas = (inicio: Date, fin: Date, inicioMes: Date) => {
    setRangoVisible({ desde: dayjs(inicio).format('YYYY-MM-DD'), hasta: dayjs(fin).subtract(1, 'day').format('YYYY-MM-DD') });
    const nuevoMes = dayjs(inicioMes);
    if (!nuevoMes.isSame(mes, 'month')) onCambiarMes(nuevoMes);
  };

  return (
    <>
      {/* Las tarjetas de estado son las del Inicio (arriba de las pestañas); acá sólo la vista y la referencia del tinte. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, margin: '4px 0 12px' }}>
        {vista === 'mes' && (
          <Tooltip title="El fondo de cada día se tiñe de rojo según la proporción de personal ausente.">
            <span className="leyenda-tinte-texto">
              <span className="leyenda-tinte-barra" /> Días con más ausencias
            </span>
          </Tooltip>
        )}
        <Segmented
          value={vista}
          onChange={(v) => onCambiarVista(v as VistaCalendario)}
          options={[
            { label: 'Mes', value: 'mes', icon: <AppstoreOutlined /> },
            { label: 'Lista', value: 'lista', icon: <UnorderedListOutlined /> },
          ]}
        />
      </div>

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
          noEventsContent="Sin licencias en el mes"
          datesSet={(info) => alCambiarFechas(info.start, info.end, info.view.currentStart)}
          dayCellContent={
            vista === 'mes'
              ? (arg) => (
                  <CeldaDia
                    numero={arg.dayNumberText}
                    info={dias.get(dayjs(arg.date).format('YYYY-MM-DD'))}
                    total={total}
                    esHoy={arg.isToday}
                    ordenArticulos={ordenArticulos}
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

      <DetalleDiaDrawer info={diaSeleccionado} total={total} ordenArticulos={ordenArticulos} onClose={() => setDiaSeleccionado(null)} />
    </>
  );
}
