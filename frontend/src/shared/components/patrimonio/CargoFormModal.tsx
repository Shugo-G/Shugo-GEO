import { useEffect } from 'react';
import { Alert, App, Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, deApi } from '@/core/utils/format';
import { cargosApi, insumosApi, type CargoPatrimonial } from '@/shared/api/patrimonio';
import { EmpleadoSelect } from '@/shared/components/Selects';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cargo a editar; si no se pasa, se asigna un bien nuevo. */
  cargo?: CargoPatrimonial | null;
  /** Empleado preseleccionado (desde la ficha). */
  empleadoId?: number;
}

interface Valores {
  empleado: number;
  tipo_insumo: number;
  planilla_cargo?: string;
  iub?: string;
  descripcion?: string;
  fecha_asignacion: Dayjs;
}

/** Asignación de un bien a un agente (o corrección de sus datos). */
export default function CargoFormModal({ open, onClose, cargo, empleadoId }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const guardar = cargosApi.useGuardar();
  const { data: insumos = [] } = insumosApi.useTodos({ activo: true });
  const cerrado = !!cargo && !cargo.vigente;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      cargo
        ? { ...cargo, fecha_asignacion: deApi(cargo.fecha_asignacion)! }
        : { empleado: empleadoId, fecha_asignacion: dayjs() },
    );
  }, [open, cargo, empleadoId, form]);

  const onGuardar = async () => {
    const v = await form.validateFields();
    try {
      await guardar.mutateAsync({
        id: cargo?.id,
        empleado: v.empleado,
        tipo_insumo: v.tipo_insumo,
        planilla_cargo: v.planilla_cargo ?? '',
        iub: v.iub ?? '',
        descripcion: v.descripcion ?? '',
        fecha_asignacion: aApi(v.fecha_asignacion)!,
      });
      message.success(cargo ? 'Cargo actualizado' : 'Bien asignado');
      onClose();
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos as never);
      else message.error(mensajeError(e));
    }
  };

  return (
    <Modal
      open={open}
      title={cargo ? 'Editar cargo patrimonial' : 'Asignar bien patrimonial'}
      onCancel={onClose}
      onOk={onGuardar}
      okText="Guardar"
      confirmLoading={guardar.isPending}
      width={620}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        {cerrado && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Cargo cerrado: sólo pueden corregirse la planilla y la descripción."
          />
        )}
        {cargo?.vigente && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Para cambiar de responsable use la acción Transferir (queda registrado en el historial)."
          />
        )}
        <Form.Item name="empleado" label="Responsable" rules={[{ required: true, message: 'Seleccione el empleado' }]}>
          <EmpleadoSelect disabled={!!empleadoId || !!cargo} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="tipo_insumo" label="Insumo" rules={[{ required: true, message: 'Seleccione el insumo' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={cerrado}
                placeholder="CPU, Monitor, Notebook..."
                options={insumos.map((i) => ({ value: i.id, label: i.nombre }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="fecha_asignacion" label="Fecha de asignación" rules={[{ required: true }]}>
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} disabled={cerrado} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="planilla_cargo"
              label="Planilla de cargo"
              rules={[{ required: true, whitespace: true, message: 'Indique el código de la planilla' }]}
              extra="Cambia en cada transferencia entre empleados."
            >
              <Input maxLength={60} placeholder="Código de la planilla" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="iub"
              label="IUB"
              rules={[{ required: true, whitespace: true, message: 'Indique el IUB' }]}
              extra="Identificación única del bien: se mantiene en las transferencias."
            >
              <Input maxLength={60} disabled={cerrado} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="descripcion" label="Descripción">
          <Input.TextArea rows={3} placeholder="Marca, modelo, número de serie, detalles..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
