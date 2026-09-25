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
  { key: 'puestos', label: 'Puestos', path: '/configuracion/puestos', permiso: 'organizacion.view_puesto', component: catalogo('PuestosPage') },
  {
    key: 'modalidades',
    label: 'Modalidades de contratación',
    path: '/configuracion/modalidades',
    permiso: 'organizacion.view_modalidadcontratacion',
    component: catalogo('ModalidadesPage'),
  },
  {
    key: 'tipos',
    label: 'Tipos de licencia/ausencia',
    path: '/configuracion/tipos-novedad',
    permiso: 'novedades.view_tiponovedad',
    component: catalogo('TiposNovedadPage'),
  },
  {
    key: 'categorias',
    label: 'Categorías de estado',
    path: '/configuracion/categorias',
    permiso: 'novedades.view_categoriaestado',
    component: catalogo('CategoriasPage'),
  },
  {
    key: 'insumos',
    label: 'Tipos de insumo',
    path: '/configuracion/insumos',
    permiso: 'patrimonio.view_tipoinsumo',
    component: catalogo('TiposInsumoPage'),
  },
  {
    key: 'feriados',
    label: 'Feriados y asuetos',
    path: '/configuracion/feriados',
    permiso: 'calendario.view_dianolaborable',
    component: catalogo('NoLaborablesPage'),
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
