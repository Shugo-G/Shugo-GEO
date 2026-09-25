import { lazy } from 'react';
import { CalendarOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const PERMISO = ['novedades.view_novedad', 'calendario.view_dianolaborable'];

const calendario: AppModule = {
  key: 'calendario',
  orden: 40,
  menu: [{ key: 'calendario', label: 'Calendario', icon: <CalendarOutlined />, path: '/calendario', permiso: PERMISO }],
  routes: [{ path: '/calendario', component: lazy(() => import('./pages/CalendarioPage')), permiso: PERMISO }],
};

export default calendario;
