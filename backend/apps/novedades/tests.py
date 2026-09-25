from datetime import date

from django.test import TestCase

from apps.calendario.models import DiaNoLaborable, TipoDiaNoLaborable
from apps.core.testing import ROL_CONSULTA, cliente, crear_empleado, datos_base
from apps.vacaciones.models import ConceptoMovimiento, MovimientoSaldo


class NovedadTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        MovimientoSaldo.objects.create(
            empleado=self.empleado, tipo_novedad=self.d["vacaciones"], concepto=ConceptoMovimiento.ASIGNACION,
            anio=2026, dias=10, fecha=date(2026, 1, 1),
        )

    def crear(self, **datos):
        base = {"empleado": self.empleado.id, "tipo": self.d["vacaciones"].id}
        return self.api.post("/api/novedades/", {**base, **datos}, format="json")

    def test_calcula_dias_habiles_descontando_feriados(self):
        DiaNoLaborable.objects.create(fecha=date(2026, 10, 12), tipo=TipoDiaNoLaborable.FERIADO_NACIONAL, motivo="Feriado")
        # 12/10 (lun, feriado) al 16/10 (vie) = 4 días hábiles
        respuesta = self.crear(fecha_desde="2026-10-12", fecha_hasta="2026-10-16")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["dias"], 4)

    def test_rechaza_si_supera_el_saldo(self):
        respuesta = self.crear(fecha_desde="2026-10-01", fecha_hasta="2026-10-30")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("dias", respuesta.data)

    def test_vacaciones_requieren_fecha_fin_pero_licencia_medica_puede_quedar_abierta(self):
        self.assertEqual(self.crear(fecha_desde="2026-10-01").status_code, 400)
        respuesta = self.crear(tipo=self.d["medica"].id, fecha_desde="2026-10-01")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertTrue(respuesta.data["abierta"])
        self.assertTrue(respuesta.data["documentacion_pendiente"])

    def test_cerrar_novedad_abierta(self):
        novedad = self.crear(tipo=self.d["medica"].id, fecha_desde="2026-10-01").data
        respuesta = self.api.post(f"/api/novedades/{novedad['id']}/cerrar/", {"fecha_hasta": "2026-10-03"}, format="json")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["dias"], 3)  # licencia médica: días corridos

    def test_consulta_no_puede_crear_ni_ver_documentos(self):
        api = cliente(ROL_CONSULTA)
        respuesta = api.post("/api/novedades/", {"empleado": self.empleado.id}, format="json")
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(api.get("/api/novedades/documentos/").status_code, 403)

    def test_interrumpir_reintegra_los_dias_no_tomados(self):
        from apps.vacaciones.services import calcular_saldo

        # 05/10 (lun) al 16/10 (vie) = 10 días hábiles -> saldo 10 - 10 = 0
        novedad = self.crear(fecha_desde="2026-10-05", fecha_hasta="2026-10-16").data
        self.assertEqual(calcular_saldo(self.empleado, self.d["vacaciones"])["disponible"], 0)

        # Vuelve antes: último día tomado el 07/10 (3 días hábiles) -> se reintegran 7
        r = self.api.post(
            f"/api/novedades/{novedad['id']}/interrumpir/", {"fecha_hasta": "2026-10-07", "motivo": "Urgencia"}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["dias"], r.data["dias_original"], r.data["dias_reintegrados"]), (3, 10, 7))
        self.assertEqual(r.data["fecha_hasta_original"], "2026-10-16")
        self.assertTrue(r.data["interrumpida"])
        self.assertEqual(calcular_saldo(self.empleado, self.d["vacaciones"])["disponible"], 7)

    def test_interrumpir_valida_fechas(self):
        novedad = self.crear(fecha_desde="2026-10-05", fecha_hasta="2026-10-09").data
        url = f"/api/novedades/{novedad['id']}/interrumpir/"
        self.assertEqual(self.api.post(url, {"fecha_hasta": "2026-10-09"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"fecha_hasta": "2026-10-01"}, format="json").status_code, 400)
        self.assertEqual(cliente(ROL_CONSULTA).post(url, {"fecha_hasta": "2026-10-06"}, format="json").status_code, 403)


