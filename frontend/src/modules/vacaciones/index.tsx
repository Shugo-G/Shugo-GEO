import { lazy } from 'react';
import { SunOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const PERMISO = 'vacaciones.view_movimientosaldo';

const vacaciones: AppModule = {
  key: 'vacaciones',
  orden: 30,
  menu: [{ key: 'vacaciones', label: 'Vacaciones y saldos', icon: <SunOutlined />, path: '/vacaciones', permiso: PERMISO }],
  routes: [{ path: '/vacaciones', component: lazy(() => import('./pages/SaldosPage')), permiso: PERMISO }],
};

export default vacaciones;
