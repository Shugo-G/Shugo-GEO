import { lazy } from 'react';
import { LaptopOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const PERMISO = 'patrimonio.view_cargopatrimonial';

const patrimonio: AppModule = {
  key: 'patrimonio',
  orden: 45,
  menu: [{ key: 'patrimonio', label: 'Patrimonio', icon: <LaptopOutlined />, path: '/patrimonio', permiso: PERMISO }],
  routes: [{ path: '/patrimonio', component: lazy(() => import('./pages/InventarioPage')), permiso: PERMISO }],
};

export default patrimonio;
