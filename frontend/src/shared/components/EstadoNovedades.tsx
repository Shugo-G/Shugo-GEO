import { Badge, Space, Tag, Tooltip } from 'antd';
import type { NovedadResumen } from '@/core/api/types';
import { fmtFecha } from '@/core/utils/format';
import { COLOR_ACTIVO } from '@/app/theme';

/** Punto de color + texto, como en el ejemplo del requerimiento (🟢 Activo, 🟡 Vacaciones...). */
export function EstadoBadge({ color, texto }: { color: string; texto: string }) {
  return <Badge color={color} text={texto} />;
}

/**
 * Estado del empleado según sus novedades vigentes. Sin novedades = Activo.
 * Si hay novedades superpuestas se muestran todas.
 */
export function EstadoNovedades({ novedades, vertical = true }: { novedades: NovedadResumen[]; vertical?: boolean }) {
  if (!novedades.length) return <EstadoBadge color={COLOR_ACTIVO} texto="Activo" />;
  return (
    <Space direction={vertical ? 'vertical' : 'horizontal'} size={2} wrap>
      {novedades.map((n) => (
        <Tooltip
          key={n.id}
          title={
            <>
              {n.tipo}
              {n.motivo && <div>Motivo: {n.motivo}</div>}
              <div>
                {fmtFecha(n.desde)} → {n.hasta ? fmtFecha(n.hasta) : 'sin fecha de fin'}
              </div>
            </>
          }
        >
          <span>
            <EstadoBadge color={n.color} texto={n.tipo} />
            {!n.hasta && (
              <Tag color="red" bordered={false} style={{ marginLeft: 6, fontSize: 11 }}>
                abierta
              </Tag>
            )}
          </span>
        </Tooltip>
      ))}
    </Space>
  );
}
