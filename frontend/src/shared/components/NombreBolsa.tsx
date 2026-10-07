import type { Saldo } from '@/core/api/types';

/** "Licencia vacaciones + Licencia invernal": nombre legible de una bolsa de días. */
export const nombreBolsa = (saldo: Pick<Saldo, 'tipo' | 'incluye' | 'anio'>) =>
  [saldo.tipo, ...saldo.incluye].join(' + ') + (saldo.anio ? ` · ${saldo.anio}` : '');
