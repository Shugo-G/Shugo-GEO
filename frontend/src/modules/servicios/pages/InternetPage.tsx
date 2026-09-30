import { Select } from 'antd';
import { useState } from 'react';
import CrudPage from '@/core/components/CrudPage';
import { internetApi, proveedoresApi, type ServicioInternet } from '@/shared/api/servicios';

function ProveedorSelect(props: { placeholder?: string; value?: number; onChange?: (v: number) => void; allowClear?: boolean; style?: React.CSSProperties }) {
  const { data = [] } = proveedoresApi.useTodos({ activo: true });
  return <Select showSearch optionFilterProp="label" options={data.map((c) => ({ value: c.id, label: c.nombre }))} {...props} />;
}

export default function InternetPage() {
  const [proveedor, setProveedor] = useState<number>();
  return (
    <CrudPage<ServicioInternet>
      titulo="Internet"
      recurso={internetApi}
      permiso="servicios.serviciointernet"
      params={{ proveedor, ordering: 'sitio' }}
      anchoModal={640}
      filtrosExtra={<ProveedorSelect placeholder="Proveedor" allowClear style={{ width: 170 }} value={proveedor} onChange={setProveedor} />}
      campos={[
        { nombre: 'sitio', etiqueta: 'Sitio', tipo: 'texto', requerido: true },
        { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'texto' },
        {
          nombre: 'proveedor',
          etiqueta: 'Proveedor',
          tipo: 'select',
          requerido: true,
          componente: <ProveedorSelect />,
          renderTabla: (_, s) => s.proveedor_nombre,
        },
        { nombre: 'numero_cliente', etiqueta: 'Número de cliente', tipo: 'texto' },
        { nombre: 'numero_fsan', etiqueta: 'Número de FSAN', tipo: 'texto' },
        { nombre: 'velocidad', etiqueta: 'Velocidad de internet', tipo: 'texto', ayuda: 'Por ejemplo: 300 Mbps.' },
        { nombre: 'ip_publica', etiqueta: 'IP pública', tipo: 'texto' },
      ]}
    />
  );
}
