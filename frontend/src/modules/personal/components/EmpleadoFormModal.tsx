import { useEffect } from 'react';
import { App, Col, DatePicker, Divider, Form, Input, Modal, Row, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, deApi } from '@/core/utils/format';
import { modalidadesApi } from '@/shared/api/catalogos';
import { SITUACIONES, empleadosApi, type Empleado, type SituacionRevista } from '@/shared/api/empleados';
import { ModalidadSelect, UnidadSelect } from '@/shared/components/Selects';

interface Props {
  open: boolean;
  onClose: (guardado?: Empleado) => void;
  empleado?: Empleado | null;
}

type Valores = Omit<Empleado, 'fecha_nacimiento' | 'fecha_ingreso' | 'fecha_fin_contrato' | 'fecha_baja'> & {
  fecha_nacimiento?: Dayjs | null;
  fecha_ingreso: Dayjs;
  fecha_fin_contrato?: Dayjs | null;
  fecha_baja?: Dayjs | null;
};

export default function EmpleadoFormModal({ open, onClose, empleado }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const guardar = empleadosApi.useGuardar();
  const { data: modalidades = [] } = modalidadesApi.useTodos();

  const modalidadId = Form.useWatch('modalidad', form);
  const situacion = Form.useWatch('situacion_revista', form) as SituacionRevista | undefined;
  const modalidad = modalidades.find((m) => m.id === modalidadId);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (empleado) {
      form.setFieldsValue({
        ...empleado,
        fecha_nacimiento: deApi(empleado.fecha_nacimiento),
        fecha_ingreso: deApi(empleado.fecha_ingreso)!,
        fecha_fin_contrato: deApi(empleado.fecha_fin_contrato),
        fecha_baja: deApi(empleado.fecha_baja),
      });
    } else {
      form.setFieldsValue({ situacion_revista: 'ACTIVO', fecha_ingreso: dayjs() });
    }
  }, [open, empleado, form]);

  const onGuardar = async () => {
    const v = await form.validateFields();
    try {
      const resultado = await guardar.mutateAsync({
        ...v,
        id: empleado?.id,
        legajo: v.legajo ?? '',
        fecha_nacimiento: aApi(v.fecha_nacimiento) ?? null,
        fecha_ingreso: aApi(v.fecha_ingreso)!,
        fecha_fin_contrato: aApi(v.fecha_fin_contrato) ?? null,
        fecha_baja: aApi(v.fecha_baja) ?? null,
      });
      message.success(empleado ? 'Empleado actualizado' : 'Empleado dado de alta');
      onClose(resultado);
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos as never);
      else message.error(mensajeError(e));
    }
  };

  return (
    <Modal
      open={open}
      title={empleado ? `Editar: ${empleado.nombre_completo}` : 'Alta de empleado'}
      onCancel={() => onClose()}
      onOk={onGuardar}
      okText="Guardar"
      confirmLoading={guardar.isPending}
      width={760}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Divider orientation="left" plain style={{ marginTop: 0 }}>
          Datos personales
        </Divider>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="apellido" label="Apellido" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="dni"
              label="DNI"
              rules={[{ required: true }, { pattern: /^\d{7,9}$/, message: 'Sólo números, 7 a 9 dígitos' }]}
            >
              <Input inputMode="numeric" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>
          Datos laborales
        </Divider>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="modalidad" label="Modalidad de contratación" rules={[{ required: true }]}>
              <ModalidadSelect />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="legajo"
              label="Legajo"
              rules={[{ required: modalidad ? !modalidad.usa_dni_como_legajo : false, message: 'El legajo es obligatorio' }]}
              extra={modalidad?.usa_dni_como_legajo ? 'Si se deja vacío se usa el DNI.' : undefined}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="unidad"
              label="Unidad organizativa"
              rules={[{ required: true, message: 'Indique de qué unidad depende' }]}
              extra="Dirección General, Dirección o Área."
            >
              <UnidadSelect />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="fecha_ingreso" label="Fecha de ingreso" rules={[{ required: true }]}>
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="fecha_fin_contrato"
              label="Fin de contrato"
              rules={[{ required: !!modalidad?.requiere_fecha_fin, message: 'Requerido para esta modalidad' }]}
            >
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="situacion_revista" label="Situación de revista" rules={[{ required: true }]}>
              <Select options={SITUACIONES} />
            </Form.Item>
          </Col>
          {situacion === 'BAJA' && (
            <Col xs={24} sm={8}>
              <Form.Item name="fecha_baja" label="Fecha de baja" rules={[{ required: true }]}>
                <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Divider orientation="left" plain>
          Contacto y observaciones
        </Divider>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="telefono" label="Teléfono">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="observaciones" label="Observaciones">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
