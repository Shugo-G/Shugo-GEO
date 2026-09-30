import { Tooltip } from 'antd';
import type { EventoNovedad } from './api';
import type { InfoDia } from './dias';

const MAX_ETIQUETAS = 5;

interface Props {
  numero: string;
  info?: InfoDia;
  total: number;
  esHoy: boolean;
  ordenArticulos: number[];
}

/** "Fernández, Lucía" → "Fernández, L." */
function nombreCorto(nombreCompleto: string): string {
  const [apellido, nombre = ''] = nombreCompleto.split(',').map((s) => s.trim());
  return nombre ? `${apellido}, ${nombre.charAt(0)}.` : apellido;
}

/**
 * Contenido de un día en la vista mensual: número, feriado, cantidad de
 * ausentes y una etiqueta por agente con el color de su licencia. El fondo se
 * tiñe según la proporción de ausentes para anticipar días críticos.
 */
export default function CeldaDia({ numero, info, total, esHoy, ordenArticulos }: Props) {
  const proporcion = info && total ? info.ausentes / total : 0;
  const tinte = info?.laborable && proporcion > 0 ? `rgba(245, 34, 45, ${Math.min(0.03 + proporcion * 0.35, 0.22)})` : undefined;
  const posicion = (n: EventoNovedad) => {
    const i = ordenArticulos.indexOf(n.tipo_id);
    return i === -1 ? ordenArticulos.length : i;
  };
  const novedades = [...(info?.novedades ?? [])].sort(
    (a, b) => posicion(a) - posicion(b) || a.empleado.localeCompare(b.empleado),
  );
  const restantes = novedades.length - MAX_ETIQUETAS;

  return (
    <div className={`celda-dia ${info?.laborable ? '' : 'celda-dia-no-laborable'}`} style={{ background: tinte }}>
      <div className="celda-dia-cabecera">
        {info?.noLaborable ? (
          <Tooltip title={`${info.noLaborable.tipo_display}${info.noLaborable.norma ? ` · ${info.noLaborable.norma}` : ''}`}>
            <span className="celda-dia-feriado">{info.noLaborable.motivo}</span>
          </Tooltip>
        ) : info && info.ausentes > 0 ? (
          <Tooltip title={`${info.ausentes} ausente(s) de ${total}`}>
            <span className="celda-dia-conteo">{info.ausentes} aus.</span>
          </Tooltip>
        ) : (
          <span />
        )}
        <span className={`celda-dia-numero ${esHoy ? 'hoy' : ''}`}>{numero}</span>
      </div>
      <div className="celda-dia-etiquetas">
        {novedades.slice(0, MAX_ETIQUETAS).map((n) => (
          <Tooltip key={n.id} title={`${n.empleado} · ${n.tipo}${n.abierta ? ' (abierta)' : ''}`}>
            <span className="celda-dia-etiqueta" style={{ borderLeftColor: n.color, background: `${n.color}1f` }}>
              {nombreCorto(n.empleado)}
            </span>
          </Tooltip>
        ))}
        {restantes > 0 && <span className="celda-dia-mas">+{restantes} más</span>}
      </div>
    </div>
  );
}