class ProteccionNovedadesTests(TestCase):
    """Licencias ya iniciadas no se borran: se interrumpen o se anulan, dejando registro."""

    def setUp(self):
        from datetime import timedelta

        from apps.core.fechas import hoy
        from apps.novedades.models import Novedad

        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        MovimientoSaldo.objects.create(
            empleado=self.empleado, tipo_novedad=self.d["vacaciones"], concepto=ConceptoMovimiento.ASIGNACION,
            anio=2026, dias=20, fecha=date(2026, 1, 1),
        )
        h = hoy()
        crear = lambda desde, hasta: Novedad.objects.create(  # noqa: E731
            empleado=self.empleado, tipo=self.d["vacaciones"], fecha_desde=desde, fecha_hasta=hasta, dias=5
        )
        self.finalizada = crear(h - timedelta(days=30), h - timedelta(days=24))
        self.en_curso = crear(h - timedelta(days=1), h + timedelta(days=6))
        self.programada = crear(h + timedelta(days=30), h + timedelta(days=36))

    def disponible(self):
        from apps.vacaciones.services import calcular_saldo

        return calcular_saldo(self.empleado, self.d["vacaciones"])["disponible"]

    def test_estados(self):
        estados = {n["id"]: n["estado"] for n in self.api.get("/api/novedades/").data["results"]}
        self.assertEqual(estados[self.finalizada.id], "FINALIZADA")
        self.assertEqual(estados[self.en_curso.id], "EN_CURSO")
        self.assertEqual(estados[self.programada.id], "PROGRAMADA")

    def _cargada_ayer(self, *novedades):
        from datetime import timedelta

        from django.utils import timezone

        from apps.novedades.models import Novedad

        Novedad.todas.filter(pk__in=[n.pk for n in novedades]).update(creado=timezone.now() - timedelta(days=1))

    def test_se_puede_eliminar_lo_cargado_hoy_aunque_haya_empezado(self):
        # Corrección inmediata de un error de carga
        self.assertEqual(self.api.delete(f"/api/novedades/{self.en_curso.id}/").status_code, 204)

    def test_solo_se_eliminan_las_programadas(self):
        self._cargada_ayer(self.finalizada, self.en_curso)
        self.assertEqual(self.api.delete(f"/api/novedades/{self.finalizada.id}/").status_code, 400)
        self.assertEqual(self.api.delete(f"/api/novedades/{self.en_curso.id}/").status_code, 400)
        self.assertEqual(self.disponible(), 5)  # no se reintegró nada
        self.assertEqual(self.api.delete(f"/api/novedades/{self.programada.id}/").status_code, 204)
        self.assertEqual(self.disponible(), 10)

    def test_anular_conserva_el_registro_y_reintegra_los_dias(self):
        r = self.api.post(f"/api/novedades/{self.finalizada.id}/anular/", {"motivo": ""}, format="json")
        self.assertEqual(r.status_code, 400)  # motivo obligatorio
        r = self.api.post(f"/api/novedades/{self.finalizada.id}/anular/", {"motivo": "Cargada por error"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["estado"], r.data["motivo_anulacion"]), ("ANULADA", "Cargada por error"))
        self.assertEqual(self.disponible(), 10)
        historial = self.api.get("/api/novedades/", {"situacion": "historial"}).data["results"]
        self.assertIn(self.finalizada.id, [n["id"] for n in historial])
        # No puede modificarse ni anularse de nuevo
        self.assertEqual(self.api.patch(f"/api/novedades/{self.finalizada.id}/", {"motivo": "x"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(f"/api/novedades/{self.finalizada.id}/anular/", {"motivo": "x"}, format="json").status_code, 400)

    def test_finalizada_solo_permite_editar_motivo_y_observaciones(self):
        from datetime import timedelta

        url = f"/api/novedades/{self.finalizada.id}/"
        self.assertEqual(self.api.patch(url, {"motivo": "Viaje"}, format="json").status_code, 200)
        r = self.api.patch(url, {"fecha_hasta": str(self.finalizada.fecha_hasta - timedelta(days=1))}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_en_curso_no_se_acorta_editando(self):
        from datetime import timedelta

        url = f"/api/novedades/{self.en_curso.id}/"
        r = self.api.patch(url, {"fecha_hasta": str(self.en_curso.fecha_hasta - timedelta(days=2))}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Interrumpir", str(r.data["fecha_hasta"]))
        r = self.api.patch(url, {"fecha_hasta": str(self.en_curso.fecha_hasta + timedelta(days=2))}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_filtro_activas_e_historial(self):
        activas = {n["id"] for n in self.api.get("/api/novedades/", {"situacion": "activas"}).data["results"]}
        historial = {n["id"] for n in self.api.get("/api/novedades/", {"situacion": "historial"}).data["results"]}
        self.assertEqual(activas, {self.en_curso.id, self.programada.id})
        self.assertEqual(historial, {self.finalizada.id})
