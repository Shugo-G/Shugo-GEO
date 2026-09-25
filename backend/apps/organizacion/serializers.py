from rest_framework import serializers

from apps.core.serializers import CatalogoSerializer

from .models import ModalidadContratacion, Puesto, TipoUnidad, UnidadOrganizativa
from .selectors import Arbol


class UnidadOrganizativaSerializer(CatalogoSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    padre_nombre = serializers.CharField(source="padre.nombre", read_only=True, default=None)
    ruta = serializers.SerializerMethodField()

    class Meta(CatalogoSerializer.Meta):
        model = UnidadOrganizativa
        fields = CatalogoSerializer.Meta.fields + ["tipo", "tipo_display", "padre", "padre_nombre", "ruta"]
        # La unicidad (padre, nombre) se valida en validate() con un mensaje claro.
        validators = []

    def get_ruta(self, obj):
        arbol = self.context.setdefault("_arbol", Arbol())
        return arbol.ruta(obj.id)

    def validate(self, attrs):
        def valor(campo):
            return attrs[campo] if campo in attrs else getattr(self.instance, campo, None)

        tipo, padre, nombre = valor("tipo"), valor("padre"), valor("nombre")
        errores = {}

        if tipo == TipoUnidad.DIRECCION_GENERAL:
            if padre is not None:
                errores["padre"] = "Una Dirección General no depende de otra unidad."
        elif padre is None:
            errores["padre"] = "Indique de qué unidad depende."
        elif TipoUnidad.nivel(padre.tipo) >= TipoUnidad.nivel(tipo):
            errores["padre"] = f"Una {TipoUnidad(tipo).label.lower()} no puede depender de una {padre.get_tipo_display().lower()}."

        if self.instance and padre is not None:
            if padre.pk in Arbol().descendientes([self.instance.pk]):
                errores["padre"] = "Una unidad no puede depender de sí misma ni de una unidad que depende de ella."
            elif TipoUnidad.nivel(tipo) >= min(
                (TipoUnidad.nivel(h.tipo) for h in self.instance.hijas.all()), default=len(TipoUnidad.values)
            ):
                errores["tipo"] = "El tipo debe ser de mayor nivel que el de sus unidades dependientes."

        repetida = UnidadOrganizativa.objects.filter(padre=padre, nombre__iexact=nombre)
        if self.instance:
            repetida = repetida.exclude(pk=self.instance.pk)
        if repetida.exists():
            errores["nombre"] = "Ya existe una unidad con ese nombre en el mismo nivel."

        if errores:
            raise serializers.ValidationError(errores)
        return attrs


class PuestoSerializer(CatalogoSerializer):
    class Meta(CatalogoSerializer.Meta):
        model = Puesto


class ModalidadContratacionSerializer(CatalogoSerializer):
    class Meta(CatalogoSerializer.Meta):
        model = ModalidadContratacion
        fields = CatalogoSerializer.Meta.fields + ["usa_dni_como_legajo", "requiere_fecha_fin", "color"]
