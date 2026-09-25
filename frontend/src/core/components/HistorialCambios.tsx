import { Empty, Spin, Timeline, Typography } from 'antd';
import type { CambioHistorial } from '@/core/api/types';
import { fmtFechaHora } from '@/core/utils/format';

const COLORES: Record<string, string> = { Alta: 'green', Modificación: 'blue', Baja: 'red' };

/** Línea de tiempo con el historial de modificaciones de un registro (auditoría). */
export default function HistorialCambios({ datos, cargando }: { datos?: CambioHistorial[]; cargando?: boolean }) {
  if (cargando) return <Spin />;
  if (!datos?.length) return <Empty description="Sin cambios registrados" />;
  return (
    <Timeline
      items={datos.map((h) => ({
        color: COLORES[h.tipo] ?? 'gray',
        children: (
          <>
            <Typography.Text strong>{h.tipo}</Typography.Text>{' '}
            <Typography.Text type="secondary">
              {fmtFechaHora(h.fecha)} · {h.usuario ?? 'sistema'}
            </Typography.Text>
            {h.cambios.map((c) => (
              <div key={c.campo} style={{ fontSize: 13 }}>
                <b>{c.campo}:</b> <Typography.Text delete type="secondary">{c.anterior}</Typography.Text> → {c.nuevo}
              </div>
            ))}
          </>
        ),
      }))}
    />
  );
}
