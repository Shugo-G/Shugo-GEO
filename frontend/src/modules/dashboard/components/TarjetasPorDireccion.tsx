import { useNavigate } from 'react-router-dom';
import { Badge, Empty, Tag, Tooltip, Typography } from 'antd';
import { fmtFechaCorta } from '@/core/utils/format';
import { COLOR_ACTIVO } from '@/app/theme';
import IconoPersona from '@/shared/components/IconoPersona';
import { ConGorro, Confeti } from './Cumpleanios';
import type { EstadoPersonal, FilaEstado } from '../api';

interface Props {
  datos: EstadoPersonal;
  filas: FilaEstado[];
  /** Si hay filtros aplicados, se ocultan las direcciones sin agentes. */
  ocultarVacias: boolean;
}

/** Licencia que define la tarjeta (color y posición): la primera vigente. Sin licencias: activo. */
function novedadPrincipal(fila: FilaEstado) {
  return fila.novedades[0];
}

function colorEstado(fila: FilaEstado): string {
  return novedadPrincipal(fila)?.color ?? COLOR_ACTIVO;
}

/**
 * Orden de las tarjetas: primero los activos (sin licencias); después el resto
 * agrupado por artículo de licencia, en el orden configurado; dentro de cada
 * grupo, alfabético.
 */
function ordenarAgentes(filas: FilaEstado[], ordenArticulos: number[]): FilaEstado[] {
  const posicion = (fila: FilaEstado) => {
    const n = novedadPrincipal(fila);
    if (!n) return -1;
    const i = ordenArticulos.indexOf(n.tipo_id);
    return i === -1 ? ordenArticulos.length : i;
  };
  return [...filas].sort((a, b) => posicion(a) - posicion(b) || a.nombre.localeCompare(b.nombre));
}

/** Área (o unidad) dentro de la dirección; vacío si depende directamente de la dirección. */
function subunidad(fila: FilaEstado): string | null {
  const partes = fila.unidad_ruta.split(' › ');
  return fila.unidad === fila.direccion ? null : partes.slice(partes.indexOf(fila.direccion) + 1).join(' › ') || fila.unidad;
}

/** Tarjeta cuadrada: ícono de persona con el color del estado, nombre, área y estado; la línea de color va abajo. */
function TarjetaAgente({ fila }: { fila: FilaEstado }) {
  const navigate = useNavigate();
  const color = colorEstado(fila);
  const area = subunidad(fila);
  return (
    <div
      className={`tarjeta-agente ${fila.cumpleanios ? 'tarjeta-cumple' : ''}`}
      style={{ borderBottomColor: color, background: `${color}14` }}
      title={fila.cumpleanios ? `¡Hoy cumple años ${fila.nombre}!` : undefined}
      onClick={() => navigate(`/personal/${fila.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/personal/${fila.id}`)}
    >
      {fila.cumpleanios && <Confeti />}
      {fila.cumpleanios ? (
        <ConGorro>
          <IconoPersona color={color} tamanio={64} />
        </ConGorro>
      ) : (
        <IconoPersona color={color} tamanio={64} />
      )}
      <Typography.Text strong className="tarjeta-agente-nombre" ellipsis={{ tooltip: fila.nombre }}>
        {fila.nombre}
      </Typography.Text>
      <Typography.Text type="secondary" className="tarjeta-agente-area" ellipsis={{ tooltip: area ?? undefined }}>
        {area ?? 'Personal de la dirección'}
      </Typography.Text>
      <div className="tarjeta-agente-estado">
        {fila.novedades.length === 0 ? (
          <Badge color={COLOR_ACTIVO} text="Activo" />
        ) : (
          fila.novedades.map((n) => (
            <Tooltip key={n.id} title={n.motivo || n.tipo}>
              <div className="tarjeta-agente-novedad">
                <Badge color={n.color} text={n.tipo} />
                <div className="tarjeta-agente-fechas">
                  {fmtFechaCorta(n.desde)} →{' '}
                  {n.hasta ? (
                    fmtFechaCorta(n.hasta)
                  ) : (
                    <Tag color="red" bordered={false} style={{ fontSize: 10, marginInlineEnd: 0 }}>
                      abierta
                    </Tag>
                  )}
                </div>
              </div>
            </Tooltip>
          ))
        )}
      </div>
      {fila.cumpleanios && <div className="tarjeta-cumple-saludo">🎂 ¡Feliz cumpleaños!</div>}
    </div>
  );
}

/**
 * Orden de las columnas: la Dirección General al centro y sus direcciones
 * repartidas a ambos lados, respetando el orden configurado en la estructura
 * (con dos direcciones: Desarrollo a la izquierda, Infraestructura a la derecha).
 */
function centrarDireccionGeneral<T extends { tipo: string }>(grupos: T[]): T[] {
  const generales = grupos.filter((g) => g.tipo === 'Dirección General');
  const direcciones = grupos.filter((g) => g.tipo !== 'Dirección General');
  const mitad = Math.ceil(direcciones.length / 2);
  return [...direcciones.slice(0, mitad), ...generales, ...direcciones.slice(mitad)];
}

/** Vista del Inicio: una columna por dirección y una tarjeta por agente. */
export default function TarjetasPorDireccion({ datos, filas, ocultarVacias }: Props) {
  const ordenArticulos = datos.resumen.por_tipo.map((t) => t.id);
  const porGrupo = new Map<number | null, FilaEstado[]>();
  filas.forEach((f) => porGrupo.set(f.direccion_id, [...(porGrupo.get(f.direccion_id) ?? []), f]));

  const grupos = centrarDireccionGeneral(datos.grupos.filter((g) => !ocultarVacias || porGrupo.has(g.id)));
  // Personal sin dirección asignable (no debería ocurrir, pero no se pierde de vista).
  const sinGrupo = filas.filter((f) => !datos.grupos.some((g) => g.id === f.direccion_id));

  if (!filas.length) return <Empty description="Sin empleados para los filtros seleccionados" />;

  const columnas = [
    ...grupos.map((g) => ({ clave: String(g.id), titulo: g.nombre, filas: porGrupo.get(g.id) ?? [] })),
    ...(sinGrupo.length ? [{ clave: 'sin', titulo: 'Sin dirección', filas: sinGrupo }] : []),
  ];

  return (
    <div className="columnas-direccion" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(260px, 1fr))` }}>
      {columnas.map((c) => {
        const trabajando = c.filas.filter((f) => f.trabajando).length;
        return (
          <section key={c.clave} className="columna-direccion">
            <header>
              <Typography.Text strong>{c.titulo}</Typography.Text>
              <Tooltip title={datos.es_un_dia ? 'Trabajando / total' : 'Sin ausencias en el período / total'}>
                <span className="columna-direccion-conteo">
                  <span style={{ color: COLOR_ACTIVO, fontWeight: 600 }}>{trabajando}</span> / {c.filas.length}
                </span>
              </Tooltip>
            </header>
            <div className="columna-direccion-tarjetas">
              {c.filas.length ? (
                ordenarAgentes(c.filas, ordenArticulos).map((f) => <TarjetaAgente key={f.id} fila={f} />)
              ) : (
                <Typography.Text type="secondary" style={{ padding: 12 }}>
                  Sin agentes
                </Typography.Text>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
