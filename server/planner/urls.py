from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
	ActivityViewSet,
	ConflictViewSet,
	MeView,
	RegisterView,
	SubjectViewSet,
	SubtaskViewSet,
	TodayView,
	health_check,
)

router = DefaultRouter()
router.register("activities", ActivityViewSet, basename="activity")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("conflicts", ConflictViewSet, basename="conflict")

subtask_list = SubtaskViewSet.as_view(
	{
		"get": "list",
		"post": "create",
	}
)

urlpatterns = [
	path("health/", health_check),
	path("me/", MeView.as_view(), name="me"),
	path("register/", RegisterView.as_view(), name="register"),
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
