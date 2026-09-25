import { useEffect, useState } from 'react';
import { Alert, App, DatePicker, Descriptions, Form, Input, Modal } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, fmtFecha } from '@/core/utils/format';
import { calcularDias, interrumpirNovedad, type Novedad } from '@/shared/api/novedades';

/**
 * Interrumpe una licencia (el agente vuelve antes de lo previsto).
 * Muestra cuántos días se reintegran al saldo antes de confirmar.
 */
export default function InterrumpirNovedadModal({ novedad, onClose }: { novedad: Novedad | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [ultimoDia, setUltimoDia] = useState<Dayjs | null>(null);
  const [motivo, setMotivo] = useState('');
  const [diasNuevos, setDiasNuevos] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!novedad) return;
    const ayer = dayjs().subtract(1, 'day');
    const desde = dayjs(novedad.fecha_desde);
    const hasta = dayjs(novedad.fecha_hasta);
    // Sugerencia: ayer, dentro del período de la licencia.
    setUltimoDia(ayer.isBefore(desde) ? desde : ayer.isBefore(hasta) ? ayer : hasta.subtract(1, 'day'));
    setMotivo('');
  }, [novedad]);

  useEffect(() => {
    if (!novedad || !ultimoDia) return;
    let vigente = true;
    calcularDias(novedad.tipo, novedad.fecha_desde, aApi(ultimoDia))
      .then((r) => vigente && setDiasNuevos(r.dias))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [novedad, ultimoDia]);

  const confirmar = async () => {
    if (!novedad || !ultimoDia) return;
    setGuardando(true);
    try {
      const r = await interrumpirNovedad(novedad.id, aApi(ultimoDia)!, motivo);
      message.success(
        r.descuenta_saldo
          ? `Licencia interrumpida. Se reintegraron ${r.dias_reintegrados} día(s) al saldo.`
          : 'Licencia interrumpida.',
      );
      qc.invalidateQueries();
      onClose();
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const reintegro = novedad && diasNuevos !== null ? (novedad.dias ?? 0) - diasNuevos : null;

  return (
    <Modal
      open={!!novedad}
      title="Interrumpir licencia"
      onCancel={onClose}
      onOk={confirmar}
      okText="Interrumpir"
      okButtonProps={{ danger: true, disabled: !ultimoDia }}
      confirmLoading={guardando}
      destroyOnHidden
    >
      {novedad && (
        <>
          <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Agente">{novedad.empleado_nombre}</Descriptions.Item>
            <Descriptions.Item label="Licencia">{novedad.tipo_nombre}</Descriptions.Item>
            <Descriptions.Item label="Período actual">
              {fmtFecha(novedad.fecha_desde)} al {fmtFecha(novedad.fecha_hasta)} ({novedad.dias} días)
            </Descriptions.Item>
          </Descriptions>
          <Form layout="vertical">
            <Form.Item label="Último día efectivamente tomado" required>
              <DatePicker
                value={ultimoDia}
                onChange={setUltimoDia}
                format={FORMATO_FECHA}
                style={{ width: '100%' }}
                disabledDate={(d) => d.isBefore(dayjs(novedad.fecha_desde), 'day') || !d.isBefore(dayjs(novedad.fecha_hasta), 'day')}
              />
            </Form.Item>
            <Form.Item label="Motivo de la interrupción">
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} placeholder="Ej.: reintegro por necesidad del servicio" />
            </Form.Item>
          </Form>
          {reintegro !== null && (
            <Alert
              type={novedad.descuenta_saldo ? 'success' : 'info'}
              showIcon
              message={
                novedad.descuenta_saldo
                  ? `Quedarán ${diasNuevos} día(s) tomados y se reintegrarán ${reintegro} día(s) al saldo.`
                  : `Quedarán ${diasNuevos} día(s) registrados. Este tipo de licencia no descuenta saldo.`
              }
            />
          )}
        </>
      )}
    </Modal>
  );
}
