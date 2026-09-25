import dayjs, { type Dayjs } from 'dayjs';

export const FORMATO_FECHA = 'DD/MM/YYYY';
export const FORMATO_API = 'YYYY-MM-DD';

export const fmtFecha = (valor?: string | null) => (valor ? dayjs(valor).format(FORMATO_FECHA) : '—');
export const fmtFechaCorta = (valor?: string | null) => (valor ? dayjs(valor).format('DD/MM') : '—');
export const fmtFechaHora = (valor?: string | null) => (valor ? dayjs(valor).format('DD/MM/YYYY HH:mm') : '—');
export const aApi = (valor?: Dayjs | null) => (valor ? valor.format(FORMATO_API) : undefined);
export const deApi = (valor?: string | null) => (valor ? dayjs(valor) : null);
export const hoyApi = () => dayjs().format(FORMATO_API);

export const fmtTamanio = (bytes?: number | null) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
