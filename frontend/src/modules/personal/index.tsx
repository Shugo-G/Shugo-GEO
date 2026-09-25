import { lazy } from 'react';
import { TeamOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const personal: AppModule = {
  key: 'personal',
  orden: 10,
  menu: [{ key: 'personal', label: 'Personal', icon: <TeamOutlined />, path: '/personal', permiso: 'personal.view_empleado' }],
  routes: [
    { path: '/personal', component: lazy(() => import('./pages/EmpleadosPage')), permiso: 'personal.view_empleado' },
    { path: '/personal/:id', component: lazy(() => import('./pages/FichaEmpleadoPage')), permiso: 'personal.view_empleado' },
  ],
};

export default personal;
