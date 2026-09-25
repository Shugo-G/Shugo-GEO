from datetime import date, timedelta

from django.test import TestCase

from apps.core.fechas import hoy
from apps.core.testing import cliente, crear_empleado, datos_base
from apps.novedades.models import Novedad

from .models import ConceptoMovimiento, MovimientoSaldo
from .services import calcular_saldo


class SaldoTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        self.tipo = self.d["vacaciones"]

    def movimiento(self, concepto, dias, anio=2026, **extra):
        return MovimientoSaldo.objects.create(
            empleado=self.empleado, tipo_novedad=self.tipo, concepto=concepto, anio=anio, dias=dias, fecha=date(2026, 1, 1), **extra
        )

    def test_saldo_acumula_anios_compensaciones_y_descuenta_usados_y_programados(self):
        self.movimiento(ConceptoMovimiento.ASIGNACION, 5, anio=2025)
        self.movimiento(ConceptoMovimiento.ASIGNACION, 20)
        self.movimiento(ConceptoMovimiento.COMPENSACION, 1, fecha_trabajada=date(2026, 3, 7))
        self.movimiento(ConceptoMovimiento.AJUSTE, -2, motivo="Corrección")
        pasado = hoy() - timedelta(days=30)
        futuro = hoy() + timedelta(days=30)
        Novedad.objects.create(empleado=self.empleado, tipo=self.tipo, fecha_desde=pasado, fecha_hasta=pasado, dias=4)
        Novedad.objects.create(empleado=self.empleado, tipo=self.tipo, fecha_desde=futuro, fecha_hasta=futuro, dias=3)

        saldo = calcular_saldo(self.empleado, self.tipo)
        self.assertEqual(saldo["acreditados"], 24)
        self.assertEqual(saldo["usados"], 4)
        self.assertEqual(saldo["programados"], 3)
        self.assertEqual(saldo["disponible"], 17)

    def test_compensacion_requiere_fecha_trabajada(self):
        respuesta = self.api.post(
            "/api/vacaciones/movimientos/",
            {"empleado": self.empleado.id, "tipo_novedad": self.tipo.id, "concepto": "COMPENSACION", "anio": 2026, "dias": 1, "fecha": "2026-03-09"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("fecha_trabajada", respuesta.data)

    def test_asignacion_masiva_omite_existentes(self):
        otro = crear_empleado(self.d["area"], self.d["planta"], 2)
        self.movimiento(ConceptoMovimiento.ASIGNACION, 20)
        respuesta = self.api.post(
            "/api/vacaciones/movimientos/asignacion-masiva/",
            {"tipo_novedad": self.tipo.id, "anio": 2026, "dias": 20},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data, {"creados": 1, "omitidos": 1})
        self.assertTrue(MovimientoSaldo.objects.filter(empleado=otro, anio=2026).exists())


class BolsaCompartidaTests(TestCase):
    """Licencia invernal comparte la bolsa de días de Licencia vacaciones."""

    def setUp(self):
        from apps.novedades.models import TipoNovedad

        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        self.vacaciones = self.d["vacaciones"]
        self.invernal = TipoNovedad.objects.get(nombre="Licencia invernal")

    def acreditar(self, tipo, dias):
        MovimientoSaldo.objects.create(
            empleado=self.empleado, tipo_novedad=tipo, concepto=ConceptoMovimiento.ASIGNACION, anio=2026, dias=dias, fecha=date(2026, 1, 1)
        )

    def test_acreditaciones_y_licencias_de_ambos_tipos_usan_el_mismo_saldo(self):
        self.acreditar(self.vacaciones, 15)
        self.acreditar(self.invernal, 7)
        pasado = hoy() - timedelta(days=10)
        Novedad.objects.create(empleado=self.empleado, tipo=self.invernal, fecha_desde=pasado, fecha_hasta=pasado, dias=3)

        saldo = calcular_saldo(self.empleado, self.vacaciones)
        self.assertEqual((saldo["acreditados"], saldo["usados"], saldo["disponible"]), (22, 3, 19))
        self.assertEqual(saldo["incluye"], ["Licencia invernal"])
        # Consultar por el tipo invernal devuelve la misma bolsa
        self.assertEqual(calcular_saldo(self.empleado, self.invernal)["disponible"], 19)
        desglose = {d["tipo"]: (d["acreditados"], d["usados"]) for d in saldo["desglose"]}
        self.assertEqual(desglose, {"Licencia vacaciones": (15, 0), "Licencia invernal": (7, 3)})

    def test_licencia_invernal_valida_contra_el_saldo_compartido(self):
        self.acreditar(self.vacaciones, 2)
        respuesta = self.api.post(
            "/api/novedades/",
            {"empleado": self.empleado.id, "tipo": self.invernal.id, "fecha_desde": "2026-10-05", "fecha_hasta": "2026-10-09"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("dias", respuesta.data)

    def test_no_se_encadenan_bolsas(self):
        # Vacaciones es la bolsa de invernal: no puede a su vez usar el saldo de otro tipo
        otro = self.api.post(
            "/api/novedades/tipos/",
            {"nombre": "Otra", "categoria": self.invernal.categoria_id, "descuenta_saldo": True},
            format="json",
        ).data
        r = self.api.patch(f"/api/novedades/tipos/{self.vacaciones.id}/", {"saldo_de": otro["id"]}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.api.patch(f"/api/novedades/tipos/{otro['id']}/", {"saldo_de": self.invernal.id}, format="json")
        self.assertEqual(r.status_code, 400)


class BolsasVisiblesYUsoTests(TestCase):
    def setUp(self):
        from apps.novedades.models import CategoriaEstado, TipoNovedad

        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        self.otro = crear_empleado(self.d["area"], self.d["planta"], 2)
        vacaciones_cat = CategoriaEstado.objects.get(nombre="Vacaciones")
        self.lic2025 = TipoNovedad.objects.create(nombre="Licencia 2025", categoria=vacaciones_cat, descuenta_saldo=True)
        for tipo, dias in ((self.d["vacaciones"], 20), (self.lic2025, 5)):
            MovimientoSaldo.objects.create(
                empleado=self.empleado, tipo_novedad=tipo, concepto=ConceptoMovimiento.ASIGNACION, anio=2026, dias=dias, fecha=date(2026, 1, 1)
            )

    def test_saldo_informa_categoria_y_actividad(self):
        from .services import saldos_por_empleado

        saldos = saldos_por_empleado([self.empleado.id, self.otro.id])
        s = saldos[self.empleado.id][self.lic2025.id]
        self.assertEqual((s["categoria"], s["con_movimientos"], s["mostrar"]), ("Vacaciones", True, True))
        self.assertFalse(saldos[self.otro.id][self.lic2025.id]["con_movimientos"])

    def test_bolsa_oculta_no_aparece_en_saldos_ni_reporte(self):
        self.lic2025.mostrar_saldo = False
        self.lic2025.save()
        tipos = [t["nombre"] for t in self.api.get("/api/vacaciones/saldos/").data["tipos"]]
        self.assertNotIn("Licencia 2025", tipos)
        tipos = [t["nombre"] for t in self.api.get("/api/vacaciones/saldos/", {"incluir_ocultas": 1}).data["tipos"]]
        self.assertIn("Licencia 2025", tipos)
        filas = self.api.get("/api/reportes/saldos/", {"formato": "json", "empleado": self.empleado.id}).data["filas"]
        self.assertNotIn("Licencia 2025", [f["tipo"] for f in filas])

    def test_reporte_filtra_por_empleado_y_agrega_total(self):
        filas = self.api.get("/api/reportes/saldos/", {"formato": "json", "empleado": self.empleado.id}).data["filas"]
        self.assertEqual({f["empleado"] for f in filas}, {self.empleado.nombre_completo})
        total = next(f for f in filas if f["tipo"] == "TOTAL")
        self.assertEqual(total["disponible"], 25)

    def test_uso_del_tipo_y_mensaje_al_eliminar(self):
        uso = self.api.get(f"/api/novedades/tipos/{self.lic2025.id}/uso/").data
        self.assertEqual([(m["empleado"], m["dias"]) for m in uso["movimientos"]], [(self.empleado.nombre_completo, 5)])
        r = self.api.delete(f"/api/novedades/tipos/{self.lic2025.id}/")
        self.assertEqual(r.status_code, 409)
        self.assertIn("1 movimientos de saldo", r.data["detail"])


class PreferenciasYEliminacionTests(TestCase):
    def setUp(self):
        from apps.novedades.models import CategoriaEstado, TipoNovedad

        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        cat = CategoriaEstado.objects.get(nombre="Vacaciones")
        self.lic2027 = TipoNovedad.objects.create(nombre="Licencia invierno 2027", categoria=cat, descuenta_saldo=True)
        MovimientoSaldo.objects.create(
            empleado=self.empleado, tipo_novedad=self.d["vacaciones"], concepto=ConceptoMovimiento.ASIGNACION, anio=2026, dias=10, fecha=date(2026, 1, 1)
        )

    def ficha_saldos(self):
        return {s["tipo"]: s for s in self.api.get(f"/api/personal/empleados/{self.empleado.id}/ficha/").data["saldos"]}

    def test_elegir_bolsas_visibles_por_empleado(self):
        saldos = self.ficha_saldos()
        self.assertTrue(saldos["Licencia vacaciones"]["visible"])
        self.assertFalse(saldos["Licencia invierno 2027"]["visible"])  # sin movimientos

        r = self.api.post("/api/vacaciones/preferencias/", {"empleado": self.empleado.id, "tipo": self.lic2027.id, "visible": True}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.api.post("/api/vacaciones/preferencias/", {"empleado": self.empleado.id, "tipo": self.d["vacaciones"].id, "visible": False}, format="json")
        saldos = self.ficha_saldos()
        self.assertTrue(saldos["Licencia invierno 2027"]["visible"] and saldos["Licencia invierno 2027"]["eleccion_manual"])
        self.assertFalse(saldos["Licencia vacaciones"]["visible"])

        # null vuelve a la regla por defecto
        self.api.post("/api/vacaciones/preferencias/", {"empleado": self.empleado.id, "tipo": self.d["vacaciones"].id, "visible": None}, format="json")
        self.assertTrue(self.ficha_saldos()["Licencia vacaciones"]["visible"])

    def test_consulta_no_puede_cambiar_preferencias(self):
        from apps.core.testing import ROL_CONSULTA

        r = cliente(ROL_CONSULTA).post("/api/vacaciones/preferencias/", {"empleado": self.empleado.id, "tipo": self.lic2027.id, "visible": True}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_tipo_con_solo_licencias_anuladas_se_puede_eliminar(self):
        from apps.novedades.models import Novedad

        self.lic2027.permite_sin_fecha_fin = True
        self.lic2027.save()
        n = Novedad.objects.create(empleado=self.empleado, tipo=self.lic2027, fecha_desde=date(2026, 7, 1), fecha_hasta=date(2026, 7, 1), dias=1)
        self.assertTrue(self.api.get(f"/api/novedades/tipos/{self.lic2027.id}/uso/").data["bloquea_eliminacion"])
        self.api.post(f"/api/novedades/{n.id}/anular/", {"motivo": "Error de carga"}, format="json")
        uso = self.api.get(f"/api/novedades/tipos/{self.lic2027.id}/uso/").data
        self.assertEqual((uso["bloquea_eliminacion"], uso["anuladas"]), (False, 1))
        self.assertEqual(self.api.delete(f"/api/novedades/tipos/{self.lic2027.id}/").status_code, 204)
        self.assertFalse(Novedad.todas.filter(pk=n.pk).exists())
