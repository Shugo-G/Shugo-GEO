import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';

/**
 * Contrato que cumple cada módulo funcional del frontend.
 *
 * Para agregar un módulo nuevo:
 *   1. Crear la carpeta src/modules/<nombre>/ con sus páginas, api y componentes.
 *   2. Exportar desde src/modules/<nombre>/index.tsx un objeto AppModule.
 *   3. Sumarlo al array de src/modules/index.ts.
 * El menú lateral y las rutas se generan solos, respetando los permisos.
 */
export interface MenuItemDef {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Ruta a la que navega. Si tiene children se muestra como submenú. */
  path?: string;
  /** Permiso(s) requerido(s) para ver la opción (formato "app.codename"). */
  permiso?: string | string[];
  children?: MenuItemDef[];
}

export interface RouteDef {
  path: string;
  component: LazyExoticComponent<ComponentType> | ComponentType;
  permiso?: string | string[];
}

export interface AppModule {
  key: string;
  /** Posición en el menú lateral. */
  orden: number;
  menu?: MenuItemDef[];
  routes: RouteDef[];
}
