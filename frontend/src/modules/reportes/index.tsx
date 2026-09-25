import { lazy } from 'react';
import { BarChartOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const reportes: AppModule = {
  key: 'reportes',
  orden: 50,
  menu: [{ key: 'reportes', label: 'Reportes', icon: <BarChartOutlined />, path: '/reportes', permiso: 'personal.view_empleado' }],
  routes: [{ path: '/reportes', component: lazy(() => import('./pages/ReportesPage')), permiso: 'personal.view_empleado' }],
};

export default reportes;
