import { useState } from 'react';
import { App, Button, Popconfirm, Space, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import { fotoEmpleadoApi, type Empleado } from '@/shared/api/empleados';
import FotoEmpleado from '@/shared/components/FotoEmpleado';

/** Foto del agente en la ficha, con carga / reemplazo / quitar (requiere permiso de edición). */
export default function FotoEditable({ empleado }: { empleado: Empleado }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const puedeEditar = usePermiso('personal.change_empleado');
  const [subiendo, setSubiendo] = useState(false);

  const actualizar = () => qc.invalidateQueries();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <FotoEmpleado url={empleado.foto_url} nombre={empleado.nombre_completo} tamanio={128} redondeada={false} />
      {puedeEditar && (
        <Space size={4}>
          <Upload
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              setSubiendo(true);
              try {
                await fotoEmpleadoApi.subir(empleado.id, file as File);
                message.success('Foto actualizada');
                onSuccess?.({});
                actualizar();
              } catch (e) {
                message.error(mensajeError(e));
                onError?.(e as Error);
              } finally {
                setSubiendo(false);
              }
            }}
          >
            <Button size="small" icon={<CameraOutlined />} loading={subiendo}>
              {empleado.foto_url ? 'Cambiar' : 'Cargar foto'}
            </Button>
          </Upload>
          {empleado.foto_url && (
            <Popconfirm
              title="¿Quitar la foto?"
              onConfirm={async () => {
                await fotoEmpleadoApi.quitar(empleado.id);
                actualizar();
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )}
    </div>
  );
}
