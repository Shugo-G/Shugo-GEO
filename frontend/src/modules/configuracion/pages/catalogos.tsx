/**
 * Pantallas de catálogos configurables. Cada una es una configuración de
 * CrudPage: para agregar un catálogo nuevo alcanza con declarar sus campos
 * y registrar la ruta en ../index.tsx.
 */
import { App, Badge, Button, InputNumber, Popover, Select, Space, Tag, Tooltip } from 'antd';
import { CloudDownloadOutlined, FileSearchOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api, mensajeError } from '@/core/api/client';
import type { Catalogo, DiaNoLaborable, Opcion } from '@/core/api/types';
import { Can } from '@/core/auth/guards';
import CrudPage, { type CampoCrud } from '@/core/components/CrudPage';
import {
  categoriasApi,
  modalidadesApi,
  noLaborablesApi,
  puestosApi,
  tiposNovedadApi,
  type CategoriaEstado,
  type Modalidad,
  type TipoNovedad,
} from '@/shared/api/catalogos';
import { insumosApi } from '@/shared/api/patrimonio';
import { CategoriaSelect, TipoNovedadSelect } from '@/shared/components/Selects';
import AsignacionMasivaModal from '@/shared/components/AsignacionMasivaModal';
import UsoTipoModal from '../components/UsoTipoModal';

function camposBase<T extends Catalogo>(): CampoCrud<T>[] {
  return [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
  ];
}

function camposFinales<T extends Catalogo>(): CampoCrud<T>[] {
  return [
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero', valorInicial: 0, ayuda: 'Posición en listas y menús.' },
    { nombre: 'activo', etiqueta: 'Activo', tipo: 'switch', valorInicial: true },
  ];
}

export function PuestosPage() {
  return (
    <CrudPage<Catalogo>
      titulo="Puestos / funciones"
      recurso={puestosApi}
      permiso="organizacion.puesto"
      campos={[...camposBase(), ...camposFinales()]}
    />
  );
}

export function TiposInsumoPage() {
  return (
    <CrudPage<Catalogo>
      titulo="Tipos de insumo"
      subtitulo="Bienes que pueden asignarse como cargo patrimonial (CPU, Monitor, Notebook...)"
      recurso={insumosApi}
      permiso="patrimonio.tipoinsumo"
      campos={[...camposBase(), ...camposFinales()]}
    />
  );
}

export function ModalidadesPage() {
  return (
    <CrudPage<Modalidad>
      titulo="Modalidades de contratación"
      subtitulo="Planta permanente, contratos, pasantías y cualquier otra modalidad"
      recurso={modalidadesApi}
      permiso="organizacion.modalidadcontratacion"
      campos={[
        ...camposBase<Modalidad>(),
        {
          nombre: 'usa_dni_como_legajo',
          etiqueta: 'Usa DNI como legajo',
          tipo: 'switch',
          valorInicial: false,
          ayuda: 'Si el agente no tiene legajo propio se completa con su DNI.',
        },
        { nombre: 'requiere_fecha_fin', etiqueta: 'Requiere fin de contrato', tipo: 'switch', valorInicial: false },
        ...camposFinales<Modalidad>(),
      ]}
    />
  );
}

