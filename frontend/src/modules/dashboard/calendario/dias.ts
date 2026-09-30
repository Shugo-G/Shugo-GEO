import dayjs from 'dayjs';
import type { DiaNoLaborable } from '@/core/api/types';
import type { EventoNovedad } from './api';

export interface InfoDia {
  fecha: string;
  laborable: boolean;
  noLaborable?: DiaNoLaborable;
  /** Novedades vigentes ese día (sólo en días laborables). */
  novedades: EventoNovedad[];
  /** Cantidad de licencias vigentes ese día (agentes que no están trabajando). */
  ausentes: number;
}

/**
 * Arma, para cada día del rango, quiénes tienen una novedad vigente.
 * - Las novedades abiertas (sin fecha de fin) se muestran sólo hasta hoy:
 *   su finalización es desconocida y no se proyectan al futuro.
 * - En fines de semana y feriados no se listan ausencias (no son días de trabajo).
 */
export function construirDias(
  desde: string,
  hasta: string,
  novedades: EventoNovedad[],
  noLaborables: DiaNoLaborable[],
): Map<string, InfoDia> {
  const hoy = dayjs().format('YYYY-MM-DD');
  const feriados = new Map(noLaborables.map((d) => [d.fecha, d]));
  const dias = new Map<string, InfoDia>();

  for (let d = dayjs(desde); !d.isAfter(hasta, 'day'); d = d.add(1, 'day')) {
    const fecha = d.format('YYYY-MM-DD');
    const noLaborable = feriados.get(fecha);
    dias.set(fecha, { fecha, noLaborable, laborable: d.day() !== 0 && d.day() !== 6 && !noLaborable, novedades: [], ausentes: 0 });
  }

  for (const n of novedades) {
    const fin = n.hasta ?? (n.desde > hoy ? n.desde : hoy);
    const inicio = n.desde < desde ? desde : n.desde;
    const ultimo = fin > hasta ? hasta : fin;
    for (let d = dayjs(inicio); !d.isAfter(ultimo, 'day'); d = d.add(1, 'day')) {
      const info = dias.get(d.format('YYYY-MM-DD'));
      if (!info || !info.laborable) continue;
      info.novedades.push(n);
      info.ausentes += 1;
    }
  }
  return dias;
}
