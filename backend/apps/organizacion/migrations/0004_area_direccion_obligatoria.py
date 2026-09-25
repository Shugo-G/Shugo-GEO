import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organizacion", "0003_asignar_direcciones")]

    operations = [
        migrations.AlterField(
            model_name="area",
            name="direccion",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="areas",
                to="organizacion.direccion",
                verbose_name="dirección",
            ),
        ),
    ]
