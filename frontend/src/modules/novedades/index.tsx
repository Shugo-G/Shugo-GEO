import { lazy } from 'react';
import { ScheduleOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const novedades: AppModule = {
  key: 'novedades',
  orden: 20,
  menu: [
    { key: 'novedades', label: 'Licencias del personal', icon: <ScheduleOutlined />, path: '/novedades', permiso: 'novedades.view_novedad' },
  ],
  routes: [{ path: '/novedades', component: lazy(() => import('./pages/NovedadesPage')), permiso: 'novedades.view_novedad' }],
};

export default novedades;
