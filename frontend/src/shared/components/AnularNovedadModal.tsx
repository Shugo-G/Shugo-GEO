import { useState } from 'react';
import { Alert, App, Descriptions, Form, Input, Modal } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { mensajeError } from '@/core/api/client';
import { fmtFecha } from '@/core/utils/format';
import { anularNovedad, type Novedad } from '@/shared/api/novedades';

/**
 * Anulación de una licencia cargada por error. A diferencia de eliminar, el
 * registro se conserva con el motivo, quién y cuándo; sus días vuelven al saldo.
 */
export default function AnularNovedadModal({ novedad, onClose }: { novedad: Novedad | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [faltaMotivo, setFaltaMotivo] = useState(false);

  const cerrar = () => {
    setMotivo('');
    setFaltaMotivo(false);
    onClose();
  };

  const confirmar = async () => {
    if (!novedad) return;
    if (!motivo.trim()) {
      setFaltaMotivo(true);
      return;
    }
    setGuardando(true);
    try {
      await anularNovedad(novedad.id, motivo);
      message.success('Licencia anulada');
      qc.invalidateQueries();
      cerrar();
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open={!!novedad}
      title="Anular licencia"
      onCancel={cerrar}
      onOk={confirmar}
      okText="Anular"
      okButtonProps={{ danger: true }}
      confirmLoading={guardando}
      destroyOnHidden
    >
      {novedad && (
        <>
          <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Agente">{novedad.empleado_nombre}</Descriptions.Item>
            <Descriptions.Item label="Licencia">{novedad.tipo_nombre}</Descriptions.Item>
            <Descriptions.Item label="Período">
              {fmtFecha(novedad.fecha_desde)} al {novedad.fecha_hasta ? fmtFecha(novedad.fecha_hasta) : 'sin fecha de fin'}
              {novedad.dias != null && ` (${novedad.dias} días)`}
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Use esta opción sólo si la licencia fue cargada por error."
            description={
              <>
                La licencia queda registrada como anulada y deja de contar en el Inicio, el calendario y los reportes.
                {novedad.descuenta_saldo && novedad.dias ? ` Se reintegrarán ${novedad.dias} día(s) al saldo.` : ''} Si el
                agente volvió antes de lo previsto, use "Interrumpir".
              </>
            }
          />
          <Form layout="vertical">
            <Form.Item
              label="Motivo de la anulación"
              required
              validateStatus={faltaMotivo ? 'error' : undefined}
              help={faltaMotivo ? 'Indique el motivo para poder anular.' : undefined}
            >
              <Input.TextArea
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setFaltaMotivo(false);
                }}
                rows={2}
                maxLength={255}
                autoFocus
                placeholder="Ej.: se cargó al agente equivocado"
              />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}
