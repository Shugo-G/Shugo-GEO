import { Link } from 'react-router-dom';
import { Alert, Badge, Divider, Drawer, Empty, List, Statistic, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { fmtFecha } from '@/core/utils/format';
import { COLOR_ACTIVO } from '@/app/theme';
import IconoPersona from '@/shared/components/IconoPersona';
import type { EventoNovedad } from './api';
import type { InfoDia } from './dias';

interface Props {
  info: InfoDia | null;
  total: number;
  ordenArticulos: number[];
  onClose: () => void;
}

/** Quiénes no están un día determinado, agrupados por artículo de licencia. */
export default function DetalleDiaDrawer({ info, total, ordenArticulos, onClose }: Props) {
  const grupos = new Map<number, EventoNovedad[]>();
  info?.novedades.forEach((n) => grupos.set(n.tipo_id, [...(grupos.get(n.tipo_id) ?? []), n]));
  const ordenados = [...grupos.entries()].sort(([a], [b]) => ordenArticulos.indexOf(a) - ordenArticulos.indexOf(b));
  const fecha = info ? dayjs(info.fecha).format('dddd D [de] MMMM [de] YYYY') : '';
  const titulo = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <Drawer
      open={!!info}
      onClose={onClose}
      width={440}
      title={titulo}
    >
      {info && (
        <>
          {info.noLaborable && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${info.noLaborable.tipo_display}: ${info.noLaborable.motivo}`}
              description={info.noLaborable.norma || undefined}
            />
          )}
          {!info.laborable && !info.noLaborable && <Alert type="info" showIcon message="Fin de semana" style={{ marginBottom: 16 }} />}
          {info.laborable && (
            <div style={{ display: 'flex', gap: 32, marginBottom: 8 }}>
              <Statistic title="Trabajando" value={total - info.ausentes} suffix={`/ ${total}`} valueStyle={{ color: COLOR_ACTIVO }} />
              <Statistic title="Ausentes" value={info.ausentes} valueStyle={{ color: info.ausentes ? '#f5222d' : undefined }} />
            </div>
          )}
          {info.laborable && !info.novedades.length && <Empty description="Todo el personal está disponible" />}
          {ordenados.map(([tipoId, novedades]) => (
            <div key={tipoId}>
              <Divider orientation="left" plain style={{ margin: '12px 0 4px' }}>
                <Badge color={novedades[0].color} text={`${novedades[0].tipo} (${novedades.length})`} />
              </Divider>
              <List
                size="small"
                dataSource={[...novedades].sort((a, b) => a.empleado.localeCompare(b.empleado))}
                renderItem={(n) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<IconoPersona color={n.color} tamanio={40} />}
                      title={<Link to={`/personal/${n.empleado_id}`}>{n.empleado}</Link>}
                      description={
                        <>
                          <div>{n.unidad}</div>
                          <div>
                            <Typography.Text type="secondary">
                              {fmtFecha(n.desde)} → {n.hasta ? fmtFecha(n.hasta) : <Tag color="red" bordered={false}>abierta</Tag>}
                            </Typography.Text>
                          </div>
                          {n.motivo && <Typography.Text type="secondary">{n.motivo}</Typography.Text>}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          ))}
        </>
      )}
    </Drawer>
  );
}
