"""La Licencia invernal pasa a sumar y descontar de la bolsa de Licencia vacaciones."""
from django.db import migrations


def configurar(apps, schema_editor):
    TipoNovedad = apps.get_model("novedades", "TipoNovedad")
    vacaciones = TipoNovedad.objects.filter(nombre="Licencia vacaciones").first()
    if vacaciones:
        TipoNovedad.objects.filter(nombre="Licencia invernal", saldo_de__isnull=True).update(
            descuenta_saldo=True, saldo_de=vacaciones
        )


class Migration(migrations.Migration):
    dependencies = [("novedades", "0003_saldo_compartido")]

    operations = [migrations.RunPython(configurar, migrations.RunPython.noop)]
