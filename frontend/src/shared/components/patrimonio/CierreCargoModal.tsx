import { useEffect, useState } from 'react';
import { Alert, App, DatePicker, Descriptions, Form, Input, Modal, Segmented, type UploadFile } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, fmtFecha } from '@/core/utils/format';
import { usePermiso } from '@/core/auth/AuthContext';
import { darDeBajaCargo, documentosCargoApi, transferirCargo, type CargoPatrimonial } from '@/shared/api/patrimonio';
import { AdjuntosPendientes, subirPendientes } from '@/shared/components/ListaDocumentos';
import { EmpleadoSelect } from '@/shared/components/Selects';
import { PERMISOS_DOCUMENTOS_CARGO } from './DocumentosCargo';

export type AccionCierre = 'baja' | 'transferir';

interface Props {
  cargo: CargoPatrimonial | null;
  accion: AccionCierre;
  onClose: () => void;
}

interface Valores {
  fecha: Dayjs;
  motivo?: string;
  empleado?: number;
  area_externa?: string;
  planilla_cargo?: string;
  adjuntos?: UploadFile[];
}

/**
 * Cierre de un cargo:
 * - Dar de baja: el insumo queda fuera de servicio (su IUB no puede volver a asignarse).
 * - Transferir a otro empleado: se cierra este cargo y se abre uno nuevo a su nombre,
 *   con el mismo IUB y una planilla de cargo nueva.
 * - Transferir a otra área (ajena a Informática): se cierra con ese destino; el bien queda sin agente.
 * En todos los casos el cargo queda en el historial.
 *
 * Archivos: en la transferencia a otro empleado van al cargo nuevo (nueva planilla);
 * en la baja o la transferencia a otra área, al cargo que se cierra (actas, notas).
 * Los archivos anteriores quedan en el cargo cerrado como referencia.
 */
