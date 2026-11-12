import { Tag, Tooltip, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { TIPOS_UNIDAD, type NodoUnidad } from '@/shared/api/catalogos';

interface Props {
  arbol: NodoUnidad[];
  /** Clic en una unidad (p. ej. para editarla). */
  onElegir?: (nodo: NodoUnidad) => void;
}

const COLORES: Record<string, string> = { DIRECCION_GENERAL: '#1f4e79', DIRECCION: '#1677ff', AREA: '#13c2c2' };

function Nodo({ nodo, onElegir }: { nodo: NodoUnidad; onElegir?: (nodo: NodoUnidad) => void }) {
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
          {nodo.nombre}
        </Typography.Text>
        <div className="organigrama-detalle">
          <Tag color={TIPOS_UNIDAD.find((t) => t.value === nodo.tipo)?.color} bordered={false} style={{ marginInlineEnd: 0 }}>
            {nodo.tipo_display}
          </Tag>
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
          {nodo.children.map((h) => (
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
