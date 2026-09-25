import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSesionExpirada, tokens } from '@/core/api/client';

export interface Usuario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  nombre_completo: string;
  email: string;
  roles: string[];
  permisos: string[];
  is_superuser: boolean;
}

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** true si el usuario tiene TODOS los permisos indicados (formato "app.codename"). */
  tienePermiso: (permisos?: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const queryClient = useQueryClient();

  const cargarUsuario = useCallback(async () => {
    if (!tokens.access) {
      setCargando(false);
      return;
    }
    try {
      const { data } = await api.get<Usuario>('/auth/me/');
      setUsuario(data);
    } catch {
      tokens.limpiar();
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokens.limpiar();
    setUsuario(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    onSesionExpirada(logout);
    cargarUsuario();
  }, [cargarUsuario, logout]);

  const login = useCallback(
    async (username: string, password: string) => {
      const { data } = await api.post('/auth/token/', { username, password });
      tokens.guardar(data.access, data.refresh);
      setCargando(true);
      await cargarUsuario();
    },
    [cargarUsuario],
  );

  const tienePermiso = useCallback(
    (permisos?: string | string[]) => {
      if (!permisos || (Array.isArray(permisos) && permisos.length === 0)) return true;
      if (!usuario) return false;
      if (usuario.is_superuser) return true;
      const lista = Array.isArray(permisos) ? permisos : [permisos];
      return lista.every((p) => usuario.permisos.includes(p));
    },
    [usuario],
  );

  const value = useMemo(
    () => ({ usuario, cargando, login, logout, tienePermiso }),
    [usuario, cargando, login, logout, tienePermiso],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

/** Atajo para chequear permisos en componentes: const puedeEditar = usePermiso('personal.change_empleado'). */
export function usePermiso(permisos?: string | string[]) {
  return useAuth().tienePermiso(permisos);
}
