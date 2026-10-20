import type { ReactNode } from 'react';

const COLORES = ['#f5222d', '#faad14', '#1677ff', '#52c41a', '#eb2f96', '#722ed1', '#13c2c2', '#fa8c16'];

/** Papelitos que caen sobre la tarjeta (posiciones fijas: se ve igual en cada render). */
export function Confeti() {
  return (
    <span className="confeti" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 47) % 100}%`,
            background: COLORES[i % COLORES.length],
            animationDelay: `${((i * 0.43) % 3).toFixed(2)}s`,
            animationDuration: `${(2.6 + ((i * 0.37) % 1.6)).toFixed(2)}s`,
            width: i % 3 === 0 ? 5 : 7,
            height: i % 3 === 0 ? 9 : 5,
          }}
        />
      ))}
    </span>
  );
}

/** Gorrito de cumpleaños sobre el ícono de la persona. */
export function ConGorro({ children }: { children: ReactNode }) {
  return (
    <span className="con-gorro">
      {children}
      <svg className="gorro" viewBox="0 0 40 48" aria-hidden="true">
        <defs>
          <clipPath id="gorro-forma">
            <path d="M20 2 L37 44 Q20 49 3 44 Z" />
          </clipPath>
        </defs>
        <path d="M20 2 L37 44 Q20 49 3 44 Z" fill="#722ed1" />
        <g clipPath="url(#gorro-forma)">
          <path d="M0 18 L40 10 L40 16 L0 24 Z" fill="#faad14" />
          <path d="M0 32 L40 24 L40 30 L0 38 Z" fill="#eb2f96" />
        </g>
        <circle cx="20" cy="4" r="4" fill="#faad14" />
      </svg>
    </span>
  );
}

/** Listón en la esquina superior izquierda: no agrega renglones a la tarjeta. */
export function ListonCumple() {
  return (
    <span className="liston-cumple" aria-label="Feliz cumpleaños">
      <span>¡Feliz cumpleaños!</span>
    </span>
  );
}
