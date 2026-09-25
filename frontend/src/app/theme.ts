import type { ThemeConfig } from 'antd';

/**
 * Tema visual. Colores placeholder hasta definir la identidad institucional:
 * cambiar `colorPrimary` (y --color-primario en global.css) alcanza para rebrandear.
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1F4E79',
    colorSuccess: '#52c41a',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  components: {
    Layout: { siderBg: '#0f2a44', headerBg: '#ffffff', bodyBg: '#f3f5f8' },
    Menu: { darkItemBg: '#0f2a44', darkSubMenuItemBg: '#0b2136', darkItemSelectedBg: '#1F4E79' },
    Card: { headerFontSize: 15 },
  },
};

/** Color del estado "Activo / trabajando" (no es una categoría configurable). */
export const COLOR_ACTIVO = '#52c41a';
