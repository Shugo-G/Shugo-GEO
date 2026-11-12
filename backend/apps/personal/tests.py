from django.test import TestCase

from apps.core.testing import cliente, crear_empleado, datos_base


class EmpleadoTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        self.api = cliente()

    def payload(self, **extra):
        datos = {
            "apellido": "Pérez",
            "nombre": "Ana",
            "dni": "30111222",
            "fecha_nacimiento": "1990-05-10",
            "unidad": self.d["area"].id,
            "modalidad": self.d["planta"].id,
            "fecha_ingreso": "2024-03-01",
        }
        datos.update(extra)
        return datos

    def test_planta_requiere_legajo(self):
        respuesta = self.api.post("/api/personal/empleados/", self.payload(), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("legajo", respuesta.data)

    def test_pasante_usa_dni_como_legajo_y_requiere_fin_de_contrato(self):
        respuesta = self.api.post("/api/personal/empleados/", self.payload(modalidad=self.d["pasante"].id), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("fecha_fin_contrato", respuesta.data)

        respuesta = self.api.post(
            "/api/personal/empleados/",
            self.payload(modalidad=self.d["pasante"].id, fecha_fin_contrato="2026-12-31"),
            format="json",
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["legajo"], "30111222")

    def test_legajo_unico(self):
        crear_empleado(self.d["area"], self.d["planta"], legajo="500")
        respuesta = self.api.post("/api/personal/empleados/", self.payload(legajo="500"), format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_ficha_e_historial(self):
        empleado = crear_empleado(self.d["area"], self.d["planta"])
        self.api.patch(f"/api/personal/empleados/{empleado.id}/", {"telefono": "2901-123456"}, format="json")
        ficha = self.api.get(f"/api/personal/empleados/{empleado.id}/ficha/").data
        self.assertTrue(ficha["situacion_actual"]["trabajando"])
        self.assertEqual(len(ficha["saldos"]), 1)
        historial = self.api.get(f"/api/personal/empleados/{empleado.id}/historial/").data
        self.assertEqual(historial[0]["tipo"], "Modificación")
        self.assertEqual(historial[0]["cambios"][0]["nuevo"], "2901-123456")

    def test_asignar_empleado_directo_a_la_direccion_general(self):
        from apps.organizacion.models import TipoUnidad, UnidadOrganizativa

        dg = UnidadOrganizativa.objects.get(tipo=TipoUnidad.DIRECCION_GENERAL)
        respuesta = self.api.post("/api/personal/empleados/", self.payload(unidad=dg.id, legajo="900"), format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["unidad_tipo"], "Dirección General")
        self.assertEqual(respuesta.data["unidad_ruta"], dg.nombre)


class DatosLaboralesTests(TestCase):
    """Campos agregados a la ficha: etiqueta, CUIT, título, horario, cargo y adicionales."""

    def setUp(self):
        from apps.organizacion.models import Adicional, Cargo

        self.d = datos_base()
        self.api = cliente()
        self.cargo = Cargo.objects.create(nombre="JEFE DE DEPARTAMENTO")
        # Los adicionales iniciales los cargan los seeds.
        self.guardia = Adicional.objects.get(nombre="GUARDIA PASIVA")
        self.capacitador = Adicional.objects.get(nombre="CAPACITADOR")

    def payload(self, **extra):
        datos = {
            "apellido": "Vera Vargas",
            "nombre": "Moira Catalina",
            "dni": "30111222",
            "legajo": "700",
            "fecha_nacimiento": "1990-05-10",
            "unidad": self.d["area"].id,
            "modalidad": self.d["planta"].id,
            "fecha_ingreso": "2024-03-01",
        }
        datos.update(extra)
        return datos

    def test_fecha_de_nacimiento_obligatoria(self):
        r = self.api.post("/api/personal/empleados/", self.payload(fecha_nacimiento=None), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("fecha_nacimiento", r.data)
        # Un registro anterior sin fecha admite cambios parciales que no la tocan
        viejo = crear_empleado(self.d["area"], self.d["planta"], 5)
        self.assertEqual(self.api.patch(f"/api/personal/empleados/{viejo.id}/", {"telefono": "1"}, format="json").status_code, 200)
        r = self.api.patch(f"/api/personal/empleados/{viejo.id}/", {"fecha_nacimiento": None}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_nombre_de_tarjeta_y_etiqueta(self):
        r = self.api.post("/api/personal/empleados/", self.payload(), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["nombre_tarjeta"], "Vera, Moira")
        r = self.api.patch(f"/api/personal/empleados/{r.data['id']}/", {"etiqueta": "Moira Vera Vargas"}, format="json")
        self.assertEqual(r.data["nombre_tarjeta"], "Moira Vera Vargas")
        # Los apellidos con partícula no se parten
        compuesto = crear_empleado(self.d["area"], self.d["planta"], 7, apellido="DE LA CRUZ PÉREZ", nombre="MARÍA DE LOS ÁNGELES")
        self.assertEqual(compuesto.nombre_tarjeta, "DE LA CRUZ, MARÍA")

    def test_cuit(self):
        r = self.api.post("/api/personal/empleados/", self.payload(cuit="20-12345678-9"), format="json")
        self.assertIn("cuit", r.data)  # dígito verificador incorrecto
        r = self.api.post("/api/personal/empleados/", self.payload(cuit="20-30111222-0"), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["cuit"], "20301112220")

    def test_horario_cargo_y_adicionales(self):
        r = self.api.post(
            "/api/personal/empleados/",
            self.payload(
                titulo="Analista de Sistemas",
                numero_proveedor="26797",
                hora_entrada="07:00",
                hora_salida="14:00",
                cargo=self.cargo.id,
                cargo_acto_administrativo=" Resolución 109-2026 ",
                adicionales=[self.guardia.id, self.capacitador.id],
            ),
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["horario"], r.data["cargo_nombre"], r.data["cargo_acto_administrativo"]), ("07:00 a 14:00", "JEFE DE DEPARTAMENTO", "Resolución 109-2026"))
        self.assertEqual(sorted(r.data["adicionales_nombres"]), ["CAPACITADOR", "GUARDIA PASIVA"])
        # Por defecto 08:00 a 15:00; sin cargo no queda acto administrativo
        otro = self.api.post(
            "/api/personal/empleados/", self.payload(dni="30111333", legajo="701", cargo_acto_administrativo="Res. 1"), format="json"
        ).data
        self.assertEqual((otro["horario"], otro["cargo_acto_administrativo"]), ("08:00 a 15:00", ""))
        # Los adicionales quedan en el historial de cambios
        self.api.patch(f"/api/personal/empleados/{r.data['id']}/", {"adicionales": [self.guardia.id]}, format="json")
        cambios = self.api.get(f"/api/personal/empleados/{r.data['id']}/historial/").data[0]["cambios"]
        self.assertEqual([(c["campo"], c["anterior"], c["nuevo"]) for c in cambios], [("adicionales", "CAPACITADOR, GUARDIA PASIVA", "GUARDIA PASIVA")])
        # Filtro y reporte por adicional
        self.assertEqual(self.api.get("/api/personal/empleados/", {"adicional": self.guardia.id}).data["count"], 1)
        filas = self.api.get("/api/reportes/adicionales/", {"formato": "json", "adicional": self.guardia.id}).data["filas"]
        self.assertEqual([(f["adicional"], f["legajo"], f["cargo"]) for f in filas], [("GUARDIA PASIVA", "700", "JEFE DE DEPARTAMENTO")])
        for formato in ("xlsx", "pdf"):
            self.assertEqual(self.api.get("/api/reportes/adicionales/", {"formato": formato}).status_code, 200)

    def test_cargo_en_uso_no_se_borra(self):
        self.api.post("/api/personal/empleados/", self.payload(cargo=self.cargo.id), format="json")
        self.assertEqual(self.api.delete(f"/api/organizacion/cargos/{self.cargo.id}/").status_code, 409)


class BajaCierraLicenciasTests(TestCase):
    def test_baja_cierra_interrumpe_y_anula(self):
        from datetime import date

        from apps.novedades.models import Novedad

        d = datos_base()
        api = cliente()
        e = crear_empleado(d["area"], d["planta"])
        pasada = Novedad.objects.create(empleado=e, tipo=d["medica"], fecha_desde=date(2026, 3, 2), fecha_hasta=date(2026, 3, 4), dias=3)
        en_curso = Novedad.objects.create(empleado=e, tipo=d["medica"], fecha_desde=date(2026, 6, 8), fecha_hasta=date(2026, 6, 19), dias=12)
        abierta = Novedad.objects.create(empleado=e, tipo=d["ausencia"], fecha_desde=date(2026, 6, 9))
        futura = Novedad.objects.create(empleado=e, tipo=d["medica"], fecha_desde=date(2026, 7, 1), fecha_hasta=date(2026, 7, 3), dias=3)

        r = api.patch(f"/api/personal/empleados/{e.id}/", {"situacion_revista": "BAJA", "fecha_baja": "2026-06-10"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        for n in (pasada, en_curso, abierta, futura):
            n.refresh_from_db()
        self.assertEqual((pasada.fecha_hasta, pasada.anulada), (date(2026, 3, 4), False))
        self.assertEqual((en_curso.fecha_hasta, en_curso.fecha_hasta_original, en_curso.motivo_interrupcion), (date(2026, 6, 10), date(2026, 6, 19), "Baja del agente"))
        self.assertEqual((abierta.fecha_hasta, abierta.dias), (date(2026, 6, 10), 2))
        self.assertEqual((futura.anulada, futura.motivo_anulacion), (True, "Baja del agente"))
        # Editar a alguien que ya está de baja no vuelve a tocar sus licencias
        self.assertEqual(api.patch(f"/api/personal/empleados/{e.id}/", {"observaciones": "x"}, format="json").status_code, 200)
