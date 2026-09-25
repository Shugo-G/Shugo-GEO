import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Result } from 'antd';
import { RequireAuth, RequirePermiso } from '@/core/auth/guards';
import LoginPage from '@/core/auth/LoginPage';
import MainLayout from '@/core/layout/MainLayout';
import { modulos } from '@/modules';

/** Las rutas se generan a partir del registro de módulos (src/modules/index.ts). */
export function AppRouter() {
  const rutas = modulos.flatMap((m) => m.routes);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {rutas.map(({ path, component: Pagina, permiso }) => (
            <Route
              key={path}
              path={path}
              element={
                <RequirePermiso permiso={permiso}>
                  <Pagina />
                </RequirePermiso>
              }
            />
          ))}
          <Route path="*" element={<Result status="404" title="Página no encontrada" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
