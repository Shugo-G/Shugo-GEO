import { lazy } from 'react';
import { DashboardOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const PERMISO = ['personal.view_empleado', 'novedades.view_novedad'];

const dashboard: AppModule = {
  key: 'dashboard',
  orden: 0,
  menu: [{ key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/', permiso: PERMISO }],
  routes: [{ path: '/', component: lazy(() => import('./pages/DashboardPage')), permiso: PERMISO }],
};

export default dashboard;
