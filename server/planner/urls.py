from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import health_check, ActivityViewSet, SubtaskViewSet

router = DefaultRouter()
router.register("activities", ActivityViewSet, basename="activity")

subtask_list = SubtaskViewSet.as_view(
	{
		"get": "list",
		"post": "create",
	}
)

urlpatterns = [
	path("health/", health_check),
	# /activities/{id}/subtasks/
	path(
		"activities/<int:activity_id>/subtasks/",
		subtask_list,
		name="activity-subtasks",
	),
]

urlpatterns += router.urls
