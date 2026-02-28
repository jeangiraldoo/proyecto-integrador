import logging
from datetime import timedelta

from django.http import Http404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Activity, Subtask
from .serializers import ActivitySerializer, SubtaskSerializer, UserSerializer

logger = logging.getLogger(__name__)


@api_view(["GET"])
@extend_schema(
	summary="Health check",
	description="Return a simple status object confirming the API is reachable.",
	responses={200: OpenApiTypes.OBJECT},
	examples=[OpenApiExample("Health example", value={"status": "ok"}, response_only=True)],
)
def health_check():
	return Response({"status": "ok"})


class MeView(APIView):
	permission_classes = [IsAuthenticated]

	@extend_schema(
		summary="Current user",
		description="Return details for the authenticated user.",
		responses=UserSerializer,
		examples=[
			OpenApiExample(
				"Me example",
				value={
					"id": 1,
					"username": "juan",
					"email": "juan@example.com",
					"name": "Juan",
					"max_daily_hours": 8,
					"date_joined": "2024-01-01T00:00:00Z",
				},
				response_only=True,
			)
		],
	)
	def get(self, request):
		serializer = UserSerializer(request.user)
		return Response(serializer.data)


class ActivityViewSet(viewsets.ModelViewSet):
	"""
	Activities endpoints (authenticated user only).

	- GET /activities/ -> list activities (example abridged)

		[
			{
				"id": 1,
				"title": "Study",
				"description": "...",
				"estimated_hours": 2,
				"course_name": "Math",
				"user": 1,
			}
		]

	- POST /activities/ -> create activity

		Request example:
		{
			"title": "Study",
			"description": "Read chapters",
			"estimated_hours": 2,
			"course_name": "Math",
		}

	- GET /activities/{id}/ -> retrieve activity

	- PATCH /activities/{id}/ -> partial update

		Request example: {"title": "Study session", "estimated_hours": 3}

	- DELETE /activities/{id}/ -> delete activity

		Response: 204 No Content

	"""

	serializer_class = ActivitySerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Activity.objects.filter(user=self.request.user)

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)

	@extend_schema(
		summary="Create activity",
		description="Create a new activity for the authenticated user.",
		request=ActivitySerializer,
		responses={201: ActivitySerializer},
		examples=[
			OpenApiExample(
				"Create request",
				value={
					"title": "Study",
					"description": "Read chapters",
					"estimated_hours": 2,
					"course_name": "Math",
				},
				request_only=True,
			),
			OpenApiExample(
				"Create response",
				value={
					"id": 1,
					"title": "Study",
					"description": "Read chapters",
					"estimated_hours": 2,
					"course_name": "Math",
					"user": 1,
				},
				response_only=True,
			),
		],
	)
	def create(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=422)

		self.perform_create(serializer)
		headers = self.get_success_headers(serializer.data)
		return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

	@extend_schema(
		summary="Delete activity",
		description="Delete an activity owned by the authenticated user.",
		responses={204: None},
		parameters=[
			OpenApiParameter(
				"id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
		],
	)
	def destroy(self, request, *args, **kwargs):
		try:
			activity = self.get_object()
			activity.delete()
			return Response(status=status.HTTP_204_NO_CONTENT)

		except Http404 as err:
			raise NotFound("There is no activity with such id") from err

		except Exception:
			logger.exception("Unexpected error deleting activity")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)

	@extend_schema(
		summary="Partial update activity",
		description="Partially update fields of an activity.",
		request=ActivitySerializer,
		responses={201: ActivitySerializer},
		parameters=[
			OpenApiParameter(
				"id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
		],
		examples=[
			OpenApiExample(
				"Patch request",
				value={"title": "Study session", "estimated_hours": 3},
				request_only=True,
			),
			OpenApiExample(
				"Patch response",
				value={
					"id": 1,
					"title": "Study session",
					"description": "Read chapters",
					"estimated_hours": 3,
					"course_name": "Math",
					"user": 1,
				},
				response_only=True,
			),
		],
	)
	def partial_update(self, request, *args, **kwargs):
		try:
			activity = self.get_object()
		except Http404 as err:
			raise NotFound(
				detail={"errors": {"resource": "There is no activity with such id"}}
			) from err

		serializer = self.get_serializer(
			activity,
			data=request.data,
			partial=True,  # 🔑 PATCH behavior
		)

		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		serializer.save()
		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@extend_schema(
		summary="List activities",
		description="Return a list of activities for the authenticated user.",
		responses=ActivitySerializer(many=True),
		examples=[
			OpenApiExample(
				"List example",
				value=[
					{
						"id": 1,
						"title": "Study",
						"description": "Read chapters",
						"estimated_hours": 2,
						"course_name": "Math",
						"user": 1,
					}
				],
				response_only=True,
			),
		],
	)
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@extend_schema(
		summary="Update activity",
		description="Replace an activity's fields (PUT).",
		request=ActivitySerializer,
		responses=ActivitySerializer,
		parameters=[
			OpenApiParameter(
				"id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
		],
		examples=[
			OpenApiExample(
				"Update request",
				value={
					"title": "Study full",
					"description": "Full replace",
					"estimated_hours": 4,
					"course_name": "Math",
				},
				request_only=True,
			),
			OpenApiExample(
				"Update response",
				value={
					"id": 1,
					"title": "Study full",
					"description": "Full replace",
					"estimated_hours": 4,
					"course_name": "Math",
					"user": 1,
				},
				response_only=True,
			),
		],
	)
	def update(self, request, *args, **kwargs):
		return super().update(request, *args, **kwargs)

	@extend_schema(
		summary="Retrieve activity",
		description="Get a single activity by id.",
		responses=ActivitySerializer,
		parameters=[
			OpenApiParameter(
				"id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
		],
		examples=[
			OpenApiExample(
				"Retrieve example",
				value={
					"id": 1,
					"title": "Study",
					"description": "Read chapters",
					"estimated_hours": 2,
					"course_name": "Math",
					"user": 1,
				},
				response_only=True,
			),
		],
	)
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)


class SubtaskViewSet(viewsets.ModelViewSet):
	serializer_class = SubtaskSerializer
	permission_classes = [IsAuthenticated]

	def get_activity(self):
		try:
			return Activity.objects.get(
				id=self.kwargs["activity_id"],
				user=self.request.user,
			)
		except Activity.DoesNotExist as err:
			raise NotFound(detail="There is no activity with the given id") from err

	def get_queryset(self):
		activity = self.get_activity()
		return Subtask.objects.filter(activity_id=activity).order_by("ordering")

	def get_serializer_context(self):
		context = super().get_serializer_context()
		context["activity"] = self.get_activity()
		return context

	@extend_schema(
		summary="List subtasks",
		description="List subtasks for a given activity id.",
		responses=SubtaskSerializer(many=True),
		parameters=[
			OpenApiParameter(
				"activity_id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
		],
		examples=[
			OpenApiExample(
				"List subtasks example",
				value=[
					{
						"id": 1,
						"name": "Do exercises",
						"estimated_hours": 2,
						"target_date": "2026-03-01",
						"status": "pending",
						"ordering": 1,
					}
				],
				response_only=True,
			),
		],
	)
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@extend_schema(
		summary="Create subtask",
		description="Create a subtask for the specified activity",
		request=SubtaskSerializer,
		responses={201: SubtaskSerializer},
		parameters=[
			OpenApiParameter(
				"activity_id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
		],
		examples=[
			OpenApiExample(
				"Create subtask request",
				value={
					"name": "Do exercises",
					"estimated_hours": 2,
					"target_date": "2026-03-01",
					"status": "pending",
				},
				request_only=True,
			),
			OpenApiExample(
				"Create subtask response",
				value={
					"id": 1,
					"name": "Do exercises",
					"estimated_hours": 2,
					"target_date": "2026-03-01",
					"status": "pending",
					"ordering": 1,
				},
				response_only=True,
			),
		],
	)
	def create(self, request, *args, **kwargs):
		activity = self.get_activity()
		serializer = self.get_serializer(data=request.data)

		try:
			serializer.is_valid(raise_exception=True)
			serializer.save(activity_id=activity)
			return Response(serializer.data, status=status.HTTP_201_CREATED)

		except ValidationError as err:
			logger.warning("Subtask validation error", extra={"errors": err.detail})
			return Response(err.detail, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		except Exception:
			logger.exception("Unexpected error creating subtask")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)

	@extend_schema(
		summary="Delete subtask",
		description="Delete a subtask of the given activity.",
		responses={204: None},
		parameters=[
			OpenApiParameter(
				"activity_id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
			OpenApiParameter(
				"subtask_id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Subtask id",
			),
		],
	)
	def destroy(self, request, activity_id=None, subtask_id=None):
		activity = self.get_activity()

		try:
			subtask = Subtask.objects.get(
				id=subtask_id,
				activity_id=activity,  # ✅ FIXED
			)
		except Subtask.DoesNotExist as err:
			raise NotFound(
				detail={
					"errors": {"resource": "There is no subtask with such id for this activity"}
				}
			) from err

		subtask.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

	@extend_schema(
		summary="Partial update subtask",
		description="Partially update a subtask's fields.",
		request=SubtaskSerializer,
		responses={201: SubtaskSerializer},
		parameters=[
			OpenApiParameter(
				"activity_id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Activity id",
			),
			OpenApiParameter(
				"subtask_id",
				OpenApiTypes.INT,
				OpenApiParameter.PATH,
				description="Subtask id",
			),
		],
	)
	def partial_update(self, request, activity_id=None, subtask_id=None):
		activity = self.get_activity()

		try:
			subtask = Subtask.objects.get(
				id=subtask_id,
				activity_id=activity,
			)
		except Subtask.DoesNotExist as err:
			raise NotFound(
				detail={
					"errors": {"resource": "There is no subtask with such id for this activity"}
				}
			) from err

		serializer = self.get_serializer(subtask, data=request.data, partial=True)
		try:
			serializer.is_valid(raise_exception=True)
			serializer.save()
			return Response(serializer.data, status=status.HTTP_201_CREATED)
		except ValidationError as e:
			logger.warning("Subtask validation error on PATCH", extra={"errors": e.detail})
			return Response(e.detail, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
		except Exception:
			logger.exception("Unexpected error updating subtask")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)


class TodayView(APIView):
	permission_classes = [IsAuthenticated]

	@extend_schema(
		summary="Today view",
		description=("Return overdue, today and upcoming subtasks. Optional query param `n_days`."),
		responses=OpenApiTypes.OBJECT,
		examples=[
			OpenApiExample(
				"Today example",
				value={
					"overdue": [],
					"today": [],
					"upcoming": [],
					"meta": {"n_days": 7},
				},
				response_only=True,
			),
		],
	)
	def get(self, request):
		try:
			n_days_param = request.query_params.get("n_days")

			if n_days_param is None:
				n_days = 7
			else:
				try:
					n_days = int(n_days_param)
					if n_days < 0:
						raise ValueError
				except ValueError as err:
					raise ValidationError(
						{"errors": {"n_days": "Must be a non-negative integer."}}
					) from err

			today = timezone.localdate()
			upcoming_limit = today + timedelta(days=n_days)

			subtasks = Subtask.objects.filter(activity_id__user=request.user).select_related(
				"activity_id"
			)

			overdue = []
			today_tasks = []
			upcoming = []

			for subtask in subtasks:
				if subtask.target_date < today:
					overdue.append(subtask)
				elif subtask.target_date == today:
					today_tasks.append(subtask)
				elif today < subtask.target_date <= upcoming_limit:
					upcoming.append(subtask)

			overdue.sort(key=lambda s: (s.target_date, s.estimated_hours))
			today_tasks.sort(key=lambda s: (s.estimated_hours,))
			upcoming.sort(key=lambda s: (s.target_date, s.estimated_hours))

			return Response(
				{
					"overdue": SubtaskSerializer(overdue, many=True).data,
					"today": SubtaskSerializer(today_tasks, many=True).data,
					"upcoming": SubtaskSerializer(upcoming, many=True).data,
					"meta": {"n_days": n_days},
				}
			)

		except ValidationError:
			raise

		except Exception:
			logger.exception("Unexpected error generating today view")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)
