import { useState, type ReactNode } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd';
import { DeleteOutlined, EditOutlined, HistoryOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import type { crearRecurso } from '@/core/api/crud';
import type { Opcion, Params } from '@/core/api/types';
import { useAuth } from '@/core/auth/AuthContext';
import { FORMATO_FECHA, fmtFecha } from '@/core/utils/format';
import HistorialCambios from './HistorialCambios';
import PageHeader from './PageHeader';
import SelectorColor from './SelectorColor';

export type TipoCampo = 'texto' | 'textarea' | 'numero' | 'switch' | 'color' | 'select' | 'fecha';

export interface CampoCrud<T> {
  nombre: keyof T & string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  opciones?: Opcion<string | number>[];
  /** Componente de entrada personalizado (p. ej. un Select de otro catálogo). */
  componente?: ReactNode;
  ayuda?: string;
  valorInicial?: unknown;
  /** Mostrar como columna en la tabla (por defecto sí, salvo textarea). */
  enTabla?: boolean;
  renderTabla?: (valor: unknown, fila: T) => ReactNode;
  /** Sólo se muestra en la tabla (campos de sólo lectura). */
  soloTabla?: boolean;
}

interface Props<T extends { id: number }> {
  titulo: string;
  /** Sin encabezado de página: para usarla dentro de pestañas (las acciones van junto a la búsqueda). */
  embebida?: boolean;
  recurso: ReturnType<typeof crearRecurso<T>>;
  campos: CampoCrud<T>[];
  /** "app.modelo" para derivar permisos add/change/delete (ej. "organizacion.modalidadcontratacion"). */
  permiso: string;
  /** Parámetros fijos de listado (filtros, orden). */
  params?: Params;
  filtrosExtra?: ReactNode;
  accionesExtra?: ReactNode;
  /** Acciones adicionales por fila (se muestran antes de editar/eliminar). */
  accionesFila?: (fila: T) => ReactNode;
  /** Se ejecuta después de guardar; `creado` indica si fue un alta. */
  onGuardado?: (fila: T, creado: boolean) => void;
  anchoModal?: number;
}

function renderPorDefecto(tipo: TipoCampo, valor: unknown, opciones?: Opcion<string | number>[]) {
  if (tipo === 'switch') return valor ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>;
  if (tipo === 'color') return valor ? <Badge color={String(valor)} text={String(valor)} /> : '—';
  if (tipo === 'fecha') return fmtFecha(valor as string);
  if (tipo === 'select') return opciones?.find((o) => o.value === valor)?.label ?? String(valor ?? '—');
  return (valor as ReactNode) ?? '—';
}

function entrada<T>(campo: CampoCrud<T>) {
  if (campo.componente) return campo.componente;
  switch (campo.tipo) {
    case 'textarea':
      return <Input.TextArea rows={3} />;
    case 'numero':
      return <InputNumber style={{ width: '100%' }} />;
    case 'switch':
      return <Switch />;
    case 'color':
      return <SelectorColor />;
    case 'select':
      return <Select options={campo.opciones} allowClear={!campo.requerido} />;
    case 'fecha':
      return <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} />;
    default:
      return <Input />;
  }
}

/**
 * Pantalla CRUD genérica dirigida por configuración: tabla con búsqueda,
 * alta/edición en modal, baja con confirmación e historial de cambios.
 * Se usa para todos los catálogos configurables del sistema.
 */
