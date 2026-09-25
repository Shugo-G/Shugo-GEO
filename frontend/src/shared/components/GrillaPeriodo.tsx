import { Badge, Empty, Space, Spin, Tooltip, Typography } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Params } from '@/core/api/types';
import { COLOR_ACTIVO } from '@/app/theme';
import { useGrilla } from '@/shared/api/grilla';
import FotoEmpleado from './FotoEmpleado';

interface Props {
  params: Params;
  /** Para la leyenda de colores. */
  categorias: { id: number; nombre: string; color: string }[];
  /** Cuando la página ya muestra la leyenda de colores. */
  ocultarLeyenda?: boolean;
}

/**
 * Grilla empleado × día. Responde "¿cómo estará conformado el equipo durante
 * un determinado período?" y muestra cuántos agentes trabajan cada día hábil.
 */
export default function GrillaPeriodo({ params, categorias, ocultarLeyenda = false }: Props) {
  const { data, isLoading, isFetching } = useGrilla(params, true);
  const hoy = dayjs().format('YYYY-MM-DD');

  if (isLoading) return <Spin style={{ display: 'block', margin: 40 }} />;
  if (!data?.empleados.length) return <Empty description="Sin empleados para los filtros seleccionados" />;

  return (
    <Spin spinning={isFetching && !isLoading}>
      <Space wrap size={16} style={{ marginBottom: 12, display: ocultarLeyenda ? 'none' : undefined }}>
        <Badge color={COLOR_ACTIVO} text="Trabajando (celda vacía)" />
        {categorias.map((c) => (
          <Badge key={c.id} color={c.color} text={c.nombre} />
        ))}
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#f0f0f0', borderRadius: 2, marginRight: 6 }} />
          No laborable
        </span>
      </Space>
      <div className="grilla-wrapper">
        <table className="grilla">
          <thead>
            <tr>
              <th className="col-empleado">Empleado</th>
              {data.dias.map((d) => {
                const fecha = dayjs(d.fecha);
                const noHabil = d.fin_de_semana || !!d.no_laborable;
                return (
                  <th key={d.fecha} className={`${noHabil ? 'no-habil' : ''} ${d.fecha === hoy ? 'hoy' : ''}`}>
                    <Tooltip title={d.no_laborable ? `${d.no_laborable.tipo}: ${d.no_laborable.motivo}` : fecha.format('dddd DD/MM/YYYY')}>
                      <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{fecha.format('dd')}</div>
                      <div>{fecha.format('D')}</div>
                      {fecha.date() === 1 || d.fecha === data.desde ? (
                        <div style={{ fontSize: 10, color: '#8c8c8c' }}>{fecha.format('MMM')}</div>
                      ) : null}
                    </Tooltip>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.empleados.map((emp) => (
              <tr key={emp.id}>
                <td className="col-empleado">
                  <FotoEmpleado url={emp.foto_url} nombre={emp.nombre} tamanio={22} />{' '}
                  <Link to={`/personal/${emp.id}`}>{emp.nombre}</Link>
                  <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                    {emp.unidad}
                  </Typography.Text>
                </td>
                {data.dias.map((d) => {
                  const celdas = emp.celdas[d.fecha];
                  const noHabil = d.fin_de_semana || !!d.no_laborable;
                  return (
                    <td key={d.fecha} className={`${noHabil ? 'no-habil' : ''} ${d.fecha === hoy ? 'hoy' : ''}`}>
                      {celdas && (
                        <Tooltip title={celdas.map((c) => c.tipo).join(' + ')}>
                          <div className="celda">
                            {celdas.map((c) => (
                              <span key={c.novedad_id} style={{ background: c.color, opacity: noHabil ? 0.45 : 0.9 }} />
                            ))}
                          </div>
                        </Tooltip>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="col-empleado">Trabajando</td>
              {data.dias.map((d) => (
                <td key={d.fecha} className={d.fin_de_semana || d.no_laborable ? 'no-habil' : ''}>
                  {d.fin_de_semana || d.no_laborable ? '—' : d.trabajando}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Spin>
  );
}
