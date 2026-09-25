"""
Crea las direcciones iniciales y asigna cada área existente:
- "Desarrollo"  -> Dirección de Desarrollo
- resto         -> Dirección de Infraestructura
"""
from django.db import migrations

DESARROLLO = "Dirección de Desarrollo"
INFRAESTRUCTURA = "Dirección de Infraestructura"
AREAS_DESARROLLO = {"desarrollo"}


def asignar(apps, schema_editor):
    Direccion = apps.get_model("organizacion", "Direccion")
    Area = apps.get_model("organizacion", "Area")

    desarrollo, _ = Direccion.objects.get_or_create(nombre=DESARROLLO, defaults={"orden": 1})
    infraestructura, _ = Direccion.objects.get_or_create(nombre=INFRAESTRUCTURA, defaults={"orden": 2})

    for area in Area.objects.filter(direccion__isnull=True):
        area.direccion = desarrollo if area.nombre.strip().lower() in AREAS_DESARROLLO else infraestructura
        area.save(update_fields=["direccion"])


class Migration(migrations.Migration):
    dependencies = [("organizacion", "0002_direcciones")]

    operations = [migrations.RunPython(asignar, migrations.RunPython.noop)]
