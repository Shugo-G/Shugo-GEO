import { App, Button, Popconfirm, Space, Tooltip } from 'antd';
import { CheckSquareOutlined, DeleteOutlined, EditOutlined, ScissorOutlined, StopOutlined } from '@ant-design/icons';
import { mensajeError } from '@/core/api/client';
import { usePermiso } from '@/core/auth/AuthContext';
import { novedadesApi, type Novedad } from '@/shared/api/novedades';

interface Props {
  novedad: Novedad;
  onEditar: (n: Novedad) => void;
  onInterrumpir: (n: Novedad) => void;
  onAnular: (n: Novedad) => void;
  onCerrar?: (n: Novedad) => void;
}

/**
 * Acciones disponibles según el estado de la licencia:
 * - Programada o cargada hoy: editar, eliminar.
 * - En curso: interrumpir (o cerrar si es abierta), editar (sólo extender), anular.
 * - Finalizada / interrumpida: editar motivo y observaciones, anular.
 * - Anulada: ninguna.
 * Interrumpir sólo se ofrece si la licencia dura más de un día.
 */
export default function AccionesNovedad({ novedad: n, onEditar, onInterrumpir, onAnular, onCerrar }: Props) {
  const { message } = App.useApp();
  const puedeEditar = usePermiso('novedades.change_novedad');
  const puedeEliminar = usePermiso('novedades.delete_novedad');
  const eliminar = novedadesApi.useEliminar();

  if (n.estado === 'ANULADA' || !puedeEditar) return null;
  const historial = n.estado === 'FINALIZADA' || n.estado === 'INTERRUMPIDA';

  return (
    <Space size={0}>
      {n.abierta && onCerrar && (
        <Tooltip title="Cerrar (indicar fecha de fin)">
          <Button type="text" size="small" icon={<CheckSquareOutlined />} onClick={() => onCerrar(n)} />
        </Tooltip>
      )}
      {!n.abierta && !historial && n.fecha_hasta !== n.fecha_desde && (
        <Tooltip title="Interrumpir (reintegra los días no tomados)">
          <Button type="text" size="small" icon={<ScissorOutlined />} onClick={() => onInterrumpir(n)} />
        </Tooltip>
      )}
      <Tooltip title={historial ? 'Editar motivo y observaciones' : 'Editar'}>
        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditar(n)} />
      </Tooltip>
      {n.puede_eliminarse
        ? puedeEliminar && (
            <Popconfirm
              title="¿Eliminar la licencia?"
              description={
                n.estado === 'PROGRAMADA'
                  ? 'Todavía no comenzó: se elimina y sus días vuelven al saldo.'
                  : 'Se cargó hoy: se elimina como corrección de un error de carga y sus días vuelven al saldo.'
              }
              onConfirm={() => eliminar.mutateAsync(n.id).catch((e) => message.error(mensajeError(e)))}
            >
              <Tooltip title="Eliminar">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )
        : (
            <Tooltip title="Anular (sólo si fue cargada por error)">
              <Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => onAnular(n)} />
            </Tooltip>
          )}
    </Space>
  );
}
