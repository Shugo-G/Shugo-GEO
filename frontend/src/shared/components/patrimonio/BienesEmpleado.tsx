import { useState } from 'react';
import { Button, Segmented, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Can } from '@/core/auth/guards';
import { cargosApi } from '@/shared/api/patrimonio';
import CargoFormModal from './CargoFormModal';
import TablaCargos from './TablaCargos';

/** Pestaña de la ficha: bienes a cargo del agente y su historial. */
export default function BienesEmpleado({ empleadoId }: { empleadoId: number }) {
  const [situacion, setSituacion] = useState<'vigentes' | 'historial'>('vigentes');
  const [asignar, setAsignar] = useState(false);
  const { data: cargos = [], isFetching } = cargosApi.useTodos({ empleado: empleadoId, situacion });

  return (
    <>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }} wrap>
        <Segmented
          value={situacion}
          onChange={(v) => setSituacion(v as 'vigentes' | 'historial')}
          options={[
            { label: 'A cargo', value: 'vigentes' },
            { label: 'Historial (bajas / transferidos)', value: 'historial' },
          ]}
        />
        <Can permiso="patrimonio.add_cargopatrimonial">
          <Button icon={<PlusOutlined />} onClick={() => setAsignar(true)}>
            Asignar bien
          </Button>
        </Can>
      </Space>
      <TablaCargos
        cargos={cargos}
        loading={isFetching}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
      />
      <CargoFormModal open={asignar} empleadoId={empleadoId} onClose={() => setAsignar(false)} />
    </>
  );
}
