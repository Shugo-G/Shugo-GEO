import { lazy } from 'react';
import { WifiOutlined } from '@ant-design/icons';
import type { AppModule } from '../types';

const LINEAS = 'servicios.view_lineamovil';
const INTERNET = 'servicios.view_serviciointernet';

/** Servicios contratados: dos secciones en el menú (líneas móviles e internet). */
const servicios: AppModule = {
  key: 'servicios',
  orden: 47,
  menu: [
    {
      key: 'servicios',
      label: 'Servicios',
      icon: <WifiOutlined />,
      children: [
        { key: 'servicios-lineas', label: 'Líneas móviles', path: '/servicios/lineas', permiso: LINEAS },
        { key: 'servicios-internet', label: 'Internet', path: '/servicios/internet', permiso: INTERNET },
      ],
    },
  ],
  routes: [
    { path: '/servicios/lineas', component: lazy(() => import('./pages/LineasPage')), permiso: LINEAS },
    { path: '/servicios/internet', component: lazy(() => import('./pages/InternetPage')), permiso: INTERNET },
  ],
};

export default servicios;
