import { useEffect } from 'react';
import { Alert, App, Checkbox, Col, Form, Input, InputNumber, Modal, Row } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { asignacionMasiva } from '@/shared/api/saldos';
import { EmpleadoSelect, ModalidadSelect, TipoNovedadSelect, UnidadSelect } from '@/shared/components/Selects';

interface Valores {
  tipo_novedad: number;
  anio: number;
  dias: number;
  motivo?: string;
  unidad?: number[];
  modalidad?: number[];
  empleados?: number[];
  omitir_existentes: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Tipo de licencia preseleccionado (p. ej. al crear "Licencia invierno 2027"). */
  tipoInicial?: { id: number; nombre: string } | null;
}

/**
 * Carga masiva: acredita la misma cantidad de días a todos los empleados activos
 * (o a los de ciertas unidades/modalidades). Ej.: la asignación anual de
 * vacaciones o una licencia nueva como "Licencia invierno 2027".
 */
export default function AsignacionMasivaModal({ open, onClose, tipoInicial }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ anio: dayjs().year(), omitir_existentes: true, tipo_novedad: tipoInicial?.id });
  }, [open, form, tipoInicial]);

  const confirmar = async () => {
    const valores = await form.validateFields();
    try {
      const r = await asignacionMasiva(valores);
      message.success(`Se asignaron días a ${r.creados} empleado(s)${r.omitidos ? `; ${r.omitidos} omitido(s) por tener asignación previa` : ''}.`);
      qc.invalidateQueries();
      form.resetFields();
      onClose();
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos as never);
      else message.error(mensajeError(e));
    }
  };

  return (
    <Modal open={open} title={tipoInicial ? `Acreditar días · ${tipoInicial.nombre}` : 'Asignación masiva de días'} onCancel={onClose} onOk={confirmar} okText="Asignar" width={620} destroyOnHidden>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Se crea un movimiento de asignación para cada empleado activo que cumpla los filtros. Los días no utilizados de años anteriores se mantienen (el saldo es acumulable)."
      />
      <Form form={form} layout="vertical" requiredMark="optional">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="tipo_novedad" label="Tipo de licencia" rules={[{ required: true }]}>
              <TipoNovedadSelect soloConSaldo />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="anio" label="Año" rules={[{ required: true }]}>
              <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="dias" label="Días" rules={[{ required: true }]}>
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="motivo" label="Motivo / detalle">
          <Input placeholder="Por defecto: Asignación <año>" maxLength={255} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="unidad" label="Sólo estas unidades" extra="Incluye sus dependientes.">
              <UnidadSelect multiple placeholder="Todas" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="modalidad" label="Sólo estas modalidades">
              <ModalidadSelect mode="multiple" placeholder="Todas" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="empleados" label="Sólo estos empleados">
          <EmpleadoSelect mode="multiple" placeholder="Todos" />
        </Form.Item>
        <Form.Item name="omitir_existentes" valuePropName="checked">
          <Checkbox>Omitir empleados que ya tienen una asignación de ese tipo para el año</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
