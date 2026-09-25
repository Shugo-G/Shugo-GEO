import type { AppModule } from './types';
import dashboard from './dashboard';
import personal from './personal';
import novedades from './novedades';
import vacaciones from './vacaciones';
import calendario from './calendario';
import patrimonio from './patrimonio';
import reportes from './reportes';
import configuracion from './configuracion';

/** Registro de módulos. Agregar acá cada módulo nuevo. */
export const modulos: AppModule[] = [dashboard, personal, novedades, vacaciones, calendario, patrimonio, reportes, configuracion].sort(
  (a, b) => a.orden - b.orden,
);
