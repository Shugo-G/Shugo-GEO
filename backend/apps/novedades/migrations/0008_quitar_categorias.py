"""Quita las categorías de estado (los datos se pasaron en 0007)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('novedades', '0007_articulos_color_propio'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='historicaltiponovedad',
            name='categoria',
        ),
        migrations.RemoveField(
            model_name='tiponovedad',
            name='categoria',
        ),
        migrations.RemoveField(
            model_name='historicalcategoriaestado',
            name='creado_por',
        ),
        migrations.RemoveField(
            model_name='historicalcategoriaestado',
            name='history_user',
        ),
        migrations.AlterModelOptions(
            name='historicaltiponovedad',
            options={'get_latest_by': ('history_date', 'history_id'), 'ordering': ('-history_date', '-history_id'), 'verbose_name': 'historical artículo de licencia', 'verbose_name_plural': 'historical artículos de licencia'},
        ),
        migrations.AlterModelOptions(
            name='tiponovedad',
            options={'ordering': ['orden', 'nombre'], 'verbose_name': 'artículo de licencia', 'verbose_name_plural': 'artículos de licencia'},
        ),
        migrations.AlterField(
            model_name='historicaltiponovedad',
            name='color',
            field=models.CharField(default='#1677ff', help_text='Color con el que se muestra en el Inicio y el calendario.', max_length=20, verbose_name='color'),
        ),
        migrations.AlterField(
            model_name='tiponovedad',
            name='color',
            field=models.CharField(default='#1677ff', help_text='Color con el que se muestra en el Inicio y el calendario.', max_length=20, verbose_name='color'),
        ),
        migrations.DeleteModel(
            name='CategoriaEstado',
        ),
        migrations.DeleteModel(
            name='HistoricalCategoriaEstado',
        ),
    ]
