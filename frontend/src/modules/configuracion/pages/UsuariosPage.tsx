import { Input, Select, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api/client';
import { crearRecurso } from '@/core/api/crud';
import CrudPage from '@/core/components/CrudPage';
import { fmtFechaHora } from '@/core/utils/format';

interface UsuarioSistema {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  roles: number[];
  roles_nombres: string[];
  password?: string;
  last_login: string | null;
}

const usuariosApi = crearRecurso<UsuarioSistema>('auth/usuarios');

function RolesSelect(props: { value?: number[]; onChange?: (v: number[]) => void }) {
  const { data = [] } = useQuery({
    queryKey: ['auth/roles'],
    queryFn: async () => (await api.get<{ id: number; name: string }[]>('/auth/roles/')).data,
  });
  return <Select mode="multiple" options={data.map((r) => ({ value: r.id, label: r.name }))} placeholder="Seleccione uno o más roles" {...props} />;
}

export default function UsuariosPage() {
  return (
    <CrudPage<UsuarioSistema>
      titulo="Usuarios"
      subtitulo="Cuentas de acceso al sistema y sus roles (Administrador / Consulta)"
      recurso={usuariosApi}
      permiso="accounts.user"
      campos={[
        { nombre: 'username', etiqueta: 'Usuario', tipo: 'texto', requerido: true },
        { nombre: 'first_name', etiqueta: 'Nombre', tipo: 'texto' },
        { nombre: 'last_name', etiqueta: 'Apellido', tipo: 'texto' },
        { nombre: 'email', etiqueta: 'Email', tipo: 'texto', enTabla: false },
        {
          nombre: 'roles',
          etiqueta: 'Roles',
          tipo: 'select',
          requerido: true,
          componente: <RolesSelect />,
          renderTabla: (_, u) => u.roles_nombres.map((r) => <Tag key={r}>{r}</Tag>),
        },
        {
          nombre: 'password',
          etiqueta: 'Contraseña',
          tipo: 'texto',
          enTabla: false,
          componente: <Input.Password autoComplete="new-password" />,
          ayuda: 'Obligatoria al crear. Al editar, dejar vacía para no modificarla.',
        },
        { nombre: 'is_active', etiqueta: 'Activo', tipo: 'switch', valorInicial: true },
        {
          nombre: 'last_login',
          etiqueta: 'Último ingreso',
          tipo: 'texto',
          soloTabla: true,
          renderTabla: (v) => fmtFechaHora(v as string | null),
        },
      ]}
    />
  );
}
