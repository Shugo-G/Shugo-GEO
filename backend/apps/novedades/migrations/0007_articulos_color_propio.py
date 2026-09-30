"""
Quita las categorías de estado: el color pasa a ser propio de cada artículo de
licencia y desaparece "cuenta como presente" (Comisión).

Antes de borrar el campo:
- los artículos sin color propio toman el de su categoría;
- se eliminan los artículos cuya categoría contaba como presente (Comisión de
  servicio) si nunca se usaron. Si tienen licencias cargadas se conservan
  (desde ahora cuentan como ausencia) para no perder historial.
"""
from django.db import migrations


def pasar_color_y_quitar_comision(apps, schema_editor):
    TipoNovedad = apps.get_model("novedades", "TipoNovedad")
    Novedad = apps.get_model("novedades", "Novedad")
    MovimientoSaldo = apps.get_model("vacaciones", "MovimientoSaldo")
    for tipo in TipoNovedad.objects.select_related("categoria"):
        if not tipo.color:
            tipo.color = tipo.categoria.color or "#1677ff"
            tipo.save(update_fields=["color"])
    for tipo in TipoNovedad.objects.filter(categoria__cuenta_como_presente=True):
        en_uso = (
            Novedad.objects.filter(tipo=tipo).exists()
            or MovimientoSaldo.objects.filter(tipo_novedad=tipo).exists()
            or TipoNovedad.objects.filter(saldo_de=tipo).exists()
        )
        if not en_uso:
            tipo.delete()


class Migration(migrations.Migration):
    """Sólo datos: el cambio de esquema va en 0008 (PostgreSQL no permite borrar filas y alterar la tabla en la misma transacción)."""

    dependencies = [
        ('novedades', '0006_mostrar_saldo'),
        ('vacaciones', '0002_preferencia_saldo'),
    ]

    operations = [
        migrations.RunPython(pasar_color_y_quitar_comision, migrations.RunPython.noop),
    ]
