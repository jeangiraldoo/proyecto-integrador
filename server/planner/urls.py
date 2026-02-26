from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import health_check, ActivityViewSet, SubtaskViewSet, TodayView

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
	path(
		"activities/<int:activity_id>/subtasks/",
		subtask_list,
		name="activity-subtasks",
	),
	path(
		"activities/<int:activity_id>/subtasks/<int:subtask_id>/",
		SubtaskViewSet.as_view({"delete": "destroy", "patch": "partial_update"}),
		name="activity-subtask-detail",
	),
	path("today/", TodayView.as_view(), name="today"),
]

urlpatterns += router.urls
