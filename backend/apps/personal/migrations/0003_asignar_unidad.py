"""Asigna a cada empleado la unidad organizativa equivalente a su área actual."""
from django.db import migrations


def asignar(apps, schema_editor):
    Empleado = apps.get_model("personal", "Empleado")
    Unidad = apps.get_model("organizacion", "UnidadOrganizativa")

    unidades = {
        (u.padre.nombre, u.nombre): u
        for u in Unidad.objects.filter(tipo="AREA").select_related("padre")
    }
    for empleado in Empleado.objects.select_related("area__direccion"):
        empleado.unidad = unidades[(empleado.area.direccion.nombre, empleado.area.nombre)]
        empleado.save(update_fields=["unidad"])


class Migration(migrations.Migration):
    dependencies = [("personal", "0002_unidad_organizativa")]

    operations = [migrations.RunPython(asignar, migrations.RunPython.noop)]
