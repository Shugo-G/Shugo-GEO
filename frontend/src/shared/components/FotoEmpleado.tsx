import { useState } from 'react';

/** Imagen que se muestra cuando el agente no tiene foto cargada. */
export const FOTO_PLACEHOLDER = '/avatar-placeholder.png';

interface Props {
  url?: string | null;
  nombre?: string;
  tamanio?: number;
  redondeada?: boolean;
}

/** Foto del agente (o el placeholder si no tiene / si falla la carga). */
export default function FotoEmpleado({ url, nombre = '', tamanio = 40, redondeada = true }: Props) {
  const [error, setError] = useState(false);
  return (
    <img
      src={url && !error ? url : FOTO_PLACEHOLDER}
      alt={nombre}
      width={tamanio}
      height={tamanio}
      onError={() => setError(true)}
      style={{
        width: tamanio,
        height: tamanio,
        objectFit: 'cover',
        borderRadius: redondeada ? '50%' : 8,
        flexShrink: 0,
        background: '#f3f3f7',
      }}
    />
  );
}
