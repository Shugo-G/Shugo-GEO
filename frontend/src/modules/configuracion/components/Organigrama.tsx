import { Tag, Tooltip, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import type { NodoUnidad } from '@/shared/api/catalogos';

interface Props {
  arbol: NodoUnidad[];
  /** Clic en una unidad (p. ej. para editarla). */
  onElegir?: (nodo: NodoUnidad) => void;
}

const COLORES: Record<string, string> = { DIRECCION_GENERAL: '#1f4e79', DIRECCION: '#1677ff', AREA: '#13c2c2' };

/** "DIRECCIÓN DE SISTEMAS" → ["DIRECCIÓN", "DE SISTEMAS"]: el nombre se parte antes del primer "de". */
function enDosRenglones(nombre: string): [string, string?] {
  const partes = nombre.trim().match(/^(.+?)\s+(de\s.+)$/i);
  return partes ? [partes[1], partes[2]] : [nombre];
}

/**
 * Las unidades que dependen directo del padre (sin ser direcciones) van al medio
 * y las direcciones se reparten hacia las puntas, respetando su orden.
 */
function ordenarHijos(hijos: NodoUnidad[]): NodoUnidad[] {
  const direcciones = hijos.filter((h) => h.tipo === 'DIRECCION');
  const directas = hijos.filter((h) => h.tipo !== 'DIRECCION');
  if (!direcciones.length || !directas.length) return hijos;
  const mitad = Math.ceil(direcciones.length / 2);
  return [...direcciones.slice(0, mitad), ...directas, ...direcciones.slice(mitad)];
}

function Nodo({ nodo, onElegir }: { nodo: NodoUnidad; onElegir?: (nodo: NodoUnidad) => void }) {
  const [renglon1, renglon2] = enDosRenglones(nodo.nombre);
  return (
    <li>
      <div
        className={`organigrama-nodo ${nodo.activo ? '' : 'inactiva'} ${onElegir ? 'elegible' : ''}`}
        style={{ borderTopColor: COLORES[nodo.tipo] }}
        onClick={() => onElegir?.(nodo)}
        role={onElegir ? 'button' : undefined}
        tabIndex={onElegir ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onElegir?.(nodo)}
      >
        <Typography.Text strong className="organigrama-nombre">
          {renglon1}
          {renglon2 && (
            <>
              <br />
              {renglon2}
            </>
          )}
        </Typography.Text>
        <div className="organigrama-detalle">
          <Tooltip title="Agentes activos directos / incluyendo sus dependientes">
            <span>
              <b>{nodo.empleados}</b>
              <Typography.Text type="secondary"> / {nodo.empleados_total}</Typography.Text>
            </span>
          </Tooltip>
        </div>
        {nodo.creada && (
          <div className="organigrama-acto">
            <CheckCircleFilled style={{ color: '#52c41a' }} /> {nodo.acto_administrativo}
          </div>
        )}
        {!nodo.activo && <Tag style={{ marginTop: 4 }}>Inactiva</Tag>}
      </div>
      {nodo.children.length > 0 && (
        <ul>
          {ordenarHijos(nodo.children).map((h) => (
            <Nodo key={h.id} nodo={h} onElegir={onElegir} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Estructura organizativa dibujada como organigrama (árbol de arriba hacia abajo). */
export default function Organigrama({ arbol, onElegir }: Props) {
  return (
    <div className="organigrama">
      <ul>
        {arbol.map((raiz) => (
          <Nodo key={raiz.id} nodo={raiz} onElegir={onElegir} />
        ))}
      </ul>
    </div>
  );
}
