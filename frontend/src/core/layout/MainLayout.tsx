import { Suspense, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Grid, Layout, Menu, Spin, Typography, type MenuProps } from 'antd';
import { KeyOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/core/auth/AuthContext';
import { useInfoSistema } from '@/core/auth/LoginPage';
import { modulos } from '@/modules';
import type { MenuItemDef } from '@/modules/types';
import CambiarPasswordModal from './CambiarPasswordModal';

const { Header, Sider, Content } = Layout;

type ItemMenu = Required<MenuProps>['items'][number];

function construirMenu(items: MenuItemDef[], tienePermiso: (p?: string | string[]) => boolean): ItemMenu[] {
  return items
    .filter((item) => tienePermiso(item.permiso))
    .map((item) => {
      if (item.children) {
        const hijos = construirMenu(item.children, tienePermiso);
        if (!hijos.length) return null;
        return { key: item.key, icon: item.icon, label: item.label, children: hijos };
      }
      return { key: item.path ?? item.key, icon: item.icon, label: item.label };
    })
    .filter(Boolean) as ItemMenu[];
}

function rutasDeMenu(items: MenuItemDef[]): { path: string; padre?: string }[] {
  return items.flatMap((item) =>
    item.children ? item.children.map((h) => ({ path: h.path ?? h.key, padre: item.key })) : [{ path: item.path ?? item.key }],
  );
}

export default function MainLayout() {
  const { usuario, logout, tienePermiso } = useAuth();
  const { data: info } = useInfoSistema();
  const navigate = useNavigate();
  const location = useLocation();
  const pantalla = Grid.useBreakpoint();
  const [colapsado, setColapsado] = useState(false);
  const [cambiarPassword, setCambiarPassword] = useState(false);

  const itemsDef = useMemo(() => modulos.flatMap((m) => m.menu ?? []), []);
  const items = useMemo(() => construirMenu(itemsDef, tienePermiso), [itemsDef, tienePermiso]);

  // Opción de menú activa: la ruta más larga que coincide con la URL actual.
  const { seleccionada, abierta } = useMemo(() => {
    const coincidencias = rutasDeMenu(itemsDef)
      .filter((r) => (r.path === '/' ? location.pathname === '/' : location.pathname.startsWith(r.path)))
      .sort((a, b) => b.path.length - a.path.length);
    return { seleccionada: coincidencias[0]?.path, abierta: coincidencias[0]?.padre };
  }, [itemsDef, location.pathname]);

  const menuUsuario: MenuProps['items'] = [
    { key: 'password', icon: <KeyOutlined />, label: 'Cambiar contraseña', onClick: () => setCambiarPassword(true) },
    { type: 'divider' },
    { key: 'salir', icon: <LogoutOutlined />, label: 'Cerrar sesión', danger: true, onClick: logout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={colapsado}
        onCollapse={setColapsado}
        breakpoint="lg"
        collapsedWidth={pantalla.md ? 72 : 0}
        trigger={null}
        width={240}
        className="app-sider"
      >
        <div className="app-logo" onClick={() => navigate('/')}>
          <img src="/logo.svg" alt="" width={32} height={32} />
          {!colapsado && (
            <div className="app-logo-texto">
              <span className="app-logo-nombre">{info?.nombre ?? 'SHUGOGEO'}</span>
              <span className="app-logo-desc">Gestión de Empleados y Operatividad</span>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={seleccionada ? [seleccionada] : []}
          defaultOpenKeys={abierta ? [abierta] : []}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <span className="app-header-toggle" onClick={() => setColapsado(!colapsado)}>
            {colapsado ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <Typography.Text type="secondary" className="app-header-organismo">
            {info ? `${info.municipio} · ${info.organismo}` : ''}
          </Typography.Text>
          <Dropdown menu={{ items: menuUsuario }} placement="bottomRight" trigger={['click']}>
            <span className="app-header-usuario">
              <Avatar size="small" icon={<UserOutlined />} />
              <span>
                {usuario?.nombre_completo}
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                  {usuario?.roles.join(', ')}
                </Typography.Text>
              </span>
            </span>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Suspense fallback={<Spin style={{ display: 'block', margin: '80px auto' }} />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <CambiarPasswordModal open={cambiarPassword} onClose={() => setCambiarPassword(false)} />
    </Layout>
  );
}
