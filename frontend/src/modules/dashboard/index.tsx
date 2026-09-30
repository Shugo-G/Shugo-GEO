import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const PERMISO = ['personal.view_empleado', 'novedades.view_novedad'];

/** El calendario ahora es una pestaña del Inicio: los enlaces viejos a /calendario llevan ahí. */
const IrAlCalendario = () => <Navigate to="/?vista=calendario" replace />;

const dashboard: AppModule = {
  key: 'dashboard',
  orden: 0,
  menu: [{ key: 'dashboard', label: 'Inicio', icon: <HomeOutlined />, path: '/', permiso: PERMISO }],
  routes: [
    { path: '/', component: lazy(() => import('./pages/DashboardPage')), permiso: PERMISO },
    { path: '/calendario', component: IrAlCalendario, permiso: PERMISO },
  ],
};

export default dashboard;
