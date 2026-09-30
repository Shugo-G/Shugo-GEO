import { lazy } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import type { AppModule, MenuItemDef, RouteDef } from '../types';

const catalogo = (nombre: keyof typeof import('./pages/catalogos')) =>
  lazy(() => import('./pages/catalogos').then((m) => ({ default: m[nombre] })));

/** Cada entrada genera una opción del submenú "Configuración" y su ruta. */
const PANTALLAS: (MenuItemDef & Pick<RouteDef, 'component'>)[] = [
  {
    key: 'estructura',
    label: 'Estructura organizativa',
    path: '/configuracion/estructura',
    permiso: 'organizacion.view_unidadorganizativa',
    component: lazy(() => import('./pages/EstructuraPage')),
  },
  {
    key: 'modalidades',
    label: 'Modalidades de contratación',
    path: '/configuracion/modalidades',
    permiso: 'organizacion.view_modalidadcontratacion',
    component: catalogo('ModalidadesPage'),
  },
  {
    key: 'tipos',
    label: 'Artículos de licencia',
    path: '/configuracion/tipos-novedad',
    permiso: 'novedades.view_tiponovedad',
    component: catalogo('TiposNovedadPage'),
  },
  {
    key: 'insumos',
    label: 'Categoría de insumos',
    path: '/configuracion/insumos',
    permiso: 'patrimonio.view_tipoinsumo',
    component: catalogo('TiposInsumoPage'),
  },
  {
    key: 'feriados',
    label: 'Días no laborables',
    path: '/configuracion/feriados',
    permiso: 'calendario.view_dianolaborable',
    component: catalogo('NoLaborablesPage'),
  },
  {
    key: 'servicios',
    label: 'Categoría de servicios',
    path: '/configuracion/servicios',
    permiso: 'servicios.view_proveedor',
    component: catalogo('CategoriaServiciosPage'),
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    path: '/configuracion/usuarios',
    permiso: 'accounts.view_user',
    component: lazy(() => import('./pages/UsuariosPage')),
  },
];

const configuracion: AppModule = {
  key: 'configuracion',
  orden: 90,
  menu: [
    {
      key: 'configuracion',
      label: 'Configuración',
      icon: <SettingOutlined />,
      children: PANTALLAS.map(({ key, label, path, permiso }) => ({ key, label, path, permiso })),
    },
  ],
  routes: PANTALLAS.map(({ path, component, permiso }) => ({ path: path!, component, permiso })),
};

export default configuracion;
