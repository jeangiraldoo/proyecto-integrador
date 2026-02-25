from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import health_check, ActivityViewSet

router = DefaultRouter()
router.register("activities", ActivityViewSet, basename="activity")

urlpatterns = [
	path("health/", health_check),
]

urlpatterns += router.urls
