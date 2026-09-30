from datetime import date

from django.test import TestCase

from apps.core.testing import cliente, crear_empleado, datos_base
from apps.novedades.models import Novedad


class EventosCalendarioTests(TestCase):
    def test_eventos_incluyen_articulo_color_y_total(self):
        d = datos_base()
        empleado = crear_empleado(d["area"], d["planta"])
        crear_empleado(d["area"], d["planta"], 2)
        Novedad.objects.create(empleado=empleado, tipo=d["medica"], fecha_desde=date(2026, 9, 14), fecha_hasta=date(2026, 9, 16), dias=3)

        api = cliente()
        r = api.get("/api/calendario/eventos/", {"desde": "2026-09-01", "hasta": "2026-09-30"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["total_empleados"], 2)
        evento = r.data["novedades"][0]
        self.assertEqual((evento["tipo_id"], evento["color"]), (d["medica"].id, d["medica"].color))
        self.assertNotIn("foto_url", evento)
        # Filtro por artículo
        r = api.get("/api/calendario/eventos/", {"desde": "2026-09-01", "hasta": "2026-09-30", "tipo": d["vacaciones"].id})
        self.assertEqual(r.data["novedades"], [])
