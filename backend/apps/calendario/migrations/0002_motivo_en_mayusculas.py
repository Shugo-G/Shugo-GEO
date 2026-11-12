"""Pasa a mayúsculas el motivo de los días no laborables ya cargados."""
from django.db import migrations


def a_mayusculas(apps, schema_editor):
    DiaNoLaborable = apps.get_model("calendario", "DiaNoLaborable")
    for dia in DiaNoLaborable.objects.all():
        nuevo = (dia.motivo or "").strip().upper()
        if nuevo != dia.motivo:
            dia.motivo = nuevo
            dia.save(update_fields=["motivo"])


class Migration(migrations.Migration):
    dependencies = [("calendario", "0001_initial")]

    operations = [migrations.RunPython(a_mayusculas, migrations.RunPython.noop)]
