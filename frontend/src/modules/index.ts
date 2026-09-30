import type { AppModule } from './types';
import dashboard from './dashboard';
import personal from './personal';
import novedades from './novedades';
import vacaciones from './vacaciones';
import patrimonio from './patrimonio';
import servicios from './servicios';
import reportes from './reportes';
import configuracion from './configuracion';

/** Registro de módulos. Agregar acá cada módulo nuevo. */
export const modulos: AppModule[] = [dashboard, personal, novedades, vacaciones, patrimonio, servicios, reportes, configuracion].sort(
  (a, b) => a.orden - b.orden,
);
