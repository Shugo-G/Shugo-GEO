from datetime import date

from django.test import TestCase

from apps.core.testing import cliente, crear_empleado, datos_base
from apps.novedades.models import Novedad


class EventosCalendarioTests(TestCase):
    def test_eventos_incluyen_foto_categoria_y_total(self):
        d = datos_base()
        empleado = crear_empleado(d["area"], d["planta"])
        crear_empleado(d["area"], d["planta"], 2)
        Novedad.objects.create(empleado=empleado, tipo=d["comision"], fecha_desde=date(2026, 9, 14), fecha_hasta=date(2026, 9, 16), dias=3)

        r = cliente().get("/api/calendario/eventos/", {"desde": "2026-09-01", "hasta": "2026-09-30"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["total_empleados"], 2)
        evento = r.data["novedades"][0]
        self.assertIsNone(evento["foto_url"])
        self.assertTrue(evento["cuenta_como_presente"])
        self.assertEqual(evento["categoria_id"], d["comision"].categoria_id)
