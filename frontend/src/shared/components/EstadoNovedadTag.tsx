import { Tag, Tooltip } from 'antd';
import { fmtFecha, fmtFechaHora } from '@/core/utils/format';
import { ESTADOS_NOVEDAD, type Novedad } from '@/shared/api/novedades';

/** Estado del registro (Programada, En curso, Finalizada, Interrumpida, Anulada) con su detalle. */
export default function EstadoNovedadTag({ novedad }: { novedad: Novedad }) {
  const { label, color } = ESTADOS_NOVEDAD[novedad.estado];
  let detalle: string | null = null;
  if (novedad.estado === 'INTERRUMPIDA') {
    detalle = [
      `Fin previsto: ${fmtFecha(novedad.fecha_hasta_original)}`,
      novedad.dias_reintegrados ? `${novedad.dias_reintegrados} día(s) reintegrados` : null,
      novedad.motivo_interrupcion || null,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (novedad.estado === 'ANULADA') {
    detalle = `Anulada el ${fmtFechaHora(novedad.fecha_anulacion)} por ${novedad.anulada_por_nombre ?? '—'}: ${novedad.motivo_anulacion}`;
  } else if (novedad.abierta) {
    detalle = 'Sin fecha de fin (abierta)';
  }
  const tag = (
    <Tag color={color} bordered={false}>
      {label}
      {novedad.abierta && novedad.estado === 'EN_CURSO' ? ' · abierta' : ''}
    </Tag>
  );
  return detalle ? <Tooltip title={detalle}>{tag}</Tooltip> : tag;
}
