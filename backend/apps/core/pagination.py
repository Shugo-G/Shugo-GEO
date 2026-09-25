from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Paginación estándar. `?page_size=0` devuelve todos los registros (útil para combos)."""

    page_size_query_param = "page_size"
    max_page_size = 500

    def get_page_size(self, request):
        if request.query_params.get(self.page_size_query_param) == "0":
            return None
        return super().get_page_size(request)
