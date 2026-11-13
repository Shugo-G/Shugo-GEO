import { useEffect } from 'react';
import { Alert, App, Col, DatePicker, Divider, Form, Input, Modal, Row, Select, TimePicker } from 'antd';
import type { UploadFile } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, deApi } from '@/core/utils/format';
import { modalidadesApi } from '@/shared/api/catalogos';
import { usePermiso } from '@/core/auth/AuthContext';
import { PERMISOS_DOCUMENTOS_EMPLEADO, SITUACIONES, documentosEmpleadoApi, empleadosApi, type Empleado, type SituacionRevista } from '@/shared/api/empleados';
import { AdjuntosPendientes, subirPendientes } from '@/shared/components/ListaDocumentos';
import DocumentosEmpleado from './DocumentosEmpleado';
import { AdicionalSelect, CargoSelect, ModalidadSelect, UnidadSelect } from '@/shared/components/Selects';

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
  /** Horario habitual [entrada, salida]. */
  horario_rango?: [Dayjs, Dayjs] | null;
  /** Sólo en el alta: archivos del acto del cargo, que se suben después de crear al agente. */
  adjuntos?: UploadFile[];
};

const HORA = 'HH:mm';
const HORARIO_POR_DEFECTO: [Dayjs, Dayjs] = [dayjs('08:00', HORA), dayjs('15:00', HORA)];

export default function EmpleadoFormModal({ open, onClose, empleado }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const guardar = empleadosApi.useGuardar();
  const { data: modalidades = [] } = modalidadesApi.useTodos();

  const modalidadId = Form.useWatch('modalidad', form);
  const situacion = Form.useWatch('situacion_revista', form) as SituacionRevista | undefined;
  const cargoId = Form.useWatch('cargo', form);
  const puedeAdjuntar = usePermiso(PERMISOS_DOCUMENTOS_EMPLEADO.subir);
  const puedeVerAdjuntos = usePermiso(PERMISOS_DOCUMENTOS_EMPLEADO.ver);
  const pasaABaja = situacion === 'BAJA' && !!empleado && empleado.situacion_revista !== 'BAJA';
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
        horario_rango: [dayjs(empleado.hora_entrada, 'HH:mm:ss'), dayjs(empleado.hora_salida, 'HH:mm:ss')],
      });
    } else {
      form.setFieldsValue({ situacion_revista: 'ACTIVO', fecha_ingreso: dayjs(), horario_rango: HORARIO_POR_DEFECTO, adicionales: [] });
    }
  }, [open, empleado, form]);

  const onGuardar = async () => {
    const { horario_rango, adjuntos, ...v } = await form.validateFields();
    const [entrada, salida] = horario_rango ?? HORARIO_POR_DEFECTO;
    try {
      const resultado = await guardar.mutateAsync({
        ...v,
        id: empleado?.id,
        legajo: v.legajo ?? '',
        etiqueta: v.etiqueta ?? '',
        cuit: v.cuit ?? '',
        titulo: v.titulo ?? '',
        numero_proveedor: v.numero_proveedor ?? '',
        hora_entrada: entrada.format(HORA),
        hora_salida: salida.format(HORA),
        cargo: v.cargo ?? null,
        cargo_acto_administrativo: v.cargo ? v.cargo_acto_administrativo ?? '' : '',
        adicionales: v.adicionales ?? [],
        fecha_nacimiento: aApi(v.fecha_nacimiento) ?? null,
        fecha_ingreso: aApi(v.fecha_ingreso)!,
        fecha_fin_contrato: aApi(v.fecha_fin_contrato) ?? null,
        fecha_baja: aApi(v.fecha_baja) ?? null,
      });
      // En el alta, los adjuntos elegidos se suben después de crear al agente.
      const fallidos = adjuntos?.length && v.cargo
        ? await subirPendientes(adjuntos, (archivo) => documentosEmpleadoApi.subir(resultado.id, archivo))
        : [];
      if (fallidos.length) message.warning(`Empleado guardado, pero no se pudo adjuntar: ${fallidos.join(', ')}. Puede hacerlo desde Editar.`);
      else message.success(empleado ? 'Empleado actualizado' : 'Empleado dado de alta');
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
            <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento" rules={[{ required: true, message: 'Indique la fecha de nacimiento' }]}>
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs())} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="cuit"
              label="CUIT"
              rules={[{ pattern: /^\d{2}-?\d{8}-?\d$/, message: '11 dígitos (con o sin guiones)' }]}
            >
              <Input inputMode="numeric" placeholder="20-12345678-9" maxLength={13} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="titulo" label="Título">
              <Input maxLength={160} placeholder="Ej.: Analista de Sistemas" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="etiqueta"
              label="Etiqueta para el Inicio"
              tooltip="Nombre que se muestra en la tarjeta del Inicio. Si se deja vacío se usa el primer apellido y el primer nombre."
            >
              <Input maxLength={60} placeholder="Automática: primer apellido y nombre" />
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
          <Col xs={24} sm={8}>
            <Form.Item
              name="horario_rango"
              label="Horario"
              rules={[{ required: true, message: 'Indique el horario' }]}
              tooltip="Horario habitual de lunes a viernes. Fuera de él, la tarjeta del Inicio lo muestra Inactivo."
            >
              <TimePicker.RangePicker format={HORA} minuteStep={15} allowClear={false} style={{ width: '100%' }} placeholder={['Entrada', 'Salida']} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="numero_proveedor" label="Número de proveedor">
              <Input maxLength={30} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="cargo" label="Cargo">
              <CargoSelect />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="cargo_acto_administrativo" label="Acto administrativo del cargo" extra="Por ejemplo: DECRETO MUNICIPAL Nº 000/2026">
              <Input maxLength={120} disabled={!cargoId} />
            </Form.Item>
          </Col>
          {/* Adjuntos del acto: al editar se administran en el momento; en el alta se suben al guardar. */}
          {empleado
            ? puedeVerAdjuntos && (!!cargoId || empleado.documentos_count > 0) && (
                <Col xs={24}>
                  <Form.Item label="Adjuntos del acto administrativo del cargo" extra="Si el agente cambia de cargo, los anteriores quedan como antecedentes.">
                    <DocumentosEmpleado empleadoId={empleado.id} />
                  </Form.Item>
                </Col>
              )
            : puedeAdjuntar && !!cargoId && (
                <Col xs={24}>
                  <Form.Item name="adjuntos" label="Adjunto del acto administrativo del cargo" extra="Opcional. PDF o imagen del decreto o la resolución.">
                    <AdjuntosPendientes texto="Adjuntar acto administrativo" />
                  </Form.Item>
                </Col>
              )}
          <Col xs={24}>
            <Form.Item name="adicionales" label="Adicionales">
              <AdicionalSelect mode="multiple" maxTagCount={undefined} maxTagTextLength={undefined} placeholder="Capacitador, guardia pasiva..." />
            </Form.Item>
          </Col>
          {situacion === 'BAJA' && (
            <Col xs={24} sm={8}>
              <Form.Item name="fecha_baja" label="Fecha de baja" rules={[{ required: true }]}>
                <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
          {pasaABaja && (
            <Col xs={24}>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Al dar de baja al agente se cierran sus licencias"
                description="Las licencias en curso o abiertas terminan en la fecha de baja y las programadas a futuro se anulan (motivo: Baja del agente). Queda registrado en el historial."
              />
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
