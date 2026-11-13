import { useState } from 'react';
import { App, Button, Card, Checkbox, Divider, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography, type TableColumnsType, type UploadFile } from 'antd';
import { ApartmentOutlined, CheckCircleFilled, DeleteOutlined, EditOutlined, HistoryOutlined, PaperClipOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { erroresDeCampos, mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import HistorialCambios from '@/core/components/HistorialCambios';
import PageHeader from '@/core/components/PageHeader';
import { TIPOS_UNIDAD, documentosUnidadApi, unidadesApi, useArbolUnidades, type NodoUnidad, type TipoUnidad } from '@/shared/api/catalogos';
import ListaDocumentos, { AdjuntosPendientes, subirPendientes } from '@/shared/components/ListaDocumentos';
import { UnidadSelect } from '@/shared/components/Selects';
import Organigrama from '../components/Organigrama';

interface Valores {
  nombre: string;
  tipo: TipoUnidad;
  padre?: number | null;
  descripcion?: string;
  orden?: number;
  activo: boolean;
  nombre_corto?: string;
  creada?: boolean;
  acto_administrativo?: string;
  adjuntos?: UploadFile[];
}

const PERMISOS_DOCUMENTOS = {
  ver: 'organizacion.view_documentounidad',
  subir: 'organizacion.add_documentounidad',
  eliminar: 'organizacion.delete_documentounidad',
};

/** Adjuntos del acto administrativo de una unidad. */
function DocumentosUnidad({ unidadId }: { unidadId: number }) {
  return (
    <ListaDocumentos
      fuente={{
        clave: ['organizacion/documentos-unidad', unidadId],
        listar: () => documentosUnidadApi.listar(unidadId),
        subir: (archivo) => documentosUnidadApi.subir(unidadId, archivo),
        eliminar: documentosUnidadApi.eliminar,
        urlDescarga: documentosUnidadApi.urlDescarga,
      }}
      permisos={PERMISOS_DOCUMENTOS}
      textoVacio="Sin adjuntos: puede subir el acto administrativo."
      textoBoton="Adjuntar acto administrativo"
    />
  );
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
  const [adjuntosDe, setAdjuntosDe] = useState<NodoUnidad | null>(null);
  const [vista, setVista] = useState<'lista' | 'arbol'>('arbol');
  const puedeAdjuntar = usePermiso(PERMISOS_DOCUMENTOS.subir);
  const { data: historial, isLoading: cargandoHistorial } = unidadesApi.useHistorial(historialDe?.id);

  const puedeAgregar = usePermiso('organizacion.add_unidadorganizativa');
  const puedeEditar = usePermiso('organizacion.change_unidadorganizativa');
  const puedeEliminar = usePermiso('organizacion.delete_unidadorganizativa');
  const tipo = Form.useWatch('tipo', form);
  const creada = Form.useWatch('creada', form);

  const abrir = (valores: Partial<Valores>, nodo?: NodoUnidad) => {
    form.resetFields();
    form.setFieldsValue({ activo: true, orden: 0, creada: false, ...valores });
    setEditando({ nodo });
  };

  const onGuardar = async () => {
    const v = await form.validateFields();
    try {
      const guardada = await guardar.mutateAsync({
        id: editando?.nodo?.id,
        nombre: v.nombre,
        tipo: v.tipo,
        padre: v.tipo === 'DIRECCION_GENERAL' ? null : v.padre ?? null,
        descripcion: v.descripcion ?? '',
        orden: v.orden ?? 0,
        activo: v.activo,
        nombre_corto: v.nombre_corto ?? '',
        creada: !!v.creada,
        acto_administrativo: v.creada ? v.acto_administrativo ?? '' : '',
      });
      // En el alta, el adjunto elegido se sube después de crear la unidad.
      const fallidos = v.adjuntos?.length
        ? await subirPendientes(v.adjuntos, (archivo) => documentosUnidadApi.subir(guardada.id, archivo))
        : [];
      if (fallidos.length) message.warning(`Unidad guardada, pero no se pudo adjuntar: ${fallidos.join(', ')}. Puede hacerlo desde Editar.`);
      else message.success('Unidad guardada');
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
    {
      title: 'Acto administrativo',
      key: 'acto',
      width: 230,
      render: (_, n) =>
        n.creada ? (
          <Space size={4}>
            <CheckCircleFilled style={{ color: '#52c41a' }} />
            {n.acto_administrativo}
            <Tooltip title="Ver adjuntos del acto administrativo">
              <Button type="text" size="small" icon={<PaperClipOutlined />} onClick={() => setAdjuntosDe(n)} />
            </Tooltip>
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
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
        acciones={
          <>
            <Segmented
              value={vista}
              onChange={(v) => setVista(v as 'lista' | 'arbol')}
              options={[
                { label: 'Árbol', value: 'arbol', icon: <ApartmentOutlined /> },
                { label: 'Lista', value: 'lista', icon: <UnorderedListOutlined /> },
              ]}
            />
            {puedeAgregar && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir({ tipo: arbol.length ? 'DIRECCION' : 'DIRECCION_GENERAL', padre: arbol[0]?.id })}>
                Nueva unidad
              </Button>
            )}
          </>
        }
      />
      <Card size="small">
        {vista === 'arbol' ? (
          <Organigrama arbol={arbol} onElegir={puedeEditar ? (n) => abrir({ ...n }, n) : undefined} />
        ) : (
        <Table
          rowKey="id"
          columns={columnas}
          dataSource={arbol}
          loading={isLoading}
          pagination={false}
          expandable={{ defaultExpandAllRows: true, childrenColumnName: 'children' }}
          // Árbol recién cargado: forzar re-montaje para que se expanda completo.
          key={arbol.length ? 'con-datos' : 'vacio'}
          scroll={{ x: 800 }}
        />
        )}
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
          <Form.Item
            name="nombre_corto"
            label="Nombre corto"
            tooltip="Se muestra en las tarjetas del Inicio. Si se deja vacío se usa el nombre sin el prefijo (p. ej. sin DEPARTAMENTO DE)."
          >
            <Input maxLength={60} placeholder="Automático" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="creada" valuePropName="checked" style={{ marginBottom: creada ? 8 : undefined }}>
            <Checkbox>Creada por acto administrativo</Checkbox>
          </Form.Item>
          {creada && (
            <>
              <Form.Item
                name="acto_administrativo"
                label="Acto administrativo"
                rules={[{ required: true, whitespace: true, message: 'Indique el acto administrativo' }]}
                extra="Por ejemplo: DECRETO MUNICIPAL Nº 000/2026"
              >
                <Input maxLength={120} />
              </Form.Item>
              {editando?.nodo ? (
                <>
                  <Divider orientation="left" plain style={{ margin: '4px 0 8px' }}>
                    Adjuntos del acto
                  </Divider>
                  <DocumentosUnidad unidadId={editando.nodo.id} />
                  <div style={{ height: 16 }} />
                </>
              ) : (
                puedeAdjuntar && (
                  <Form.Item name="adjuntos" label="Adjunto del acto administrativo" extra="Opcional. PDF o imagen de la resolución.">
                    <AdjuntosPendientes />
                  </Form.Item>
                )
              )}
            </>
          )}
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

      <Modal open={!!adjuntosDe} title={`Acto administrativo · ${adjuntosDe?.nombre ?? ''}`} footer={null} onCancel={() => setAdjuntosDe(null)} destroyOnHidden>
        {adjuntosDe && (
          <>
            <Typography.Paragraph type="secondary">{adjuntosDe.acto_administrativo}</Typography.Paragraph>
            <DocumentosUnidad unidadId={adjuntosDe.id} />
          </>
        )}
      </Modal>

      <Modal open={!!historialDe} title={`Historial · ${historialDe?.nombre ?? ''}`} footer={null} onCancel={() => setHistorialDe(null)} width={640}>
        <HistorialCambios datos={historial} cargando={cargandoHistorial} />
      </Modal>
    </>
  );
}
