from rest_framework import serializers

from .models import DiaNoLaborable


class DiaNoLaborableSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = DiaNoLaborable
        fields = ["id", "fecha", "tipo", "tipo_display", "motivo", "norma", "observaciones"]
