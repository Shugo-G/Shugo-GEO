import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location }} />;
  return <>{children}</>;
}

export function RequirePermiso({ permiso, children }: { permiso?: string | string[]; children: ReactNode }) {
  const { tienePermiso } = useAuth();
  if (!tienePermiso(permiso)) {
    return (
      <Result
        status="403"
        title="Sin acceso"
        subTitle="Su usuario no tiene permisos para ver esta sección."
        extra={<Button href="/">Volver al inicio</Button>}
      />
    );
  }
  return <>{children}</>;
}

/** Muestra el contenido sólo si el usuario tiene el permiso (para botones de acción). */
export function Can({ permiso, children }: { permiso: string | string[]; children: ReactNode }) {
  const { tienePermiso } = useAuth();
  return tienePermiso(permiso) ? <>{children}</> : null;
}
