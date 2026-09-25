import { Typography } from 'antd';

/**
 * Muestra una unidad organizativa: el nombre de la unidad y, debajo, de quién depende.
 * Recibe la ruta completa ("Dirección de Infraestructura › Soporte técnico").
 */
export default function RutaUnidad({ ruta }: { ruta: string }) {
  const partes = ruta.split(' › ');
  const nombre = partes.pop();
  return (
    <>
      {nombre}
      {partes.length > 0 && (
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {partes.join(' › ')}
          </Typography.Text>
        </div>
      )}
    </>
  );
}
