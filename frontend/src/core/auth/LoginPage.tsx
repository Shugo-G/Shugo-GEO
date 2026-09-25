import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, mensajeError } from '@/core/api/client';
import { useAuth } from './AuthContext';

interface InfoSistema {
  nombre: string;
  descripcion: string;
  organismo: string;
  municipio: string;
}

export function useInfoSistema() {
  return useQuery({
    queryKey: ['info-sistema'],
    queryFn: async () => (await api.get<InfoSistema>('/core/info/')).data,
    staleTime: Infinity,
  });
}

export default function LoginPage() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: info } = useInfoSistema();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const onFinish = async ({ username, password }: { username: string; password: string }) => {
    setEnviando(true);
    setError(null);
    try {
      await login(username, password);
      const destino = (location.state as { desde?: Location })?.desde?.pathname ?? '/';
      navigate(destino, { replace: true });
    } catch (e) {
      setError(mensajeError(e, 'Usuario o contraseña incorrectos.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-fondo">
      <Card className="login-card" variant="borderless">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.svg" alt="" width={56} height={56} />
          <Typography.Title level={3} style={{ margin: '12px 0 0' }}>
            {info?.nombre ?? 'Shugo-GEO'}
          </Typography.Title>
          <Typography.Text type="secondary">{info?.descripcion ?? 'Gestión de Empleados y Operatividad'}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {info ? `${info.municipio} · ${info.organismo}` : ' '}
            </Typography.Text>
          </div>
        </div>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" label="Usuario" rules={[{ required: true, message: 'Ingrese su usuario' }]}>
            <Input prefix={<UserOutlined />} autoFocus autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Ingrese su contraseña' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={enviando}>
            Ingresar
          </Button>
        </Form>
      </Card>
    </div>
  );
}
