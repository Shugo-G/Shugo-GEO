import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Col, DatePicker, Divider, Form, Input, InputNumber, Modal, Row, Typography, Upload, type UploadFile } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { api, erroresDeCampos, mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import type { Saldo } from '@/core/api/types';
import { FORMATO_FECHA, aApi, deApi } from '@/core/utils/format';
import { tiposNovedadApi } from '@/shared/api/catalogos';
import { calcularDias, documentosApi, novedadesApi, type Novedad } from '@/shared/api/novedades';
import DocumentosNovedad from './DocumentosNovedad';
import { nombreBolsa } from './NombreBolsa';
import { EmpleadoSelect, TipoNovedadSelect } from './Selects';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Novedad a editar. Si no se pasa, se crea una nueva. */
  novedad?: Novedad | null;
  /** Empleado preseleccionado (desde la ficha). */
  empleadoId?: number;
}

interface Valores {
  empleado: number;
  tipo: number;
  fecha_desde: Dayjs;
  fecha_hasta?: Dayjs | null;
  dias?: number | null;
  motivo?: string;
  observaciones?: string;
}

export default function NovedadFormModal({ open, onClose, novedad, empleadoId }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const guardar = novedadesApi.useGuardar();
  const puedeVerSaldos = usePermiso('vacaciones.view_movimientosaldo');
  const { data: tipos = [] } = tiposNovedadApi.useTodos({ activo: true });
  const puedeAdjuntar = usePermiso('novedades.add_documentonovedad');
  // Documentación elegida en el alta: se sube después de crear la novedad.
  const [adjuntos, setAdjuntos] = useState<UploadFile[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [computo, setComputo] = useState<string>('');
  // Al abrir una novedad existente no se pisan los días (pueden haber sido ajustados a mano).
  const respetarDiasCargados = useRef(false);

  const empleado = Form.useWatch('empleado', form);
  const tipoId = Form.useWatch('tipo', form);
  const desde = Form.useWatch('fecha_desde', form);
  const hasta = Form.useWatch('fecha_hasta', form);
  const dias = Form.useWatch('dias', form);
  const tipo = tipos.find((t) => t.id === tipoId);

  // Reglas de edición según el estado (las mismas que valida el backend).
  const estado = novedad?.estado;
  const enHistorial = estado === 'FINALIZADA' || estado === 'INTERRUMPIDA';
  const enCurso = estado === 'EN_CURSO';
  const bloqueoBase = enHistorial || enCurso;

  useEffect(() => {
    if (!open) return;
    setAdjuntos([]);
    respetarDiasCargados.current = !!novedad;
    form.resetFields();
    form.setFieldsValue(
      novedad
        ? {
            empleado: novedad.empleado,
            tipo: novedad.tipo,
            fecha_desde: deApi(novedad.fecha_desde)!,
            fecha_hasta: deApi(novedad.fecha_hasta),
            dias: novedad.dias,
            motivo: novedad.motivo,
            observaciones: novedad.observaciones,
          }
        : { empleado: empleadoId },
    );
  }, [open, novedad, empleadoId, form]);

  // Recalcula los días cuando cambia el tipo o el período (el usuario puede ajustarlos luego).
  useEffect(() => {
    if (!tipoId || !desde) return;
    let vigente = true;
    calcularDias(tipoId, aApi(desde)!, aApi(hasta))
      .then((r) => {
        if (!vigente) return;
        setComputo(r.computo);
        if (respetarDiasCargados.current) respetarDiasCargados.current = false;
        else form.setFieldValue('dias', r.dias);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [tipoId, desde, hasta, form]);

  const { data: saldo } = useQuery({
    queryKey: ['vacaciones/saldos', empleado, tipoId],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: { saldos: Saldo[] }[] }>('/vacaciones/saldos/', {
        params: { empleado, tipo: tipoId },
      });
      return data.resultados[0]?.saldos[0];
    },
    enabled: open && !!empleado && !!tipo?.descuenta_saldo && puedeVerSaldos,
  });

  const onGuardar = async () => {
    const valores = await form.validateFields();
    try {
      const resultado = await guardar.mutateAsync({
        id: novedad?.id,
        empleado: valores.empleado,
        tipo: valores.tipo,
        fecha_desde: aApi(valores.fecha_desde)!,
        fecha_hasta: aApi(valores.fecha_hasta) ?? null,
        dias: valores.dias ?? null,
        motivo: valores.motivo ?? '',
        observaciones: valores.observaciones ?? '',
      });
      if (!novedad && adjuntos.length) {
        setSubiendo(true);
        const fallidos: string[] = [];
        for (const archivo of adjuntos) {
          try {
            await documentosApi.subir(resultado.id, archivo.originFileObj as File);
          } catch {
            fallidos.push(archivo.name);
          }
        }
        setSubiendo(false);
        if (fallidos.length) {
          message.warning(`Novedad registrada, pero no se pudo adjuntar: ${fallidos.join(', ')}. Puede hacerlo desde Editar.`);
          onClose();
          return;
        }
      }
      message.success(novedad ? 'Novedad actualizada' : 'Novedad registrada');
      onClose();
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos as never);
      else message.error(mensajeError(e));
    }
  };

  // Al editar, los días de la propia novedad ya están descontados: se suman de vuelta si usa la misma bolsa.
  const bolsaDe = (id?: number) => {
    const t = tipos.find((x) => x.id === id);
    return t ? t.saldo_de ?? t.id : undefined;
  };
  const mismaBolsa = !!novedad && bolsaDe(novedad.tipo) === bolsaDe(tipoId);
  const disponibleTrasCarga = saldo ? saldo.disponible + (mismaBolsa ? novedad?.dias ?? 0 : 0) : undefined;

  return (
    <Modal
      open={open}
      title={novedad ? 'Editar licencia' : 'Registrar licencia'}
      onCancel={onClose}
      onOk={onGuardar}
      okText="Guardar"
      confirmLoading={guardar.isPending || subiendo}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        {enHistorial && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Licencia finalizada: sólo pueden modificarse el motivo, las observaciones y la documentación."
            description="Si fue cargada por error, use la acción Anular."
          />
        )}
        {enCurso && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Licencia en curso: sólo puede extenderse la fecha de fin. Para acortarla use Interrumpir."
          />
        )}
        <Form.Item name="empleado" label="Empleado" rules={[{ required: true, message: 'Seleccione el empleado' }]}>
          <EmpleadoSelect disabled={!!empleadoId || !!novedad} />
        </Form.Item>
        <Form.Item
          name="tipo"
          label="Artículo de licencia"
          rules={[{ required: true, message: 'Seleccione el tipo' }]}
          extra={
            tipo &&
            (tipo.descuenta_saldo ? (
              <Typography.Text type="warning">
                Descuenta días del saldo de {(tipo.saldo_de_nombre ?? tipo.nombre).toLowerCase()}.
              </Typography.Text>
            ) : (
              <span>No descuenta saldo.</span>
            ))
          }
        >
          <TipoNovedadSelect disabled={bloqueoBase} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={9}>
            <Form.Item name="fecha_desde" label="Desde" rules={[{ required: true, message: 'Indique la fecha' }]}>
              <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} disabled={bloqueoBase} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={9}>
            <Form.Item
              name="fecha_hasta"
              label="Hasta"
              rules={[{ required: tipo ? !tipo.permite_sin_fecha_fin : false, message: 'Este tipo requiere fecha de fin' }]}
              extra={tipo?.permite_sin_fecha_fin ? 'Puede quedar vacía (novedad abierta).' : undefined}
            >
              <DatePicker
                format={FORMATO_FECHA}
                style={{ width: '100%' }}
                disabled={enHistorial}
                // En curso sólo puede extenderse; para acortarla se usa "Interrumpir".
                disabledDate={(d) =>
                  (desde ? d.isBefore(desde, 'day') : false) ||
                  (enCurso && !!novedad?.fecha_hasta && d.isBefore(novedad.fecha_hasta, 'day'))
                }
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item name="dias" label="Días" extra={computo}>
              <InputNumber min={0} style={{ width: '100%' }} disabled={!hasta || bloqueoBase} />
            </Form.Item>
          </Col>
        </Row>
        {tipo?.descuenta_saldo && saldo && disponibleTrasCarga !== undefined && (
          <Alert
            type={disponibleTrasCarga - (dias ?? 0) < 0 ? 'error' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <>
                Saldo disponible ({nombreBolsa(saldo)}): <b>{disponibleTrasCarga}</b> día(s)
                <Typography.Text type="secondary"> (acreditados {saldo.acreditados}, usados {saldo.usados}, programados {saldo.programados})</Typography.Text>
              </>
            }
          />
        )}
        <Form.Item name="motivo" label="Motivo">
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="observaciones" label="Observaciones">
          <Input.TextArea rows={2} />
        </Form.Item>
        {novedad ? (
          <>
            <Divider orientation="left" plain>
              Documentación respaldatoria
            </Divider>
            <DocumentosNovedad novedadId={novedad.id} />
          </>
        ) : (
          puedeAdjuntar && (
            <Form.Item
              label="Documentación respaldatoria"
              extra={
                tipo?.requiere_documentacion
                  ? `${tipo.nombre} requiere documentación. Es opcional ahora: si no la tiene, puede adjuntarla más tarde desde Editar.`
                  : 'Opcional. PDF, imágenes o documentos de texto.'
              }
            >
              <Upload
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.odt"
                fileList={adjuntos}
                beforeUpload={() => false}
                onChange={({ fileList }) => setAdjuntos(fileList)}
              >
                <Button icon={<PaperClipOutlined />}>Adjuntar archivos</Button>
              </Upload>
            </Form.Item>
          )
        )}
      </Form>
    </Modal>
  );
}
