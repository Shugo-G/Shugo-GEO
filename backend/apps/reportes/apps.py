from django.apps import AppConfig


class ReportesConfig(AppConfig):
    name = "apps.reportes"
    verbose_name = "Reportes"

    def ready(self):
        # Importar las definiciones registra los reportes en el registro.
        from . import definiciones  # noqa: F401
