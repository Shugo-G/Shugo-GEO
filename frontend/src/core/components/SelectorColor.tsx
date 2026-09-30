import { Button, ColorPicker, Tooltip } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';

/**
 * Paleta predefinida (colores de Ant Design, legibles sobre fondo claro). No
 * incluye el verde de "Activo" para que ningún artículo se confunda con él.
 */
export const PALETA: { color: string; nombre: string }[] = [
  { color: '#f5222d', nombre: 'Rojo' },
  { color: '#a8071a', nombre: 'Bordó' },
  { color: '#fa541c', nombre: 'Naranja oscuro' },
  { color: '#fa8c16', nombre: 'Naranja' },
  { color: '#faad14', nombre: 'Dorado' },
  { color: '#d4b106', nombre: 'Amarillo' },
  { color: '#7cb305', nombre: 'Lima' },
  { color: '#13c2c2', nombre: 'Turquesa' },
  { color: '#08979c', nombre: 'Verde azulado' },
  { color: '#1677ff', nombre: 'Azul' },
  { color: '#003eb3', nombre: 'Azul oscuro' },
  { color: '#2f54eb', nombre: 'Índigo' },
  { color: '#722ed1', nombre: 'Violeta' },
  { color: '#eb2f96', nombre: 'Rosa' },
  { color: '#9e1068', nombre: 'Magenta' },
  { color: '#8c6d4f', nombre: 'Marrón' },
  { color: '#8c8c8c', nombre: 'Gris' },
  { color: '#434343', nombre: 'Gris oscuro' },
];

interface Props {
  value?: string;
  onChange?: (color: string) => void;
}

/** Elección de color: un clic en la paleta o "Otro color" para elegirlo libremente. */
export default function SelectorColor({ value, onChange }: Props) {
  const actual = (value ?? '').toLowerCase();
  const personalizado = !!actual && !PALETA.some((p) => p.color === actual);
  return (
    <div className="selector-color">
      {PALETA.map((p) => (
        <Tooltip key={p.color} title={p.nombre}>
          <button
            type="button"
            className={`color-muestra ${actual === p.color ? 'elegido' : ''}`}
            style={{ background: p.color }}
            aria-label={p.nombre}
            onClick={() => onChange?.(p.color)}
          >
            {actual === p.color && <CheckOutlined style={{ fontSize: 12 }} />}
          </button>
        </Tooltip>
      ))}
      <ColorPicker value={value} format="hex" disabledAlpha onChangeComplete={(c) => onChange?.(c.toHexString())}>
        <Button
          size="small"
          icon={personalizado ? <span className="color-muestra elegido" style={{ background: value, width: 14, height: 14 }} /> : <BgColorsOutlined />}
        >
          Otro color
        </Button>
      </ColorPicker>
    </div>
  );
}
