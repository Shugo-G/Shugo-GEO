import { useNavigate } from 'react-router-dom';
import { Badge, Empty, Tag, Tooltip, Typography } from 'antd';
import { fmtFechaCorta } from '@/core/utils/format';
import { COLOR_ACTIVO } from '@/app/theme';
import FotoEmpleado from '@/shared/components/FotoEmpleado';
import type { EstadoPersonal, FilaEstado } from '../api';

interface Props {
  datos: EstadoPersonal;
  filas: FilaEstado[];
  /** Si hay filtros aplicados, se ocultan las direcciones sin agentes. */
  ocultarVacias: boolean;
}

/**
 * Novedad que define la tarjeta (color y posición): primero una que implique
 * ausencia (vacaciones, licencia...), si no la de una comisión. Sin novedades: activo.
 */
function novedadPrincipal(fila: FilaEstado) {
  return fila.novedades.find((n) => !n.cuenta_como_presente) ?? fila.novedades[0];
}

function colorEstado(fila: FilaEstado): string {
  return novedadPrincipal(fila)?.color ?? COLOR_ACTIVO;
}

/**
 * Orden de las tarjetas: primero los activos (sin novedades); después el resto
 * agrupado por licencia, según el orden de las categorías configuradas y luego
 * por tipo; dentro de cada grupo, alfabético.
 */
function ordenarAgentes(filas: FilaEstado[], ordenCategorias: number[]): FilaEstado[] {
  const posicion = (fila: FilaEstado) => {
    const n = novedadPrincipal(fila);
    if (!n) return -1;
    const i = ordenCategorias.indexOf(n.categoria_id);
    return i === -1 ? ordenCategorias.length : i;
  };
  return [...filas].sort(
    (a, b) =>
      posicion(a) - posicion(b) ||
      (novedadPrincipal(a)?.tipo ?? '').localeCompare(novedadPrincipal(b)?.tipo ?? '') ||
      a.nombre.localeCompare(b.nombre),
  );
}

/** Área (o unidad) dentro de la dirección; vacío si depende directamente de la dirección. */
function subunidad(fila: FilaEstado): string | null {
  const partes = fila.unidad_ruta.split(' › ');
  return fila.unidad === fila.direccion ? null : partes.slice(partes.indexOf(fila.direccion) + 1).join(' › ') || fila.unidad;
}

/** Tarjeta cuadrada: foto arriba y, debajo, nombre, área y estado. El color indica el estado. */
function TarjetaAgente({ fila }: { fila: FilaEstado }) {
  const navigate = useNavigate();
  const color = colorEstado(fila);
  const area = subunidad(fila);
  return (
    <div
      className="tarjeta-agente"
      style={{ borderTopColor: color, background: `${color}14` }}
      onClick={() => navigate(`/personal/${fila.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/personal/${fila.id}`)}
    >
      <FotoEmpleado url={fila.foto_url} nombre={fila.nombre} tamanio={64} />
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
            <Tooltip key={n.id} title={n.motivo || n.categoria}>
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

/** Vista del dashboard: una columna por dirección y una tarjeta por agente. */
export default function TarjetasPorDireccion({ datos, filas, ocultarVacias }: Props) {
  const ordenCategorias = datos.resumen.por_categoria.map((c) => c.id);
  const porGrupo = new Map<number | null, FilaEstado[]>();
  filas.forEach((f) => porGrupo.set(f.direccion_id, [...(porGrupo.get(f.direccion_id) ?? []), f]));

  const grupos = centrarDireccionGeneral(datos.grupos.filter((g) => !ocultarVacias || porGrupo.has(g.id)));
  // Personal sin dirección asignable (no debería ocurrir, pero no se pierde de vista).
  const sinGrupo = filas.filter((f) => !datos.grupos.some((g) => g.id === f.direccion_id));

  if (!filas.length) return <Empty description="Sin empleados para los filtros seleccionados" />;

  const columnas = [
    ...grupos.map((g) => ({ clave: String(g.id), titulo: g.nombre, subtitulo: g.tipo, filas: porGrupo.get(g.id) ?? [] })),
    ...(sinGrupo.length ? [{ clave: 'sin', titulo: 'Sin dirección', subtitulo: '', filas: sinGrupo }] : []),
  ];

  return (
    <div className="columnas-direccion" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(260px, 1fr))` }}>
      {columnas.map((c) => {
        const trabajando = c.filas.filter((f) => f.trabajando).length;
        return (
          <section key={c.clave} className="columna-direccion">
            <header>
              <div>
                <Typography.Text strong>{c.titulo}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {c.subtitulo}
                  </Typography.Text>
                </div>
              </div>
              <Tooltip title={datos.es_un_dia ? 'Trabajando / total' : 'Sin ausencias en el período / total'}>
                <span className="columna-direccion-conteo">
                  <span style={{ color: COLOR_ACTIVO, fontWeight: 600 }}>{trabajando}</span> / {c.filas.length}
                </span>
              </Tooltip>
            </header>
            <div className="columna-direccion-tarjetas">
              {c.filas.length ? (
                ordenarAgentes(c.filas, ordenCategorias).map((f) => <TarjetaAgente key={f.id} fila={f} />)
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