export default function CrudPage<T extends { id: number }>({
  titulo,
  embebida = false,
  recurso,
  campos,
  permiso,
  params,
  filtrosExtra,
  accionesExtra,
  accionesFila,
  onGuardado,
  anchoModal = 560,
}: Props<T>) {
  const { message } = App.useApp();
  const { tienePermiso } = useAuth();
  const [form] = Form.useForm();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<T | null | undefined>(undefined);
  const [historialDe, setHistorialDe] = useState<T | null>(null);

  const [app, modelo] = permiso.split('.');
  const puede = (accion: 'add' | 'change' | 'delete') => tienePermiso(`${app}.${accion}_${modelo}`);

  const { data, isFetching } = recurso.useLista({ ...params, search: busqueda || undefined, page: pagina });
  const guardar = recurso.useGuardar();
  const eliminar = recurso.useEliminar();
  const { data: historial, isLoading: cargandoHistorial } = recurso.useHistorial(historialDe?.id);

  const abrir = (fila: T | null) => {
    form.resetFields();
    if (fila) {
      const valores: Record<string, unknown> = { ...fila };
      campos.filter((c) => c.tipo === 'fecha').forEach((c) => (valores[c.nombre] = fila[c.nombre] ? dayjs(fila[c.nombre] as string) : null));
      form.setFieldsValue(valores);
    } else {
      form.setFieldsValue(Object.fromEntries(campos.filter((c) => c.valorInicial !== undefined).map((c) => [c.nombre, c.valorInicial])));
    }
    setEditando(fila);
  };

  const onGuardar = async () => {
    const valores = await form.validateFields();
    campos.forEach((c) => {
      const v = valores[c.nombre];
      if (c.tipo === 'fecha') valores[c.nombre] = v ? (v as dayjs.Dayjs).format('YYYY-MM-DD') : null;
      if (c.tipo === 'color' && v && typeof v === 'object') valores[c.nombre] = (v as { toHexString: () => string }).toHexString();
      if (v === undefined && (c.tipo === 'texto' || c.tipo === 'textarea')) valores[c.nombre] = '';
    });
    try {
      const guardado = (await guardar.mutateAsync({ ...valores, id: editando?.id } as never)) as T;
      message.success('Guardado correctamente');
      setEditando(undefined);
      onGuardado?.(guardado, !editando);
    } catch (e) {
      const errores = erroresDeCampos(e);
      if (errores.length) form.setFields(errores);
      else message.error(mensajeError(e));
    }
  };

  const columnas: TableColumnsType<T> = [
    ...campos
      .filter((c) => c.enTabla ?? c.tipo !== 'textarea')
      .map((c) => ({
        title: c.etiqueta,
        dataIndex: c.nombre,
        render: (v: unknown, fila: T) => (c.renderTabla ? c.renderTabla(v, fila) : renderPorDefecto(c.tipo, v, c.opciones)),
      })),
    {
      key: 'acciones',
      width: 130,
      align: 'right',
      render: (_, fila) => (
        <Space size={0}>
          {accionesFila?.(fila)}
          <Tooltip title="Historial de cambios">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setHistorialDe(fila)} />
          </Tooltip>
          {puede('change') && <Button type="text" size="small" icon={<EditOutlined />} onClick={() => abrir(fila)} />}
          {puede('delete') && (
            <Popconfirm
              title="¿Eliminar el registro?"
              description="Si está en uso no podrá eliminarse; desactívelo en su lugar."
              onConfirm={() => eliminar.mutateAsync(fila.id).catch((e) => message.error(mensajeError(e)))}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const acciones = (
    <>
      {accionesExtra}
      {puede('add') && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir(null)}>
          Nuevo
        </Button>
      )}
    </>
  );

  return (
    <>
      {!embebida && <PageHeader titulo={titulo} acciones={acciones} />}
      <Card size="small">
        <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar"
            style={{ width: 260 }}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
          {filtrosExtra}
          </Space>
          {embebida && <Space wrap>{acciones}</Space>}
        </Space>
        <Table
          rowKey="id"
          size="middle"
          columns={columnas}
          dataSource={data?.results}
          loading={isFetching}
          scroll={{ x: 600 }}
          pagination={{ current: pagina, pageSize: 25, total: data?.count, onChange: setPagina, hideOnSinglePage: true, showSizeChanger: false }}
        />
      </Card>

      <Modal
        open={editando !== undefined}
        title={editando ? `Editar · ${titulo}` : `Nuevo · ${titulo}`}
        onCancel={() => setEditando(undefined)}
        onOk={onGuardar}
        okText="Guardar"
        confirmLoading={guardar.isPending}
        width={anchoModal}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          {campos.filter((c) => !c.soloTabla).map((c) => (
            <Form.Item
              key={c.nombre}
              name={c.nombre as string}
              label={c.etiqueta}
              extra={c.ayuda}
              valuePropName={c.tipo === 'switch' ? 'checked' : 'value'}
              rules={c.requerido ? [{ required: true, message: 'Obligatorio' }] : undefined}
            >
              {entrada(c)}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <Modal open={!!historialDe} title="Historial de cambios" footer={null} onCancel={() => setHistorialDe(null)} width={640}>
        <HistorialCambios datos={historial} cargando={cargandoHistorial} />
      </Modal>
    </>
  );
}
