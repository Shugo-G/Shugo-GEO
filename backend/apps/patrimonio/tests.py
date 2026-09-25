from django.test import TestCase

from apps.core.testing import ROL_CONSULTA, cliente, crear_empleado, datos_base

from . import seeds
from .models import CargoPatrimonial, TipoInsumo


class CargoPatrimonialTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        seeds.cargar()
        self.api = cliente()
        self.ana = crear_empleado(self.d["area"], self.d["planta"], 1, legajo="501")
        self.juan = crear_empleado(self.d["area"], self.d["planta"], 2, legajo="502")
        self.cpu = TipoInsumo.objects.get(nombre="CPU")

    def asignar(self, empleado=None, **extra):
        datos = {
            "empleado": (empleado or self.ana).id,
            "tipo_insumo": self.cpu.id,
            "planilla_cargo": "PC-100",
            "iub": "IUB-1",
            "descripcion": "Dell OptiPlex 7090",
            "fecha_asignacion": "2026-03-01",
        }
        datos.update(extra)
        return self.api.post("/api/patrimonio/cargos/", datos, format="json")

    def test_asignar_guarda_el_legajo_del_empleado(self):
        r = self.asignar()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["legajo"], r.data["vigente"]), ("501", True))
        # El legajo queda en el historial aunque luego cambie en la ficha
        self.ana.legajo = "999"
        self.ana.save()
        self.assertEqual(CargoPatrimonial.objects.get().legajo, "501")

    def test_un_iub_no_puede_estar_a_cargo_de_dos_personas(self):
        self.asignar()
        r = self.asignar(self.juan)
        self.assertEqual(r.status_code, 400)
        self.assertIn("iub", r.data)

    def test_transferir_a_otro_empleado_conserva_el_historial(self):
        cargo = self.asignar().data
        r = self.api.post(
            f"/api/patrimonio/cargos/{cargo['id']}/transferir/",
            {"empleado": self.juan.id, "planilla_cargo": "PC-200", "fecha": "2026-06-01", "motivo": "Rotación"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["vigente"], r.data["tipo_cierre"], r.data["destino"]), (False, "TRANSFERENCIA_EMPLEADO", self.juan.nombre_completo))
        nuevo = CargoPatrimonial.objects.vigentes().get()
        self.assertEqual(
            (nuevo.empleado, nuevo.legajo, nuevo.iub, nuevo.planilla_cargo, nuevo.fecha_asignacion.isoformat()),
            (self.juan, "502", "IUB-1", "PC-200", "2026-06-01"),
        )
        trayectoria = self.api.get("/api/patrimonio/cargos/", {"search": "IUB-1"}).data["results"]
        self.assertEqual(len(trayectoria), 2)

    def test_transferir_a_area_externa_deja_el_bien_sin_agente(self):
        cargo = self.asignar().data
        r = self.api.post(f"/api/patrimonio/cargos/{cargo['id']}/transferir/", {"area_externa": "Secretaría de Hacienda", "fecha": "2026-06-01"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["tipo_cierre"], r.data["destino"]), ("TRANSFERENCIA_EXTERNA", "Secretaría de Hacienda"))
        self.assertFalse(CargoPatrimonial.objects.vigentes().exists())
        # Sigue figurando en el historial del empleado
        historial = self.api.get("/api/patrimonio/cargos/", {"empleado": self.ana.id, "situacion": "historial"}).data["results"]
        self.assertEqual(len(historial), 1)

    def test_transferir_exige_un_solo_destino_y_fecha_valida(self):
        cargo = self.asignar().data
        url = f"/api/patrimonio/cargos/{cargo['id']}/transferir/"
        self.assertEqual(self.api.post(url, {"fecha": "2026-06-01"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"empleado": self.juan.id, "area_externa": "X", "fecha": "2026-06-01"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"empleado": self.juan.id, "planilla_cargo": "PC-9", "fecha": "2026-01-01"}, format="json").status_code, 400)
        # La planilla nueva es obligatoria y distinta de la actual
        r = self.api.post(url, {"empleado": self.juan.id, "fecha": "2026-06-01"}, format="json")
        self.assertIn("planilla_cargo", r.data)
        r = self.api.post(url, {"empleado": self.juan.id, "planilla_cargo": "PC-100", "fecha": "2026-06-01"}, format="json")
        self.assertIn("planilla_cargo", r.data)

    def test_iub_y_planilla_son_obligatorios(self):
        r = self.asignar(iub="", planilla_cargo="")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(set(r.data), {"iub", "planilla_cargo"})

    def test_baja_y_resumen(self):
        cargo = self.asignar().data
        self.asignar(iub="IUB-2")
        self.assertEqual(self.api.get("/api/patrimonio/cargos/resumen/").data["total"], 2)
        r = self.api.post(f"/api/patrimonio/cargos/{cargo['id']}/dar-de-baja/", {"fecha": "2026-05-01", "motivo": "Fuente quemada"}, format="json")
        self.assertEqual((r.status_code, r.data["tipo_cierre"]), (200, "BAJA"))
        resumen = self.api.get("/api/patrimonio/cargos/resumen/").data
        self.assertEqual(resumen["total"], 1)
        self.assertEqual(next(i["cantidad"] for i in resumen["por_insumo"] if i["nombre"] == "CPU"), 1)
        # Un bien dado de baja (fuera de servicio) no puede volver a asignarse
        r = self.asignar(self.juan)
        self.assertEqual(r.status_code, 400)
        self.assertIn("dado de baja", str(r.data["iub"]))

    def test_no_se_da_de_baja_a_quien_tiene_bienes_a_cargo(self):
        cargo = self.asignar().data
        url = f"/api/personal/empleados/{self.ana.id}/"
        r = self.api.patch(url, {"situacion_revista": "BAJA", "fecha_baja": "2026-09-01"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("situacion_revista", r.data)
        self.api.post(f"/api/patrimonio/cargos/{cargo['id']}/dar-de-baja/", {"fecha": "2026-08-31"}, format="json")
        self.assertEqual(self.api.patch(url, {"situacion_revista": "BAJA", "fecha_baja": "2026-09-01"}, format="json").status_code, 200)

    def test_consulta_solo_lee_y_reporte(self):
        self.asignar()
        consulta = cliente(ROL_CONSULTA)
        self.assertEqual(consulta.get("/api/patrimonio/cargos/").status_code, 200)
        self.assertEqual(self.asignar(iub="X").status_code, 201)  # admin sí
        cargo = CargoPatrimonial.objects.first()
        self.assertEqual(consulta.post(f"/api/patrimonio/cargos/{cargo.id}/dar-de-baja/", {}, format="json").status_code, 403)
        filas = consulta.get("/api/reportes/cargos_patrimoniales/", {"formato": "json", "empleado": self.ana.id}).data["filas"]
        self.assertEqual({f["legajo"] for f in filas}, {"501"})
        for formato in ("xlsx", "pdf"):
            self.assertEqual(consulta.get("/api/reportes/cargos_patrimoniales/", {"formato": formato}).status_code, 200)