export default function CierreCargoModal({ cargo, accion, onClose }: Props) {
  const [form] = Form.useForm<Valores>();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [destino, setDestino] = useState<'empleado' | 'area'>('empleado');
  const [guardando, setGuardando] = useState(false);
  const puedeAdjuntar = usePermiso(PERMISOS_DOCUMENTOS_CARGO.subir);

  useEffect(() => {
    if (!cargo) return;
    form.resetFields();
    form.setFieldsValue({ fecha: dayjs() });
    setDestino('empleado');
  }, [cargo, form]);

  const confirmar = async () => {
    if (!cargo) return;
    const v = await form.validateFields();
    setGuardando(true);
    try {
      const base = { fecha: aApi(v.fecha)!, motivo: v.motivo ?? '' };
      let cerrado: CargoPatrimonial;
      let exito: string;
      if (accion === 'baja') {
        cerrado = await darDeBajaCargo(cargo.id, base);
        exito = 'Bien dado de baja';
      } else if (destino === 'empleado') {
        cerrado = await transferirCargo(cargo.id, { ...base, empleado: v.empleado, planilla_cargo: v.planilla_cargo });
        exito = 'Bien transferido';
      } else {
        cerrado = await transferirCargo(cargo.id, { ...base, area_externa: v.area_externa });
        exito = 'Bien transferido a otra área';
      }
      const fallidos = v.adjuntos?.length
        ? await subirPendientes(v.adjuntos, (archivo) => documentosCargoApi.subir(cerrado.transferido_a ?? cerrado.id, archivo))
        : [];
      if (fallidos.length) message.warning(`${exito}, pero no se pudo adjuntar: ${fallidos.join(', ')}. Puede hacerlo desde la tabla (Archivos).`);
      else message.success(exito);
      qc.invalidateQueries();
      onClose();
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos.map((c) => ({ ...c, name: c.name === 'destino' ? 'area_externa' : c.name })) as never);
      else message.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={!!cargo}
      title={accion === 'baja' ? 'Dar de baja el bien' : 'Transferir bien'}
      onCancel={onClose}
      onOk={confirmar}
      okText={accion === 'baja' ? 'Dar de baja' : 'Transferir'}
      okButtonProps={{ danger: accion === 'baja' }}
      confirmLoading={guardando}
      destroyOnHidden
    >
      {cargo && (
        <>
          <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Bien">
              {cargo.tipo_insumo_nombre}
              {cargo.iub && ` · IUB ${cargo.iub}`}
            </Descriptions.Item>
            <Descriptions.Item label="A cargo de">
              {cargo.empleado_nombre} (legajo {cargo.legajo}) desde el {fmtFecha(cargo.fecha_asignacion)}
            </Descriptions.Item>
          </Descriptions>
          <Form form={form} layout="vertical" requiredMark="optional">
            {accion === 'transferir' && (
              <Form.Item label="Destino">
                <Segmented
                  block
                  value={destino}
                  onChange={(v) => setDestino(v as 'empleado' | 'area')}
                  options={[
                    { label: 'A otro empleado', value: 'empleado' },
                    { label: 'A otra área (fuera de Informática)', value: 'area' },
                  ]}
                />
              </Form.Item>
            )}
            {accion === 'transferir' && destino === 'empleado' && (
              <>
                <Form.Item name="empleado" label="Nuevo responsable" rules={[{ required: true, message: 'Seleccione el empleado' }]}>
                  <EmpleadoSelect />
                </Form.Item>
                <Form.Item
                  name="planilla_cargo"
                  label="Nueva planilla de cargo"
                  rules={[
                    { required: true, whitespace: true, message: 'Indique la nueva planilla de cargo' },
                    {
                      validator: (_, valor?: string) =>
                        valor && valor.trim().toLowerCase() === cargo.planilla_cargo.toLowerCase()
                          ? Promise.reject(new Error('Debe ser distinta de la planilla actual'))
                          : Promise.resolve(),
                    },
                  ]}
                  extra={`Planilla actual: ${cargo.planilla_cargo}. El IUB (${cargo.iub}) se mantiene.`}
                >
                  <Input maxLength={60} />
                </Form.Item>
              </>
            )}
            {accion === 'transferir' && destino === 'area' && (
              <Form.Item
                name="area_externa"
                label="Área de destino"
                rules={[{ required: true, message: 'Indique el área' }]}
                extra="El bien queda sin agente a cargo; el historial conserva quién lo tuvo."
              >
                <Input maxLength={160} placeholder="Ej.: Secretaría de Hacienda" />
              </Form.Item>
            )}
            {accion === 'baja' && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="El insumo queda fuera de servicio."
                description="El cargo se cierra y queda en el historial. Un bien dado de baja no puede volver a asignarse."
              />
            )}
            <Form.Item name="fecha" label={accion === 'baja' ? 'Fecha de baja' : 'Fecha de transferencia'} rules={[{ required: true }]}>
              <DatePicker
                format={FORMATO_FECHA}
                style={{ width: '100%' }}
                disabledDate={(d) => d.isBefore(dayjs(cargo.fecha_asignacion), 'day')}
              />
            </Form.Item>
            <Form.Item name="motivo" label={accion === 'baja' ? 'Motivo de la baja' : 'Motivo / observaciones'}>
              <Input maxLength={255} />
            </Form.Item>
            {puedeAdjuntar && (
              <Form.Item
                name="adjuntos"
                label={
                  accion === 'baja'
                    ? 'Acta de baja u otros archivos'
                    : destino === 'empleado'
                      ? 'Nueva planilla de cargo firmada'
                      : 'Acta o nota de transferencia'
                }
                extra={
                  accion === 'transferir' && destino === 'empleado'
                    ? 'Opcional. Se adjunta al cargo nuevo; la planilla anterior queda en el historial como referencia.'
                    : 'Opcional. Se adjunta a este cargo, que queda en el historial.'
                }
              >
                <AdjuntosPendientes />
              </Form.Item>
            )}
          </Form>
        </>
      )}
    </Modal>
  );
}
