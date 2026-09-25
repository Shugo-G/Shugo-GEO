import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Guarda los filtros de una pantalla en la URL (?unidad=1,2&estado=...).
 * Permite compartir un enlace con los filtros aplicados y volver atrás sin perderlos.
 * Los valores múltiples se guardan separados por coma.
 */
export function useFiltrosUrl<K extends string>(claves: readonly K[], valoresIniciales: Partial<Record<K, string>> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filtros = useMemo(() => {
    const salida = {} as Record<K, string | undefined>;
    claves.forEach((clave) => {
      salida[clave] = searchParams.get(clave) ?? valoresIniciales[clave];
    });
    return salida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFiltros = useCallback(
    (cambios: Partial<Record<K, string | string[] | number[] | undefined | null>>) => {
      setSearchParams(
        (actual) => {
          const siguiente = new URLSearchParams(actual);
          Object.entries(cambios).forEach(([clave, valor]) => {
            const texto = Array.isArray(valor) ? valor.join(',') : valor;
            if (texto === undefined || texto === null || texto === '') siguiente.delete(clave);
            else siguiente.set(clave, String(texto));
          });
          return siguiente;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const limpiar = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  /** Convierte un filtro "1,2,3" en array de números para los Select múltiples. */
  const lista = useCallback((clave: K) => (filtros[clave] ? filtros[clave]!.split(',').filter(Boolean) : []), [filtros]);

  return { filtros, setFiltros, limpiar, lista };
}