export function CategoriasPage() {
  return (
    <CrudPage<CategoriaEstado>
      titulo="Categorías de estado"
      subtitulo="Agrupan los tipos de novedad en las tarjetas del dashboard"
      recurso={categoriasApi}
      permiso="novedades.categoriaestado"
      campos={[
        {
          nombre: 'nombre',
          etiqueta: 'Nombre',
          tipo: 'texto',
          requerido: true,
          renderTabla: (v, fila) => <Badge color={fila.color} text={String(v)} />,
        },
        { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
        { nombre: 'color', etiqueta: 'Color', tipo: 'color', valorInicial: '#8c8c8c', requerido: true },
        {
          nombre: 'cuenta_como_presente',
          etiqueta: 'Cuenta como presente',
          tipo: 'switch',
          valorInicial: false,
          ayuda: 'El agente se considera trabajando (p. ej. comisión de servicio).',
        },
        ...camposFinales<CategoriaEstado>(),
      ]}
    />
  );
}

const COMPUTOS: Opcion[] = [
  { value: 'HABILES', label: 'Días hábiles' },
  { value: 'CORRIDOS', label: 'Días corridos' },
];

export function TiposNovedadPage() {
  const { modal } = App.useApp();
  const [usoDe, setUsoDe] = useState<TipoNovedad | null>(null);
  const [acreditar, setAcreditar] = useState<TipoNovedad | null>(null);
  return (
    <>
      <UsoTipoModal tipo={usoDe} onClose={() => setUsoDe(null)} />
      <AsignacionMasivaModal open={!!acreditar} tipoInicial={acreditar} onClose={() => setAcreditar(null)} />
      <CrudPage<TipoNovedad>
      accionesFila={(fila) => (
        <>
          {fila.descuenta_saldo && (
            <Can permiso="vacaciones.add_movimientosaldo">
              <Tooltip title="Acreditar días a todos los empleados (carga masiva)">
                <Button type="text" size="small" icon={<UsergroupAddOutlined />} onClick={() => setAcreditar(fila)} />
              </Tooltip>
            </Can>
          )}
          <Tooltip title="Ver quiénes lo usan">
            <Button type="text" size="small" icon={<FileSearchOutlined />} onClick={() => setUsoDe(fila)} />
          </Tooltip>
        </>
      )}
      onGuardado={(fila, creado) => {
        // Al crear un tipo con saldo (p. ej. "Licencia invierno 2027") se ofrece acreditar días a todos.
        if (creado && fila.descuenta_saldo) {
          modal.confirm({
            title: `¿Acreditar días de "${fila.nombre}" a los empleados?`,
            content: 'Puede asignar ahora la misma cantidad de días a todo el personal activo (o a algunas unidades). También puede hacerlo más tarde desde esta lista o desde Vacaciones y saldos.',
            okText: 'Acreditar ahora',
            cancelText: 'Más tarde',
            onOk: () => setAcreditar(fila),
          });
        }
      }}
      titulo="Tipos de licencias y ausencias"
      subtitulo="Licencia vacaciones, invernal, médica, ausencias... configurables por el administrador"
      recurso={tiposNovedadApi}
      permiso="novedades.tiponovedad"
      anchoModal={640}
      campos={[
        {
          nombre: 'nombre',
          etiqueta: 'Nombre',
          tipo: 'texto',
          requerido: true,
          renderTabla: (v, fila) => <Badge color={fila.color_efectivo} text={String(v)} />,
        },
        { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
        {
          nombre: 'categoria',
          etiqueta: 'Categoría (dashboard)',
          tipo: 'select',
          requerido: true,
          componente: <CategoriaSelect />,
          renderTabla: (_, fila) => fila.categoria_nombre,
        },
        { nombre: 'color', etiqueta: 'Color propio', tipo: 'color', ayuda: 'Opcional. Si no se indica se usa el de la categoría.', enTabla: false },
        { nombre: 'computo_dias', etiqueta: 'Cómputo de días', tipo: 'select', opciones: COMPUTOS, valorInicial: 'HABILES', requerido: true },
        {
          nombre: 'descuenta_saldo',
          etiqueta: 'Descuenta saldo',
          tipo: 'switch',
          valorInicial: false,
          ayuda: 'Los días se descuentan del saldo del empleado (como las vacaciones).',
        },
        {
          nombre: 'saldo_de',
          etiqueta: 'Usa el saldo de',
          tipo: 'select',
          componente: <TipoNovedadSelect soloConSaldo placeholder="Saldo propio" />,
          ayuda: 'Comparte la bolsa de días de otro tipo: sus acreditaciones suman a esa bolsa y sus licencias descuentan de ella (p. ej. Licencia invernal → Licencia vacaciones).',
          renderTabla: (_, fila) => fila.saldo_de_nombre ?? (fila.descuenta_saldo ? 'Propio' : '—'),
        },
        {
          nombre: 'mostrar_saldo',
          etiqueta: 'Mostrar saldo',
          tipo: 'switch',
          valorInicial: true,
          ayuda: 'Desmarcar para ocultar la bolsa de días de fichas, saldos y reportes (p. ej. una licencia de un año anterior ya consumida). Los datos se conservan.',
          renderTabla: (v, fila) => (fila.descuenta_saldo && !fila.saldo_de ? (v ? 'Sí' : <Tag>Oculto</Tag>) : '—'),
        },
        { nombre: 'requiere_documentacion', etiqueta: 'Requiere documentación', tipo: 'switch', valorInicial: false },
        {
          nombre: 'permite_sin_fecha_fin',
          etiqueta: 'Permite quedar abierta',
          tipo: 'switch',
          valorInicial: false,
          ayuda: 'Se puede registrar sin fecha de fin (p. ej. ausencia o licencia médica en curso).',
        },
        ...camposFinales<TipoNovedad>(),
      ]}
    />
    </>
  );
}

function CargarFeriados() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [anio, setAnio] = useState(dayjs().year());
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await api.post<{ creados: number; existentes: number }>('/calendario/no-laborables/cargar-nacionales/', { anio });
      message.success(`Feriados ${anio}: ${data.creados} nuevos, ${data.existentes} ya cargados.`);
      qc.invalidateQueries();
    } catch (e) {
      message.error(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Can permiso="calendario.add_dianolaborable">
      <Popover
        trigger="click"
        title="Cargar feriados nacionales"
        content={
          <Space>
            <InputNumber value={anio} min={2000} max={2100} onChange={(v) => v && setAnio(v)} />
            <Button type="primary" loading={cargando} onClick={cargar}>
              Cargar
            </Button>
          </Space>
        }
      >
        <Button icon={<CloudDownloadOutlined />}>Feriados nacionales</Button>
      </Popover>
    </Can>
  );
}

export function NoLaborablesPage() {
  const [anio, setAnio] = useState<number>(dayjs().year());
  const { data: tipos = [] } = useQuery({
    queryKey: ['calendario/no-laborables', 'tipos'],
    queryFn: async () => (await api.get<Opcion[]>('/calendario/no-laborables/tipos/')).data,
    staleTime: Infinity,
  });

  return (
    <CrudPage<DiaNoLaborable>
      titulo="Feriados y días no laborables"
      subtitulo="Feriados, asuetos y días otorgados por resolución. Se muestran en el calendario y se descuentan del cómputo de días hábiles."
      recurso={noLaborablesApi}
      permiso="calendario.dianolaborable"
      params={{ anio, ordering: 'fecha' }}
      filtrosExtra={
        <Select
          value={anio}
          onChange={setAnio}
          style={{ width: 110 }}
          options={Array.from({ length: 5 }, (_, i) => dayjs().year() + 1 - i).map((a) => ({ value: a, label: a }))}
        />
      }
      accionesExtra={<CargarFeriados />}
      campos={[
        { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
        {
          nombre: 'tipo',
          etiqueta: 'Tipo',
          tipo: 'select',
          opciones: tipos,
          requerido: true,
          valorInicial: 'ASUETO',
          renderTabla: (_, fila) => <Tag>{fila.tipo_display}</Tag>,
        },
        { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'texto', requerido: true },
        { nombre: 'norma', etiqueta: 'Resolución / decreto', tipo: 'texto', ayuda: 'Número de la norma que lo otorga, si corresponde.' },
        { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
      ]}
    />
  );
}
