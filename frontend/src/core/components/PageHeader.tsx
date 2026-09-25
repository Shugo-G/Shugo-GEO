import type { ReactNode } from 'react';
import { Space, Typography } from 'antd';

interface Props {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
}

export default function PageHeader({ titulo, subtitulo, acciones }: Props) {
  return (
    <div className="page-header">
      <div>
        <Typography.Title level={3}>{titulo}</Typography.Title>
        {subtitulo && <Typography.Text type="secondary">{subtitulo}</Typography.Text>}
      </div>
      {acciones && <Space wrap>{acciones}</Space>}
    </div>
  );
}
