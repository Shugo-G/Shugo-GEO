import { useMemo, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Empty, Form, List, Row, Select, Space, Table, Typography } from 'antd';
import { EyeOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { api, mensajeError } from '@/core/api/client';
import { limpiarParams } from '@/core/api/crud';
import PageHeader from '@/core/components/PageHeader';
import { descargarArchivo } from '@/core/utils/descargar';
import { FORMATO_FECHA, fmtFecha } from '@/core/utils/format';
import { SITUACIONES } from '@/shared/api/empleados';
import { CategoriaSelect, EmpleadoSelect, InsumoSelect, ModalidadSelect, TipoNovedadSelect, UnidadSelect } from '@/shared/components/Selects';

interface FiltroReporte {
  nombre: string;
  etiqueta: string;
  requerido: boolean;
  multiple: boolean;
}

interface Reporte {
  clave: string;
  titulo: string;
  descripcion: string;
  grupo: string;
  filtros: FiltroReporte[];
}

interface Resultado {
  titulo: string;
  subtitulo: string;
  columnas: { clave: string; titulo: string; tipo: string }[];
  filas: Record<string, unknown>[];
}

/**
 * Componente de formulario para cada tipo de filtro que declara el backend (apps/reportes/base.py).
 * Form.Item le inyecta `value` y `onChange`: se reenvían al control para que el valor quede en el formulario.
 */
function CampoFiltro({ filtro, ...control }: { filtro: FiltroReporte; value?: never; onChange?: (valor: unknown) => void }) {
  const modo = filtro.multiple ? ('multiple' as const) : undefined;
  const props = control as Record<string, unknown>;
  switch (filtro.nombre) {
    case 'fecha':
      return <DatePicker format={FORMATO_FECHA} style={{ width: '100%' }} {...props} />;
    case 'periodo':
      return <DatePicker.RangePicker format={FORMATO_FECHA} style={{ width: '100%' }} {...props} />;
    case 'unidad':
      return <UnidadSelect multiple={filtro.multiple} placeholder="Todas" {...props} />;
    case 'modalidad':
      return <ModalidadSelect mode={modo} placeholder="Todas" {...props} />;
    case 'empleado':
      return <EmpleadoSelect mode={modo} incluirBajas placeholder="Todos" {...props} />;
    case 'tipo_novedad':
      return <TipoNovedadSelect mode={modo} soloActivos={false} placeholder="Todos" {...props} />;
    case 'tipo_saldo':
      return <TipoNovedadSelect mode={modo} soloConSaldo placeholder="Todos" {...props} />;
    case 'categoria':
      return <CategoriaSelect mode={modo} placeholder="Todas" {...props} />;
    case 'tipo_insumo':
      return <InsumoSelect mode={modo} placeholder="Todos" {...props} />;
    case 'situacion_cargo':
      return (
        <Select
          options={[
            { value: 'vigentes', label: 'A cargo' },
            { value: 'historial', label: 'Dados de baja / transferidos' },
            { value: 'todos', label: 'Todos' },
          ]}
          placeholder="A cargo"
          allowClear
          {...props}
        />
      );
    case 'situacion_revista':
      return <Select mode={modo} allowClear options={SITUACIONES} placeholder="Todas" {...props} />;
    default:
      return <Typography.Text type="danger">Filtro "{filtro.nombre}" sin componente</Typography.Text>;
  }
}

function valoresAParams(valores: Record<string, unknown>) {
  const params: Record<string, unknown> = {};
  Object.entries(valores).forEach(([clave, valor]) => {
    if (clave === 'periodo' && Array.isArray(valor)) {
      params.desde = (valor[0] as Dayjs | undefined)?.format('YYYY-MM-DD');
      params.hasta = (valor[1] as Dayjs | undefined)?.format('YYYY-MM-DD');
    } else if (dayjs.isDayjs(valor)) {
      params[clave] = valor.format('YYYY-MM-DD');
    } else {
      params[clave] = valor;
    }
  });
  return limpiarParams(params as never);
}

export default function ReportesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [claveActual, setClaveActual] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);

  const { data: reportes = [], isLoading } = useQuery({
    queryKey: ['reportes'],
    queryFn: async () => (await api.get<Reporte[]>('/reportes/')).data,
  });
  const reporte = reportes.find((r) => r.clave === claveActual);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Reporte[]>();
    reportes.forEach((r) => mapa.set(r.grupo, [...(mapa.get(r.grupo) ?? []), r]));
    return [...mapa.entries()];
  }, [reportes]);

  const seleccionar = (r: Reporte) => {
    setClaveActual(r.clave);
    setResultado(null);
    form.resetFields();
    form.setFieldsValue({
      fecha: dayjs(),
      periodo: [dayjs().startOf('month'), dayjs().endOf('month')],
    });
  };

  const ejecutar = async (formato: 'json' | 'xlsx' | 'pdf') => {
    if (!reporte) return;
    const valores = await form.validateFields();
    const params = { ...valoresAParams(valores), formato };
    setCargando(formato);
    try {
      if (formato === 'json') {
        const { data } = await api.get<Resultado>(`/reportes/${reporte.clave}/`, { params });
        setResultado(data);
      } else {
        await descargarArchivo(`/reportes/${reporte.clave}/`, params, `${reporte.clave}.${formato}`);
      }
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setCargando(null);
    }
  };

  return (
    <>
      <PageHeader titulo="Reportes" subtitulo="Generación y exportación de información a Excel o PDF" />
      <Row gutter={16}>
        <Col xs={24} lg={8} xl={7}>
          <Card size="small" loading={isLoading} style={{ marginBottom: 16 }}>
            {grupos.map(([grupo, items]) => (
              <div key={grupo} style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary" strong style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  {grupo}
                </Typography.Text>
                <List
                  size="small"
                  dataSource={items}
                  renderItem={(r) => (
                    <List.Item
                      onClick={() => seleccionar(r)}
                      style={{
                        cursor: 'pointer',
                        paddingLeft: 8,
                        borderRadius: 6,
                        background: r.clave === claveActual ? 'rgba(31,78,121,0.08)' : undefined,
                      }}
                    >
                      <Space>
                        <FileTextOutlined />
                        {r.titulo}
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={16} xl={17}>
          {!reporte ? (
            <Card>
              <Empty description="Seleccione un reporte de la lista" />
            </Card>
          ) : (
            <>
              <Card size="small" title={reporte.titulo} style={{ marginBottom: 16 }}>
                <Typography.Paragraph type="secondary">{reporte.descripcion}</Typography.Paragraph>
                <Form form={form} layout="vertical">
                  <Row gutter={12}>
                    {reporte.filtros.map((f) => (
                      <Col key={f.nombre} xs={24} md={12} xl={8}>
                        <Form.Item name={f.nombre} label={f.etiqueta} rules={[{ required: f.requerido, message: 'Obligatorio' }]}>
                          <CampoFiltro filtro={f} />
                        </Form.Item>
                      </Col>
                    ))}
                  </Row>
                </Form>
                <Space wrap>
                  <Button icon={<EyeOutlined />} loading={cargando === 'json'} onClick={() => ejecutar('json')}>
                    Vista previa
                  </Button>
                  <Button icon={<FileExcelOutlined />} loading={cargando === 'xlsx'} onClick={() => ejecutar('xlsx')} style={{ color: '#1d6f42' }}>
                    Excel
                  </Button>
                  <Button icon={<FilePdfOutlined />} loading={cargando === 'pdf'} onClick={() => ejecutar('pdf')} danger>
                    PDF
                  </Button>
                </Space>
              </Card>
              {resultado && (
                <Card size="small" title={resultado.titulo} extra={<Typography.Text type="secondary">{resultado.subtitulo}</Typography.Text>}>
                  <Table
                    size="small"
                    rowKey={(_, i) => String(i)}
                    dataSource={resultado.filas}
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 25, showTotal: (t) => `${t} registros` }}
                    columns={resultado.columnas.map((c) => ({
                      title: c.titulo,
                      dataIndex: c.clave,
                      align: c.tipo === 'numero' ? ('right' as const) : undefined,
                      render: (v: unknown) => (c.tipo === 'fecha' ? fmtFecha(v as string | null) : (v as React.ReactNode) ?? ''),
                    }))}
                  />
                </Card>
              )}
            </>
          )}
        </Col>
      </Row>
    </>
  );
}
