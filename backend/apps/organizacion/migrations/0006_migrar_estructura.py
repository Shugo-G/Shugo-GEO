"""
Migra Direcciones y Áreas al árbol de unidades organizativas:
    <Dirección General>  (nombre de settings.SHUGO["ORGANISMO"])
      └── cada Dirección
            └── cada Área
"""
from django.conf import settings
from django.db import migrations


def migrar(apps, schema_editor):
    Unidad = apps.get_model("organizacion", "UnidadOrganizativa")
    Direccion = apps.get_model("organizacion", "Direccion")
    Area = apps.get_model("organizacion", "Area")

    raiz, _ = Unidad.objects.get_or_create(
        padre=None, nombre=settings.SHUGO["ORGANISMO"], defaults={"tipo": "DIRECCION_GENERAL", "orden": 0}
    )
    por_direccion = {}
    for d in Direccion.objects.all():
        por_direccion[d.id], _ = Unidad.objects.get_or_create(
            padre=raiz,
            nombre=d.nombre,
            defaults={"tipo": "DIRECCION", "orden": d.orden, "activo": d.activo, "descripcion": d.descripcion},
        )
    for a in Area.objects.all():
        Unidad.objects.get_or_create(
            padre=por_direccion[a.direccion_id],
            nombre=a.nombre,
            defaults={"tipo": "AREA", "orden": a.orden, "activo": a.activo, "descripcion": a.descripcion},
        )


class Migration(migrations.Migration):
    dependencies = [("organizacion", "0005_unidades_organizativas")]

    operations = [migrations.RunPython(migrar, migrations.RunPython.noop)]
