import { Card, Col, Row, Statistic, Tooltip, Typography } from 'antd';
import { CheckCircleFilled, InfoCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { COLOR_ACTIVO } from '@/app/theme';
import type { EstadoPersonal } from '../api';

interface Props {
  resumen: EstadoPersonal['resumen'];
  esUnDia: boolean;
  estadosActivos: string[];
  onToggleEstado: (estado: string | null) => void;
}

function Punto({ color }: { color: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />;
}

/**
 * Tarjetas del dashboard: total, trabajando y una por cada categoría de
 * estado configurada. Al hacer clic filtran la tabla por ese estado.
 */
export default function ResumenCards({ resumen, esUnDia, estadosActivos, onToggleEstado }: Props) {
  const porcentaje = resumen.total ? Math.round((resumen.trabajando / resumen.total) * 100) : 0;
  const estilo = (color: string) => ({ borderTopColor: color });

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={8} flex="1 1 120px">
        <Card size="small" className={`kpi-card ${estadosActivos.length === 0 ? 'activa' : ''}`} style={estilo('#1F4E79')} onClick={() => onToggleEstado(null)}>
          <Statistic title={<><TeamOutlined /> Total de empleados</>} value={resumen.total} />
        </Card>
      </Col>
      <Col xs={12} sm={8} flex="1 1 120px">
        <Card
          size="small"
          className={`kpi-card ${estadosActivos.includes('trabajando') ? 'activa' : ''}`}
          style={estilo(COLOR_ACTIVO)}
          onClick={() => onToggleEstado('trabajando')}
        >
          <Statistic
            title={
              <>
                <CheckCircleFilled style={{ color: COLOR_ACTIVO }} /> {esUnDia ? 'Trabajando' : 'Sin ausencias en el período'}
              </>
            }
            value={resumen.trabajando}
            valueStyle={{ color: COLOR_ACTIVO }}
            suffix={<Typography.Text type="secondary" style={{ fontSize: 13 }}>({porcentaje}%)</Typography.Text>}
          />
        </Card>
      </Col>
      {resumen.por_categoria.map((c) => (
        <Col key={c.id} xs={12} sm={8} flex="1 1 120px">
          <Card
            size="small"
            className={`kpi-card ${estadosActivos.includes(String(c.id)) ? 'activa' : ''}`}
            style={estilo(c.color)}
            onClick={() => onToggleEstado(String(c.id))}
          >
            <Statistic
              title={
                <>
                  <Punto color={c.color} /> {c.nombre}
                  {c.cuenta_como_presente && (
                    <Tooltip title="Cuenta como presente: suma en 'Trabajando'">
                      <InfoCircleOutlined />
                    </Tooltip>
                  )}
                </>
              }
              value={c.cantidad}
              valueStyle={{ color: c.cantidad ? c.color : undefined }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
