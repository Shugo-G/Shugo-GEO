import { useState } from 'react';
import { App, DatePicker, Modal, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { mensajeError } from '@/core/api/client';
import { FORMATO_FECHA, aApi, fmtFecha } from '@/core/utils/format';
import { cerrarNovedad, type Novedad } from '@/shared/api/novedades';

/** Cierra una novedad abierta (p. ej. una ausencia sin fecha de fin) indicando hasta cuándo duró. */
export default function CerrarNovedadModal({ novedad, onClose }: { novedad: Novedad | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState<Dayjs | null>(dayjs());
  const [guardando, setGuardando] = useState(false);

  const confirmar = async () => {
    if (!novedad || !fecha) return;
    setGuardando(true);
    try {
      await cerrarNovedad(novedad.id, aApi(fecha)!);
      message.success('Novedad cerrada');
      qc.invalidateQueries();
      onClose();
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={!!novedad} title="Cerrar novedad" onCancel={onClose} onOk={confirmar} okText="Cerrar novedad" confirmLoading={guardando} destroyOnHidden>
      {novedad && (
        <>
          <Typography.Paragraph>
            <b>{novedad.empleado_nombre}</b> — {novedad.tipo_nombre} desde el {fmtFecha(novedad.fecha_desde)}.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">Indique el último día de la novedad:</Typography.Paragraph>
          <DatePicker
            value={fecha}
            onChange={setFecha}
            format={FORMATO_FECHA}
            disabledDate={(d) => d.isBefore(dayjs(novedad.fecha_desde), 'day')}
            style={{ width: '100%' }}
          />
        </>
      )}
    </Modal>
  );
}
