"""Los artículos existentes toman como etiqueta su nombre (recortado a 20); se puede editar luego."""
from django.db import migrations


def etiqueta_desde_nombre(apps, schema_editor):
    TipoNovedad = apps.get_model("novedades", "TipoNovedad")
    for tipo in TipoNovedad.objects.filter(etiqueta=""):
        tipo.etiqueta = tipo.nombre[:20]
        tipo.save(update_fields=["etiqueta"])


class Migration(migrations.Migration):
    dependencies = [("novedades", "0011_etiqueta_articulo")]

    operations = [migrations.RunPython(etiqueta_desde_nombre, migrations.RunPython.noop)]
