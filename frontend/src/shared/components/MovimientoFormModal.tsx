import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, deApi } from '@/core/utils/format';
import { tiposNovedadApi } from '@/shared/api/catalogos';
import { CONCEPTOS, movimientosApi, type ConceptoMovimiento, type MovimientoSaldo } from '@/shared/api/saldos';
import { EmpleadoSelect, TipoNovedadSelect } from './Selects';

interface Props {
  open: boolean;
  onClose: () => void;
  movimiento?: MovimientoSaldo | null;
  empleadoId?: number;
  conceptoInicial?: ConceptoMovimiento;
}

interface Valores {
  empleado: number;
  tipo_novedad: number;
  concepto: ConceptoMovimiento;
  anio: number;
  dias: number;
  fecha: Dayjs;
  fecha_trabajada?: Dayjs | null;
  motivo?: string;
}

/**
 * Alta/edición de movimientos de saldo: asignación de días, compensación por
 * trabajar un día no laborable (fin de semana/feriado) o ajuste manual.
 */
export default function MovimientoFormModal({ open, onClose, movimiento, empleadoId, conceptoInicial = 'ASIGNACION' }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const guardar = movimientosApi.useGuardar();
  const concepto = Form.useWatch('concepto', form);
  const tipoId = Form.useWatch('tipo_novedad', form);
  const { data: tipos = [] } = tiposNovedadApi.useTodos({ activo: true });
  const tipoSel = tipos.find((t) => t.id === tipoId);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      movimiento
        ? {
            ...movimiento,
            fecha: deApi(movimiento.fecha)!,
            fecha_trabajada: deApi(movimiento.fecha_trabajada),
          }
        : { empleado: empleadoId, concepto: conceptoInicial, anio: dayjs().year(), fecha: dayjs(), dias: conceptoInicial === 'COMPENSACION' ? 1 : undefined },
    );
  }, [open, movimiento, empleadoId, conceptoInicial, form]);

  const onGuardar = async () => {
    const v = await form.validateFields();
    try {
      await guardar.mutateAsync({
        id: movimiento?.id,
        empleado: v.empleado,
        tipo_novedad: v.tipo_novedad,
        concepto: v.concepto,
        anio: v.anio,
        dias: v.dias,
        fecha: aApi(v.fecha)!,
        fecha_trabajada: aApi(v.fecha_trabajada) ?? null,
        motivo: v.motivo ?? '',
      });
      message.success('Movimiento guardado');
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
      title={movimiento ? 'Editar movimiento de saldo' : 'Nuevo movimiento de saldo'}
      onCancel={onClose}
      onOk={onGuardar}
      okText="Guardar"
      confirmLoading={guardar.isPending}
      destroyOnHidden
      width={600}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="empleado" label="Empleado" rules={[{ required: true }]}>
          <EmpleadoSelect disabled={!!empleadoId || !!movimiento} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="tipo_novedad"
              label="Tipo de licencia"
              rules={[{ required: true }]}
              extra={tipoSel?.saldo_de_nombre ? `Suma a la bolsa de ${tipoSel.saldo_de_nombre}.` : undefined}
            >
              <TipoNovedadSelect soloConSaldo />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="concepto" label="Concepto" rules={[{ required: true }]}>
              <Select options={CONCEPTOS} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={12} sm={6}>
            <Form.Item name="dias" label="Días" rules={[{ required: true }]} extra={concepto === 'AJUSTE' ? 'Negativo resta' : undefined}>
              <InputNumber style={{ width: '100%' }} min={concepto === 'AJUSTE' ? -365 : 1} max={365} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="anio" label="Año / período" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={2000} max={2100} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="fecha" label="Fecha del movimiento" rules={[{ required: true }]}>
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        {concepto === 'COMPENSACION' && (
          <Form.Item
            name="fecha_trabajada"
            label="Día no laborable trabajado"
            rules={[{ required: true, message: 'Indique el día trabajado' }]}
            extra="Fin de semana o feriado en que el agente trabajó."
          >
            <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
          </Form.Item>
        )}
        <Form.Item name="motivo" label="Motivo / detalle" rules={[{ required: concepto === 'AJUSTE', message: 'Los ajustes requieren motivo' }]}>
          <Input.TextArea rows={2} maxLength={255} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
