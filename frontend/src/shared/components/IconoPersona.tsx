interface Props {
  /** Color del estado del agente (verde si está activo, el del artículo de licencia si no). */
  color: string;
  tamanio?: number;
  titulo?: string;
}

/** Silueta de persona pintada con el color del estado; reemplaza a las fotos. */
export default function IconoPersona({ color, tamanio = 40, titulo }: Props) {
  return (
    <span className="icono-persona" style={{ width: tamanio, height: tamanio, background: `${color}1f` }} title={titulo}>
      <svg viewBox="0 0 24 24" width={tamanio * 0.62} height={tamanio * 0.62} aria-hidden="true" fill={color}>
        <circle cx="12" cy="7.5" r="4.5" />
        <path d="M3 21.5c0-4.97 4.03-8 9-8s9 3.03 9 8z" />
      </svg>
    </span>
  );
}
