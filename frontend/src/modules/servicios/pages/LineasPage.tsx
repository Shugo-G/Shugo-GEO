import { Select, Tag } from 'antd';
import { useState } from 'react';
import CrudPage from '@/core/components/CrudPage';
import type { Catalogo, Params } from '@/core/api/types';
import { estadosLineaApi, lineasApi, proveedoresApi, tiposSimApi, type LineaMovil } from '@/shared/api/servicios';

type Recurso = { useTodos: (params?: Params) => { data?: Catalogo[] } };

/** Select de un catálogo de servicios (proveedor, tipo de SIM, estado). */
function CatalogoSelect({ recurso, ...props }: { recurso: Recurso; placeholder?: string; value?: number; onChange?: (v: number) => void; allowClear?: boolean; style?: React.CSSProperties }) {
  const { data = [] } = recurso.useTodos({ activo: true });
  return <Select showSearch optionFilterProp="label" options={data.map((c) => ({ value: c.id, label: c.nombre }))} {...props} />;
}

export default function LineasPage() {
  const [filtro, setFiltro] = useState<{ proveedor?: number; estado?: number }>({});
  return (
    <CrudPage<LineaMovil>
      titulo="Líneas móviles"
      recurso={lineasApi}
      permiso="servicios.lineamovil"
      params={{ ...filtro, ordering: 'numero' }}
      anchoModal={680}
      filtrosExtra={
        <>
          <CatalogoSelect recurso={proveedoresApi} placeholder="Proveedor" allowClear style={{ width: 170 }} value={filtro.proveedor} onChange={(proveedor) => setFiltro((f) => ({ ...f, proveedor }))} />
          <CatalogoSelect recurso={estadosLineaApi} placeholder="Estado" allowClear style={{ width: 150 }} value={filtro.estado} onChange={(estado) => setFiltro((f) => ({ ...f, estado }))} />
        </>
      }
      campos={[
        { nombre: 'numero', etiqueta: 'Número de línea', tipo: 'texto', requerido: true },
        { nombre: 'numero_sim', etiqueta: 'Número de SIM', tipo: 'texto' },
        {
          nombre: 'tipo_sim',
          etiqueta: 'SIM',
          tipo: 'select',
          componente: <CatalogoSelect recurso={tiposSimApi} placeholder="Físico, virtual..." allowClear />,
          renderTabla: (_, f) => f.tipo_sim_nombre ?? '—',
        },
        {
          nombre: 'proveedor',
          etiqueta: 'Proveedor',
          tipo: 'select',
          requerido: true,
          componente: <CatalogoSelect recurso={proveedoresApi} />,
          renderTabla: (_, f) => f.proveedor_nombre,
        },
        {
          nombre: 'estado',
          etiqueta: 'Estado de la línea',
          tipo: 'select',
          requerido: true,
          componente: <CatalogoSelect recurso={estadosLineaApi} />,
          renderTabla: (_, f) => <Tag>{f.estado_nombre}</Tag>,
        },
        { nombre: 'responsable', etiqueta: 'Responsable', tipo: 'texto' },
        { nombre: 'area', etiqueta: 'Área', tipo: 'texto' },
        { nombre: 'secretaria', etiqueta: 'Secretaría', tipo: 'texto' },
        { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
      ]}
    />
  );
}
