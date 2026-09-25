from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.core.testing import ROL_CONSULTA, cliente, crear_empleado, datos_base

from .base import registro


class ReportesTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        crear_empleado(self.d["area"], self.d["planta"])
        self.api = cliente(ROL_CONSULTA)

    def test_todos_los_reportes_exportan_en_todos_los_formatos(self):
        params = {"fecha": "2026-09-15", "desde": "2026-01-01", "hasta": "2026-12-31", "empleado": "1"}
        for reporte in registro.disponibles_para(get_user_model().objects.get(username="consulta")):
            for formato in ["json", "xlsx", "pdf"]:
                with self.subTest(reporte=reporte.clave, formato=formato):
                    respuesta = self.api.get(f"/api/reportes/{reporte.clave}/", {**params, "formato": formato})
                    self.assertEqual(respuesta.status_code, 200)

    def test_filtro_requerido(self):
        respuesta = self.api.get("/api/reportes/vacaciones_periodo/", {"formato": "json"})
        self.assertEqual(respuesta.status_code, 400)
