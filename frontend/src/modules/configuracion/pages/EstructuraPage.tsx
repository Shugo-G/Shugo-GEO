import { useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import HistorialCambios from '@/core/components/HistorialCambios';
import PageHeader from '@/core/components/PageHeader';
import { TIPOS_UNIDAD, unidadesApi, useArbolUnidades, type NodoUnidad, type TipoUnidad } from '@/shared/api/catalogos';
import { UnidadSelect } from '@/shared/components/Selects';

interface Valores {
  nombre: string;
  tipo: TipoUnidad;
  padre?: number | null;
  descripcion?: string;
  orden?: number;
  activo: boolean;
}

const nivel = (tipo: TipoUnidad) => TIPOS_UNIDAD.findIndex((t) => t.value === tipo);
const siguienteTipo = (tipo: TipoUnidad) => TIPOS_UNIDAD[nivel(tipo) + 1]?.value;

/**
 * Estructura organizativa en árbol: Dirección General › Direcciones › Áreas.
 * El personal puede asignarse a cualquier unidad, de cualquier nivel.
 */
export default function EstructuraPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<Valores>();
  const { data: arbol = [], isLoading } = useArbolUnidades();
  const guardar = unidadesApi.useGuardar();
  const eliminar = unidadesApi.useEliminar();
  const [editando, setEditando] = useState<{ nodo?: NodoUnidad } | null>(null);
  const [historialDe, setHistorialDe] = useState<NodoUnidad | null>(null);
  const { data: historial, isLoading: cargandoHistorial } = unidadesApi.useHistorial(historialDe?.id);

  const puedeAgregar = usePermiso('organizacion.add_unidadorganizativa');
  const puedeEditar = usePermiso('organizacion.change_unidadorganizativa');
  const puedeEliminar = usePermiso('organizacion.delete_unidadorganizativa');
  const tipo = Form.useWatch('tipo', form);

  const abrir = (valores: Partial<Valores>, nodo?: NodoUnidad) => {
    form.resetFields();
    form.setFieldsValue({ activo: true, orden: 0, ...valores });
    setEditando({ nodo });
  };

  const onGuardar = async () => {
    const v = await form.validateFields();
    try {
      await guardar.mutateAsync({
        id: editando?.nodo?.id,
        nombre: v.nombre,
        tipo: v.tipo,
        padre: v.tipo === 'DIRECCION_GENERAL' ? null : v.padre ?? null,
        descripcion: v.descripcion ?? '',
        orden: v.orden ?? 0,
        activo: v.activo,
      });
      message.success('Unidad guardada');
      setEditando(null);
    } catch (e) {
      const campos = erroresDeCampos(e);
      if (campos.length) form.setFields(campos as never);
      else message.error(mensajeError(e));
    }
  };

  const columnas: TableColumnsType<NodoUnidad> = [
    {
      title: 'Unidad',
      dataIndex: 'nombre',
      render: (nombre, n) => (
        <Space>
          <Typography.Text strong={n.tipo !== 'AREA'} type={n.activo ? undefined : 'secondary'}>
            {nombre}
          </Typography.Text>
          <Tag color={TIPOS_UNIDAD.find((t) => t.value === n.tipo)?.color} bordered={false}>
            {n.tipo_display}
          </Tag>
          {!n.activo && <Tag>Inactiva</Tag>}
        </Space>
      ),
    },
    {
      title: (
        <Tooltip title="Agentes activos asignados directamente a la unidad / incluyendo sus dependientes">
          Agentes (directos / total)
        </Tooltip>
      ),
      key: 'empleados',
      width: 200,
      align: 'center',
      render: (_, n) => (
        <span>
          <b>{n.empleados}</b>
          <Typography.Text type="secondary"> / {n.empleados_total}</Typography.Text>
        </span>
      ),
    },
    { title: 'Orden', dataIndex: 'orden', width: 80, align: 'center' },
    {
      key: 'acciones',
      width: 170,
      align: 'right',
      render: (_, n) => {
        const hijo = siguienteTipo(n.tipo);
        return (
          <Space size={0}>
            {puedeAgregar && hijo && (
              <Tooltip title={`Agregar ${TIPOS_UNIDAD.find((t) => t.value === hijo)?.label.toLowerCase()} dependiente`}>
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => abrir({ tipo: hijo, padre: n.id })} />
              </Tooltip>
            )}
            <Tooltip title="Historial de cambios">
              <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setHistorialDe(n)} />
            </Tooltip>
            {puedeEditar && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => abrir({ ...n, descripcion: n.descripcion }, n)}
              />
            )}
            {puedeEliminar && (
              <Popconfirm
                title="¿Eliminar la unidad?"
                description="No se puede eliminar si tiene personal o unidades dependientes; en ese caso desactívela."
                onConfirm={() => eliminar.mutateAsync(n.id).catch((e) => message.error(mensajeError(e)))}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Estructura organizativa"
        subtitulo="Dirección General › Direcciones › Áreas. El personal puede depender de cualquier unidad."
        acciones={
          puedeAgregar && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir({ tipo: arbol.length ? 'DIRECCION' : 'DIRECCION_GENERAL', padre: arbol[0]?.id })}>
              Nueva unidad
            </Button>
          )
        }
      />
      <Card size="small">
        <Table
          rowKey="id"
          columns={columnas}
          dataSource={arbol}
          loading={isLoading}
          pagination={false}
          expandable={{ defaultExpandAllRows: true, childrenColumnName: 'children' }}
          // Árbol recién cargado: forzar re-montaje para que se expanda completo.
          key={arbol.length ? 'con-datos' : 'vacio'}
          scroll={{ x: 600 }}
        />
      </Card>

      <Modal
        open={!!editando}
        title={editando?.nodo ? `Editar · ${editando.nodo.nombre}` : 'Nueva unidad organizativa'}
        onCancel={() => setEditando(null)}
        onOk={onGuardar}
        okText="Guardar"
        confirmLoading={guardar.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Obligatorio' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select options={TIPOS_UNIDAD.map(({ value, label }) => ({ value, label }))} />
          </Form.Item>
          {tipo !== 'DIRECCION_GENERAL' && (
            <Form.Item name="padre" label="Depende de" rules={[{ required: true, message: 'Indique de qué unidad depende' }]}>
              <UnidadSelect soloActivas={false} allowClear={false} />
            </Form.Item>
          )}
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="orden" label="Orden" extra="Posición entre sus pares.">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="activo" label="Activa" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal open={!!historialDe} title={`Historial · ${historialDe?.nombre ?? ''}`} footer={null} onCancel={() => setHistorialDe(null)} width={640}>
        <HistorialCambios datos={historial} cargando={cargandoHistorial} />
      </Modal>
    </>
  );
}
