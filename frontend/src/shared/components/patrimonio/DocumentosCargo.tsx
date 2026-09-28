import { Modal, Typography } from 'antd';
import { documentosCargoApi, type CargoPatrimonial } from '@/shared/api/patrimonio';
import ListaDocumentos from '../ListaDocumentos';

export const PERMISOS_DOCUMENTOS_CARGO = {
  ver: 'patrimonio.view_documentocargo',
  subir: 'patrimonio.add_documentocargo',
  eliminar: 'patrimonio.delete_documentocargo',
};

/** Archivos de un cargo: planilla de cargo firmada, actas de transferencia o de baja. */
export default function DocumentosCargo({ cargoId }: { cargoId: number }) {
  return (
    <ListaDocumentos
      fuente={{
        clave: ['patrimonio/documentos', cargoId],
        listar: () => documentosCargoApi.listar(cargoId),
        subir: (archivo) => documentosCargoApi.subir(cargoId, archivo),
        eliminar: documentosCargoApi.eliminar,
        urlDescarga: documentosCargoApi.urlDescarga,
      }}
      permisos={PERMISOS_DOCUMENTOS_CARGO}
      textoVacio="Sin archivos: adjunte la planilla de cargo firmada."
    />
  );
}

/** Modal con los archivos de un cargo (desde la tabla del inventario o de la ficha). */
export function DocumentosCargoModal({ cargo, onClose }: { cargo: CargoPatrimonial | null; onClose: () => void }) {
  return (
    <Modal open={!!cargo} title="Archivos del cargo" onCancel={onClose} footer={null} destroyOnHidden width={560}>
      {cargo && (
        <>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {cargo.tipo_insumo_nombre} · IUB {cargo.iub} · Planilla {cargo.planilla_cargo}
            <br />
            {cargo.empleado_nombre} (legajo {cargo.legajo})
          </Typography.Paragraph>
          <DocumentosCargo cargoId={cargo.id} />
        </>
      )}
    </Modal>
  );
}
