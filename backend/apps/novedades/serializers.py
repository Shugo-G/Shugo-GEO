from rest_framework import serializers

from apps.core.archivos import tamanio_adjunto, validar_adjunto
from apps.core.serializers import CatalogoSerializer

from .models import DocumentoNovedad, EstadoNovedad, Novedad, TipoNovedad
from .services import calcular_dias, puede_eliminarse, validar_edicion, validar_novedad


class TipoNovedadSerializer(CatalogoSerializer):
    computo_dias_display = serializers.CharField(source="get_computo_dias_display", read_only=True)
    saldo_de_nombre = serializers.CharField(source="saldo_de.nombre", read_only=True, default=None)

    class Meta(CatalogoSerializer.Meta):
        model = TipoNovedad
        fields = CatalogoSerializer.Meta.fields + [
            "color",
            "computo_dias",
            "computo_dias_display",
            "descuenta_saldo",
            "saldo_de",
            "saldo_de_nombre",
            "mostrar_saldo",
            "requiere_documentacion",
            "permite_sin_fecha_fin",
        ]

    def validate(self, attrs):
        def valor(campo):
            return attrs[campo] if campo in attrs else getattr(self.instance, campo, None)

        saldo_de = valor("saldo_de")
        if saldo_de is None:
            return attrs
        errores = {}
        if self.instance and saldo_de.pk == self.instance.pk:
            errores["saldo_de"] = "Un artículo no puede usar su propio saldo como compartido."
        elif saldo_de.saldo_de_id or not saldo_de.descuenta_saldo:
            errores["saldo_de"] = "Debe elegir un artículo que tenga saldo propio."
        elif self.instance and self.instance.tipos_que_comparten_saldo.exists():
            errores["saldo_de"] = "Otros artículos usan el saldo de éste; no puede, a su vez, usar el de otro."
        if errores:
            raise serializers.ValidationError(errores)
        # Compartir saldo implica descontar saldo.
        attrs["descuenta_saldo"] = True
        return attrs


class DocumentoNovedadSerializer(serializers.ModelSerializer):
    subido_por_nombre = serializers.CharField(source="subido_por.__str__", read_only=True, default=None)
    tamanio = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoNovedad
        fields = ["id", "novedad", "archivo", "nombre_original", "descripcion", "subido", "subido_por_nombre", "tamanio"]
        read_only_fields = ["nombre_original", "subido"]
        extra_kwargs = {"archivo": {"write_only": True}}

    def get_tamanio(self, obj):
        return tamanio_adjunto(obj.archivo)

    def validate_archivo(self, archivo):
        return validar_adjunto(archivo)

    def create(self, validated_data):
        validated_data["nombre_original"] = validated_data["archivo"].name[:255]
        return super().create(validated_data)


class NovedadSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source="empleado.nombre_completo", read_only=True)
    empleado_legajo = serializers.CharField(source="empleado.legajo", read_only=True)
    unidad_nombre = serializers.CharField(source="empleado.unidad.nombre", read_only=True)
    tipo_nombre = serializers.CharField(source="tipo.nombre", read_only=True)
    color = serializers.CharField(source="tipo.color", read_only=True)
    abierta = serializers.BooleanField(read_only=True)
    descuenta_saldo = serializers.BooleanField(source="tipo.descuenta_saldo", read_only=True)
    interrumpida = serializers.BooleanField(read_only=True)
    estado = serializers.SerializerMethodField()
    puede_eliminarse = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    anulada_por_nombre = serializers.CharField(source="anulada_por.__str__", read_only=True, default=None)
    dias_reintegrados = serializers.IntegerField(read_only=True)
    documentos_cantidad = serializers.SerializerMethodField()
    documentacion_pendiente = serializers.SerializerMethodField()
    documentos = serializers.SerializerMethodField()
    creado_por_nombre = serializers.CharField(source="creado_por.__str__", read_only=True, default=None)

    class Meta:
        model = Novedad
        read_only_fields = [
            "fecha_hasta_original",
            "dias_original",
            "motivo_interrupcion",
            "anulada",
            "fecha_anulacion",
            "motivo_anulacion",
        ]
        fields = [
            "id",
            "empleado",
            "empleado_nombre",
            "empleado_legajo",
            "unidad_nombre",
            "tipo",
            "tipo_nombre",
            "color",
            "fecha_desde",
            "fecha_hasta",
            "abierta",
            "dias",
            "descuenta_saldo",
            "motivo",
            "observaciones",
            "interrumpida",
            "fecha_hasta_original",
            "dias_original",
            "dias_reintegrados",
            "motivo_interrupcion",
            "estado",
            "estado_display",
            "anulada",
            "fecha_anulacion",
            "motivo_anulacion",
            "anulada_por_nombre",
            "documentos_cantidad",
            "documentacion_pendiente",
            "documentos",
            "creado",
            "creado_por_nombre",
            "puede_eliminarse",
        ]

    def get_puede_eliminarse(self, obj):
        return puede_eliminarse(obj)

    def get_estado(self, obj):
        return obj.estado()

    def get_estado_display(self, obj):
        return EstadoNovedad(obj.estado()).label

    def _cantidad_documentos(self, obj) -> int:
        cantidad = getattr(obj, "cantidad_documentos", None)
        return cantidad if cantidad is not None else obj.documentos.count()

    def get_documentos_cantidad(self, obj):
        return self._cantidad_documentos(obj)

    def get_documentacion_pendiente(self, obj):
        return obj.tipo.requiere_documentacion and self._cantidad_documentos(obj) == 0

    def get_documentos(self, obj):
        """Sólo se exponen a quienes tienen permiso de ver documentación respaldatoria."""
        request = self.context.get("request")
        if not request or not request.user.has_perm("novedades.view_documentonovedad"):
            return None
        return DocumentoNovedadSerializer(obj.documentos.all(), many=True).data

    def validate(self, attrs):
        def valor(campo):
            return attrs[campo] if campo in attrs else getattr(self.instance, campo, None)

        if self.instance is not None:
            if errores := validar_edicion(self.instance, attrs):
                raise serializers.ValidationError(errores)

        tipo = valor("tipo")
        desde = valor("fecha_desde")
        hasta = valor("fecha_hasta")

        # Si no se envían los días (o cambió el período sin enviarlos) se recalculan.
        periodo_cambio = any(c in attrs for c in ("tipo", "fecha_desde", "fecha_hasta"))
        if attrs.get("dias") is None and (self.instance is None or periodo_cambio or "dias" in attrs):
            attrs["dias"] = calcular_dias(tipo, desde, hasta)
        if hasta is None:
            attrs["dias"] = None

        errores = validar_novedad(
            empleado=valor("empleado"),
            tipo=tipo,
            desde=desde,
            hasta=hasta,
            dias=attrs.get("dias", valor("dias")),
            instancia=self.instance,
        )
        if errores:
            raise serializers.ValidationError(errores)
        return attrs
