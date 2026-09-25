"""ViewSets base reutilizables."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response


class AuditedModelViewSet(viewsets.ModelViewSet):
    """Completa `creado_por` al crear y expone el historial de cambios del registro."""

    def perform_create(self, serializer):
        model = serializer.Meta.model
        if any(f.name == "creado_por" for f in model._meta.get_fields()):
            serializer.save(creado_por=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=["get"])
    def historial(self, request, pk=None):
        obj = self.get_object()
        if not hasattr(obj, "history"):
            return Response([])
        from apps.core.serializers import serializar_historial

        return Response(serializar_historial(obj))


class CatalogoViewSet(AuditedModelViewSet):
    """ViewSet para catálogos configurables (búsqueda por nombre, filtro por activo)."""

    search_fields = ["nombre", "descripcion"]
    filterset_fields = ["activo"]
    ordering_fields = ["orden", "nombre"]
