import { App, Form, Input, Modal } from 'antd';
import { api, erroresDeCampos, mensajeError } from '@/core/api/client';

export default function CambiarPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const guardar = async () => {
    const valores = await form.validateFields();
    try {
      await api.post('/auth/cambiar-password/', {
        password_actual: valores.password_actual,
        password_nuevo: valores.password_nuevo,
      });
      message.success('Contraseña actualizada');
      form.resetFields();
      onClose();
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos);
      else message.error(mensajeError(e));
    }
  };

  return (
    <Modal title="Cambiar contraseña" open={open} onOk={guardar} onCancel={onClose} okText="Guardar" destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="password_actual" label="Contraseña actual" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="password_nuevo" label="Nueva contraseña" rules={[{ required: true, min: 8 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmacion"
          label="Repetir nueva contraseña"
          dependencies={['password_nuevo']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator: (_, valor) =>
                !valor || getFieldValue('password_nuevo') === valor
                  ? Promise.resolve()
                  : Promise.reject(new Error('Las contraseñas no coinciden')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
