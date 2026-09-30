import { Badge, Select, TreeSelect, Typography, type SelectProps, type TreeSelectProps } from 'antd';
import type { Catalogo, Params } from '@/core/api/types';
import { useArbolUnidades, modalidadesApi, tiposNovedadApi, type NodoUnidad, type TipoNovedad } from '@/shared/api/catalogos';
import { empleadosApi } from '@/shared/api/empleados';
import { insumosApi } from '@/shared/api/patrimonio';
import { COLOR_ACTIVO } from '@/app/theme';

type Recurso<T extends Catalogo> = { useTodos: (params?: Params) => { data?: T[]; isLoading: boolean } };

type BaseProps = Omit<SelectProps, 'options'> & { soloActivos?: boolean };

/** Select genérico para cualquier catálogo configurable. */
function CatalogoSelect<T extends Catalogo>({
  recurso,
  soloActivos = true,
  params,
  renderLabel,
  ...props
}: BaseProps & { recurso: Recurso<T>; params?: Params; renderLabel?: (item: T) => React.ReactNode }) {
  const { data = [], isLoading } = recurso.useTodos({ ...(soloActivos ? { activo: true } : {}), ...params });
  return (
    <Select
      allowClear
      showSearch
      optionFilterProp="texto"
      loading={isLoading}
      maxTagCount="responsive"
      options={data.map((item) => ({ value: item.id, label: renderLabel ? renderLabel(item) : item.nombre, texto: item.nombre }))}
      {...props}
    />
  );
}

/** Convierte el árbol de unidades al formato de TreeSelect. */
function aTreeData(nodos: NodoUnidad[]): TreeSelectProps['treeData'] {
  return nodos.map((n) => ({
    value: n.id,
    nombre: n.nombre,
    title: (
      <span>
        {n.nombre}{' '}
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {n.tipo_display}
        </Typography.Text>
      </span>
    ),
    children: aTreeData(n.children),
  }));
}

/**
 * Selector jerárquico de unidades organizativas (Dirección General › Dirección › Área).
 * En filtros, elegir una unidad incluye a todo el personal de sus dependientes.
 */
export const UnidadSelect = ({
  soloActivas = true,
  ...props
}: Omit<TreeSelectProps, 'treeData'> & { soloActivas?: boolean }) => {
  const { data = [], isLoading } = useArbolUnidades(soloActivas);
  return (
    <TreeSelect
      allowClear
      showSearch
      placeholder="Unidad organizativa"
      treeNodeFilterProp="nombre"
      treeNodeLabelProp="nombre"
      treeDefaultExpandAll
      loading={isLoading}
      maxTagCount="responsive"
      popupMatchSelectWidth={false}
      treeData={aTreeData(data)}
      {...props}
    />
  );
};

export const InsumoSelect = (props: BaseProps) => <CatalogoSelect recurso={insumosApi} placeholder="Categoría de insumo" {...props} />;
export const ModalidadSelect = (props: BaseProps) => (
  <CatalogoSelect recurso={modalidadesApi} placeholder="Modalidad" {...props} />
);

export const TipoNovedadSelect = (props: BaseProps & { soloConSaldo?: boolean }) => {
  const { soloConSaldo, ...resto } = props;
  return (
    <CatalogoSelect<TipoNovedad>
      recurso={tiposNovedadApi}
      placeholder="Artículo de licencia"
      params={soloConSaldo ? { descuenta_saldo: true } : undefined}
      renderLabel={(t) => <Badge color={t.color} text={t.nombre} />}
      {...resto}
    />
  );
};

/** Estado para filtros del Inicio: "Trabajando" (sin licencias) + artículos de licencia. */
export const EstadoSelect = (props: Omit<SelectProps, 'options'>) => {
  const { data = [] } = tiposNovedadApi.useTodos({ activo: true });
  return (
    <Select
      allowClear
      placeholder="Estado"
      maxTagCount="responsive"
      options={[
        { value: 'trabajando', label: <Badge color={COLOR_ACTIVO} text="Activo (trabajando)" /> },
        ...data.map((t) => ({ value: String(t.id), label: <Badge color={t.color} text={t.nombre} /> })),
      ]}
      {...props}
    />
  );
};

/** Selector de empleados con búsqueda por apellido, nombre, legajo o DNI. */
export const EmpleadoSelect = ({ incluirBajas = false, ...props }: Omit<SelectProps, 'options'> & { incluirBajas?: boolean }) => {
  const { data = [], isLoading } = empleadosApi.useTodos(incluirBajas ? {} : { situacion_revista: 'ACTIVO' });
  return (
    <Select
      allowClear
      showSearch
      placeholder="Empleado"
      optionFilterProp="texto"
      loading={isLoading}
      maxTagCount="responsive"
      options={data.map((e) => ({
        value: e.id,
        label: `${e.nombre_completo} (${e.legajo})`,
        texto: `${e.nombre_completo} ${e.legajo} ${e.dni}`,
      }))}
      {...props}
    />
  );
};
