import logging
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import Http404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Activity, Conflict, Progress, Subject, Subtask, User
from .serializers import (
	ActivitySerializer,
	ConflictResolveSerializer,
	ConflictSerializer,
	SubjectSerializer,
	SubtaskSerializer,
	TodaySubtaskSerializer,
	UserRegistrationSerializer,
	UserSerializer,
	UserUpdateSerializer,
)

logger = logging.getLogger(__name__)


def _evaluate_day_conflicts(user, target_date: date) -> None:
	"""Create, update, or auto-resolve a Conflict for a given user/date after any subtask change."""
	total: int = int(
		Subtask.objects.filter(
			activity_id__user=user,
			target_date=target_date,
			status__in=["pending", "in_progress"],
		).aggregate(total=Sum("estimated_hours"))["total"]
		or 0
	)
	if total > user.max_daily_hours:
		conflict = Conflict.objects.filter(user=user, affected_date=target_date).first()
		if conflict:
			conflict.planned_hours = total
			conflict.max_allowed_hours = user.max_daily_hours
			conflict.status = "pending"
			conflict.save(update_fields=["planned_hours", "max_allowed_hours", "status"])
		else:
			Conflict.objects.create(
				user=user,
				affected_date=target_date,
				type="overload",
				planned_hours=total,
				max_allowed_hours=user.max_daily_hours,
				status="pending",
			)
	else:
		Conflict.objects.filter(user=user, affected_date=target_date, status="pending").update(
			status="resolved"
		)


@api_view(["GET"])
@extend_schema(
	summary="Health check",
	description="Return a simple status object confirming the API is reachable.",
	responses={200: OpenApiTypes.OBJECT},
	examples=[OpenApiExample("Health example", value={"status": "ok"}, response_only=True)],
)
def health_check():
	return Response({"status": "ok"})


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
	# Keep `username` optional for backward compatibility and accept `identifier` too.
	username = drf_serializers.CharField(required=False, allow_blank=True, write_only=True)
	identifier = drf_serializers.CharField(required=False, allow_blank=True, write_only=True)

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.fields[self.username_field].required = False
		self.fields[self.username_field].allow_blank = True

	def validate(self, attrs):
		raw_identifier = (attrs.get("identifier") or attrs.get("username") or "").strip()
		if not raw_identifier:
			raise ValidationError({"errors": {"identifier": "Username or email is required."}})

		attrs["username"] = raw_identifier
		if "@" in raw_identifier:
			user = User.objects.filter(email__iexact=raw_identifier).only("username").first()
			if user:
				attrs["username"] = user.username

		attrs.pop("identifier", None)
		return super().validate(attrs)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
	serializer_class = EmailOrUsernameTokenObtainPairSerializer


class RegisterView(APIView):
	permission_classes = [AllowAny]

	@extend_schema(
		summary="Register a new user",
		description="Create a new user account.",
		request=UserRegistrationSerializer,
		responses={201: UserSerializer},
	)
	def post(self, request):
		serializer = UserRegistrationSerializer(data=request.data)
		if serializer.is_valid():
			user = serializer.save()
			return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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

	@extend_schema(
		summary="Update current user",
		description="Partially update the authenticated user's profile (e.g. max_daily_hours).",
		request=UserUpdateSerializer,
		responses={200: UserSerializer},
		examples=[
			OpenApiExample(
				"Patch me request",
				value={"max_daily_hours": 8},
				request_only=True,
			),
		],
	)
	def patch(self, request):
		serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		old_max: int = request.user.max_daily_hours
		serializer.save()
		new_max: int = serializer.instance.max_daily_hours

		# When the daily cap changes, re-evaluate every date that has subtasks —
		# not just dates with pending conflicts, because a previously-resolved
		# conflict may need to become pending again if the cap was lowered.
		if old_max != new_max:
			affected_dates = list(
				Subtask.objects.filter(activity_id__user=request.user)
				.values_list("target_date", flat=True)
				.distinct()
			)
			for d in affected_dates:
				_evaluate_day_conflicts(request.user, d)

		return Response(UserSerializer(serializer.instance).data)


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
		return Activity.objects.filter(user=self.request.user).annotate(
			_total_subtasks=Count("subtasks"),
			_completed_subtasks=Count("subtasks", filter=Q(subtasks__status="completed")),
		)

	def perform_create(self, serializer):
		activity = serializer.save(user=self.request.user)
		affected_dates = list(activity.subtasks.values_list("target_date", flat=True).distinct())
		for affected_date in affected_dates:
			_evaluate_day_conflicts(self.request.user, affected_date)

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
			affected_dates = list(
				activity.subtasks.values_list("target_date", flat=True).distinct()
			)
			activity.delete()
			for affected_date in affected_dates:
				_evaluate_day_conflicts(request.user, affected_date)
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
		responses={200: ActivitySerializer},
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
			partial=True,  # PATCH behavior
		)

		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		serializer.save()
		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@extend_schema(
		summary="List activities",
		description=(
			"Return a list of activities for the authenticated user, including progress counters."
		),
		responses=ActivitySerializer(many=True),
		examples=[
			OpenApiExample(
				"List example",
				value=[
					{
						"id": 1,
						"title": "Study",
						"description": "Read chapters",
						"course_name": "Math",
						"user": 1,
						"completed_subtasks_count": 2,
						"total_subtasks_count": 5,
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
		description="Get a single activity by id, including progress counters.",
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
					"course_name": "Math",
					"user": 1,
					"completed_subtasks_count": 2,
					"total_subtasks_count": 5,
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
			_evaluate_day_conflicts(request.user, serializer.instance.target_date)
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

		target_date = subtask.target_date
		subtask.delete()
		_evaluate_day_conflicts(request.user, target_date)
		return Response(status=status.HTTP_204_NO_CONTENT)

	@extend_schema(
		summary="Retrieve subtask",
		description="Get a single subtask by id.",
		responses=SubtaskSerializer,
		parameters=[
			OpenApiParameter(
				"activity_id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Activity id"
			),
			OpenApiParameter(
				"subtask_id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Subtask id"
			),
		],
		examples=[
			OpenApiExample(
				"Retrieve subtask example",
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
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)

	@extend_schema(
		summary="Update subtask (full)",
		description="Fully replace a subtask's fields.",
		request=SubtaskSerializer,
		responses={200: SubtaskSerializer},
		parameters=[
			OpenApiParameter(
				"activity_id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Activity id"
			),
			OpenApiParameter(
				"subtask_id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Subtask id"
			),
		],
		examples=[
			OpenApiExample(
				"Update subtask request",
				value={
					"name": "Do exercises",
					"estimated_hours": 3,
					"target_date": "2026-03-05",
					"status": "in_progress",
				},
				request_only=True,
			),
		],
	)
	def update(self, request, *args, **kwargs):
		return super().update(request, *args, **kwargs)

	@extend_schema(
		summary="Partial update subtask",
		description=(
			"Partially update a subtask's fields and record a progress entry.\n\n"
			"All subtask fields are optional. Additionally accepts:\n"
			"- `note` *(string, optional)*: free-text note persisted in the Progress history.\n\n"
			"Valid values for `status`: `pending`, `in_progress`, `completed`, `postponed`.\n\n"
			"A Progress record is always created when this endpoint is called, "
			"preserving the status and note at the moment of the update."
		),
		request=inline_serializer(
			name="SubtaskProgressUpdate",
			fields={
				"name": drf_serializers.CharField(required=False),
				"estimated_hours": drf_serializers.IntegerField(required=False),
				"target_date": drf_serializers.DateField(required=False),
				"status": drf_serializers.ChoiceField(
					choices=["pending", "in_progress", "completed", "postponed"],
					required=False,
				),
				"ordering": drf_serializers.IntegerField(required=False),
				"note": drf_serializers.CharField(
					required=False,
					allow_blank=True,
					help_text="Optional note stored in the Progress history log.",
				),
			},
		),
		responses={200: SubtaskSerializer},
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
		examples=[
			OpenApiExample(
				"Record progress with note",
				value={"status": "postponed", "note": "Esperando al profesor"},
				request_only=True,
			),
			OpenApiExample(
				"Mark completed without note",
				value={"status": "completed"},
				request_only=True,
			),
			OpenApiExample(
				"Patch subtask response",
				value={
					"id": 1,
					"name": "Do exercises",
					"estimated_hours": 2,
					"target_date": "2026-03-01",
					"status": "postponed",
					"ordering": 1,
				},
				response_only=True,
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

		# Extract note before passing to SubtaskSerializer (Subtask has no note field)
		data = request.data.copy()
		raw_note = data.pop("note", "")
		# QueryDict.pop returns a list; plain dict returns the value directly
		if isinstance(raw_note, list):
			raw_note = raw_note[0] if raw_note else ""
		note: str = (raw_note or "").strip()

		old_date = subtask.target_date
		serializer = self.get_serializer(subtask, data=data, partial=True)
		try:
			serializer.is_valid(raise_exception=True)
			with transaction.atomic():
				serializer.save()
				Progress.objects.create(
					user=request.user,
					activity=subtask.activity_id,
					subtask=subtask,
					status=serializer.instance.status,
					note=note,
				)
			new_date: date = serializer.instance.target_date
			_evaluate_day_conflicts(request.user, new_date)
			if old_date != new_date:
				_evaluate_day_conflicts(request.user, old_date)
			return Response(serializer.data, status=status.HTTP_200_OK)
		except ValidationError as e:
			logger.warning("Subtask validation error on PATCH", extra={"errors": e.detail})
			return Response(e.detail, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
		except Exception:
			logger.exception("Unexpected error updating subtask")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)


_VALID_TODAY_STATUSES = frozenset({"vencidas", "hoy", "proximas"})


class TodayView(APIView):
	permission_classes = [IsAuthenticated]

	@staticmethod
	def _bad_request(field: str, message: str) -> Response:
		return Response({"errors": {field: message}}, status=status.HTTP_400_BAD_REQUEST)

	def _parse_today_filters(self, request):
		n_days_param = request.query_params.get("n_days")
		n_days = 7
		if n_days_param is not None:
			try:
				n_days = int(n_days_param)
				if n_days < 0:
					raise ValueError
			except ValueError:
				return self._bad_request("n_days", "Must be a non-negative integer.")

		course_id_param = request.query_params.get("courseId")
		course_id = None
		if course_id_param is not None:
			try:
				course_id = int(course_id_param)
				if course_id <= 0:
					raise ValueError
			except ValueError:
				return self._bad_request("courseId", "Must be a positive integer.")

		status_param = request.query_params.get("status")
		if status_param is not None and status_param not in _VALID_TODAY_STATUSES:
			return self._bad_request(
				"status",
				"Invalid value. Must be one of: " + ", ".join(sorted(_VALID_TODAY_STATUSES)),
			)

		return n_days, course_id, status_param

	@staticmethod
	def _build_today_buckets(qs, today, upcoming_limit, status_param):
		show_all = status_param is None
		overdue = (
			list(qs.filter(target_date__lt=today).order_by("target_date", "estimated_hours"))
			if show_all or status_param == "vencidas"
			else []
		)
		today_tasks = (
			list(qs.filter(target_date=today).order_by("estimated_hours"))
			if show_all or status_param == "hoy"
			else []
		)
		upcoming = (
			list(
				qs.filter(target_date__gt=today, target_date__lte=upcoming_limit).order_by(
					"target_date", "estimated_hours"
				)
			)
			if show_all or status_param == "proximas"
			else []
		)

		return overdue, today_tasks, upcoming

	@extend_schema(
		summary="Today view",
		description=(
			"Return overdue, today and upcoming subtasks for the authenticated user.\n\n"
			"Optional filters:\n"
			"- `n_days`: lookahead window for *proximas* (default 7, non-negative integer).\n"
			"- `courseId`: filter by subject/course ID (positive integer).\n"
			"- `status`: restrict to a single bucket — `vencidas`, `hoy`, or `proximas`.\n\n"
			"Ordering: overdue → oldest first; today → least hours first; upcoming → nearest first."
		),
		parameters=[
			OpenApiParameter(
				"n_days",
				OpenApiTypes.INT,
				OpenApiParameter.QUERY,
				required=False,
				description="Lookahead days for upcoming subtasks (default: 7).",
			),
			OpenApiParameter(
				"courseId",
				OpenApiTypes.INT,
				OpenApiParameter.QUERY,
				required=False,
				description="Filter subtasks to activities belonging to this subject/course ID.",
			),
			OpenApiParameter(
				"status",
				OpenApiTypes.STR,
				OpenApiParameter.QUERY,
				required=False,
				enum=["vencidas", "hoy", "proximas"],
				description=(
					"Return only one bucket: vencidas (overdue), hoy (today), proximas (upcoming)."
				),
			),
		],
		responses=OpenApiTypes.OBJECT,
		examples=[
			OpenApiExample(
				"All buckets",
				value={
					"overdue": [],
					"today": [],
					"upcoming": [],
					"meta": {"n_days": 7, "filters": {"courseId": None, "status": None}},
				},
				response_only=True,
			),
		],
	)
	def get(self, request):
		try:
			parsed_filters = self._parse_today_filters(request)
			if isinstance(parsed_filters, Response):
				return parsed_filters
			n_days, course_id, status_param = parsed_filters

			today = timezone.localdate()
			upcoming_limit = today + timedelta(days=n_days)

			# Base queryset — always scoped to the authenticated user
			qs = Subtask.objects.filter(activity_id__user=request.user).select_related(
				"activity_id"
			)

			# Apply courseId filter at DB level
			if course_id is not None:
				qs = qs.filter(activity_id__subject_id=course_id)

			overdue, today_tasks, upcoming = self._build_today_buckets(
				qs, today, upcoming_limit, status_param
			)

			return Response(
				{
					"overdue": TodaySubtaskSerializer(overdue, many=True).data,
					"today": TodaySubtaskSerializer(today_tasks, many=True).data,
					"upcoming": TodaySubtaskSerializer(upcoming, many=True).data,
					"meta": {
						"n_days": n_days,
						"filters": {
							"courseId": course_id,
							"status": status_param,
						},
					},
				}
			)

		except Exception:
			logger.exception("Unexpected error generating today view")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)


class SubjectViewSet(viewsets.ModelViewSet):
	"""
	CRUD Endpoints for Academic Subjects.
	"""

	serializer_class = SubjectSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Subject.objects.all().order_by("-creation_date")

	@extend_schema(
		summary="List subjects",
		description="Retrieve a list of all academic subjects.",
		responses=SubjectSerializer(many=True),
		examples=[
			OpenApiExample(
				"List subjects example",
				value=[
					{"id": 1, "name": "Cálculo III", "creation_date": "2026-01-01"},
					{"id": 2, "name": "Redes", "creation_date": "2026-01-02"},
				],
				response_only=True,
			)
		],
	)
	def list(self, request, *args, **kwargs):
		return super().list(request, *args, **kwargs)

	@extend_schema(
		summary="Retrieve subject",
		description="Get details of a specific subject by ID.",
		responses=SubjectSerializer,
		parameters=[
			OpenApiParameter(
				"id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Subject id"
			),
		],
		examples=[
			OpenApiExample(
				"Retrieve subject example",
				value={"id": 1, "name": "Cálculo III", "creation_date": "2026-01-01"},
				response_only=True,
			)
		],
	)
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)

	@extend_schema(
		summary="Create subject",
		description="Create a new academic subject.",
		request=SubjectSerializer,
		responses={201: SubjectSerializer},
		examples=[
			OpenApiExample(
				"Create subject request",
				value={"name": "Cálculo III"},
				request_only=True,
			),
			OpenApiExample(
				"Create subject response",
				value={"id": 1, "name": "Cálculo III", "creation_date": "2026-01-01"},
				response_only=True,
			),
		],
	)
	def create(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		serializer.save()
		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@extend_schema(
		summary="Update subject (full)",
		description="Fully replace a subject's name. Renames course_name on linked activities.",
		request=SubjectSerializer,
		responses={200: SubjectSerializer},
		parameters=[
			OpenApiParameter(
				"id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Subject id"
			),
		],
		examples=[
			OpenApiExample(
				"Update subject request",
				value={"name": "Álgebra Lineal"},
				request_only=True,
			),
			OpenApiExample(
				"Update subject response",
				value={"id": 1, "name": "Álgebra Lineal", "creation_date": "2026-01-01"},
				response_only=True,
			),
		],
	)
	def update(self, request, *args, **kwargs):
		try:
			subject = self.get_object()
		except Http404 as err:
			raise NotFound(detail={"errors": {"resource": "Subject not found"}}) from err

		old_name = subject.name
		serializer = self.get_serializer(subject, data=request.data, partial=False)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		serializer.save()
		new_name = serializer.data["name"]

		# Propagate rename to all activities that used this subject's name
		if old_name != new_name:
			Activity.objects.filter(course_name=old_name).update(course_name=new_name)
			Activity.objects.filter(subject=subject).update(course_name=new_name)

		return Response(serializer.data, status=status.HTTP_200_OK)

	@extend_schema(
		summary="Partial update subject",
		description="Partially update subject fields. Renames course_name on linked activities.",
		request=SubjectSerializer,
		responses={200: SubjectSerializer},
		parameters=[
			OpenApiParameter(
				"id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Subject id"
			),
		],
		examples=[
			OpenApiExample(
				"Patch subject request",
				value={"name": "Álgebra Lineal"},
				request_only=True,
			),
			OpenApiExample(
				"Patch subject response",
				value={"id": 1, "name": "Álgebra Lineal", "creation_date": "2026-01-01"},
				response_only=True,
			),
		],
	)
	def partial_update(self, request, *args, **kwargs):
		try:
			subject = self.get_object()
		except Http404 as err:
			raise NotFound(detail={"errors": {"resource": "Subject not found"}}) from err

		old_name = subject.name
		serializer = self.get_serializer(subject, data=request.data, partial=True)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		serializer.save()
		new_name = serializer.data["name"]

		# Propagate rename to all activities that used this subject's name
		if old_name != new_name:
			Activity.objects.filter(course_name=old_name).update(course_name=new_name)
			Activity.objects.filter(subject=subject).update(course_name=new_name)

		return Response(serializer.data, status=status.HTTP_200_OK)

	@extend_schema(
		summary="Delete subject",
		description="Delete a subject and all its activities and subtasks (cascade).",
		responses={204: None},
		parameters=[
			OpenApiParameter(
				"id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Subject id"
			),
		],
	)
	def destroy(self, request, *args, **kwargs):
		try:
			subject = self.get_object()
			affected_dates = list(
				Subtask.objects.filter(
					activity_id__course_name=subject.name, activity_id__user=request.user
				)
				.values_list("target_date", flat=True)
				.distinct()
			)
			affected_dates.extend(
				list(
					Subtask.objects.filter(
						activity_id__subject=subject, activity_id__user=request.user
					)
					.values_list("target_date", flat=True)
					.distinct()
				)
			)
			# Cascade: delete all activities matching by name or FK (subtasks cascade automatically)
			Activity.objects.filter(course_name=subject.name).delete()
			Activity.objects.filter(subject=subject).delete()
			subject.delete()
			for affected_date in set(affected_dates):
				_evaluate_day_conflicts(request.user, affected_date)
			return Response(status=status.HTTP_204_NO_CONTENT)
		except Http404 as err:
			raise NotFound(detail={"errors": {"resource": "Subject not found"}}) from err
		except Exception:
			logger.exception("Unexpected error deleting subject")
			return Response(
				{"errors": {"server": "Internal server error"}},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR,
			)


class ConflictViewSet(viewsets.ReadOnlyModelViewSet):
	"""
	Read-only endpoints for the authenticated user's pending overload conflicts.
	GET /conflicts/      → list all pending conflicts
	GET /conflicts/{id}/ → retrieve a single conflict
	"""

	serializer_class = ConflictSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Conflict.objects.filter(user=self.request.user, status="pending").order_by(
			"affected_date"
		)

	@extend_schema(
		summary="List conflicts",
		description=(
			"Return all pending overload conflicts for the authenticated user. "
			"Re-evaluates live state before responding."
		),
		responses=ConflictSerializer(many=True),
		examples=[
			OpenApiExample(
				"List conflicts example",
				value=[
					{
						"id": 1,
						"affected_date": "2026-03-11",
						"planned_hours": 10,
						"max_allowed_hours": 4,
						"status": "pending",
						"detected_at": "2026-03-10T12:00:00Z",
					}
				],
				response_only=True,
			)
		],
	)
	def list(self, request, *args, **kwargs):
		# Re-evaluate every date that has subtasks before returning, so the
		# response always reflects the current state (no stale resolved/pending).
		dates = list(
			Subtask.objects.filter(activity_id__user=request.user)
			.values_list("target_date", flat=True)
			.distinct()
		)
		for d in dates:
			_evaluate_day_conflicts(request.user, d)
		return super().list(request, *args, **kwargs)

	@extend_schema(
		summary="Retrieve conflict",
		description="Get a single conflict by id.",
		responses=ConflictSerializer,
		parameters=[
			OpenApiParameter(
				"id", OpenApiTypes.INT, OpenApiParameter.PATH, description="Conflict id"
			),
		],
	)
	def retrieve(self, request, *args, **kwargs):
		return super().retrieve(request, *args, **kwargs)

	@extend_schema(
		summary="Resolve conflict",
		description=(
			"Apply a resolution action to a pending conflict. "
			"Supported actions: 'reduce_hours' (requires new_hours) "
			"and 'reschedule' (requires new_date). "
			"Records the resolution in ConflictResolution and re-evaluates affected dates."
		),
		request=ConflictResolveSerializer,
		responses={200: ConflictSerializer},
		examples=[
			OpenApiExample(
				"Reduce hours",
				value={"subtask_id": 76, "action_type": "reduce_hours", "new_hours": 2},
				request_only=True,
			),
			OpenApiExample(
				"Reschedule",
				value={"subtask_id": 76, "action_type": "reschedule", "new_date": "2026-03-12"},
				request_only=True,
			),
		],
	)
	@action(detail=True, methods=["post"], url_path="resolve")
	def resolve(self, request, pk=None):
		conflict = self.get_object()

		if conflict.status == "resolved":
			return Response(
				{"errors": {"conflict": "This conflict is already resolved."}},
				status=status.HTTP_400_BAD_REQUEST,
			)

		serializer = ConflictResolveSerializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

		data = serializer.validated_data
		action_type: str = data["action_type"]
		subtask_id: int = data["subtask_id"]

		try:
			subtask = Subtask.objects.get(id=subtask_id, activity_id__user=request.user)
		except Subtask.DoesNotExist:
			return Response(
				{"errors": {"subtask_id": "Subtask not found or does not belong to you."}},
				status=status.HTTP_404_NOT_FOUND,
			)

		old_date: date = subtask.target_date

		with transaction.atomic():
			if action_type == "reduce_hours":
				subtask.estimated_hours = data["new_hours"]
				subtask.save(update_fields=["estimated_hours", "updated_at"])
				description = f"Reduced estimated hours to {data['new_hours']}h on {old_date}."
			else:  # reschedule
				new_date: date = data["new_date"]
				subtask.target_date = new_date
				subtask.save(update_fields=["target_date", "updated_at"])
				description = f"Rescheduled subtask from {old_date} to {new_date}."

			from .models import ConflictResolution

			# Always log what the user did, even if the conflict isn't fully resolved yet.
			ConflictResolution.objects.update_or_create(
				conflict=conflict,
				defaults={"action": action_type, "description": description},
			)

		# Re-evaluate the affected date(s). _evaluate_day_conflicts decides
		# whether to keep the conflict pending (still overloaded) or resolve it.
		_evaluate_day_conflicts(request.user, old_date)
		if action_type == "reschedule":
			_evaluate_day_conflicts(request.user, data["new_date"])

		# Return the conflict's current state so the frontend knows whether
		# it's fully resolved or still pending with updated planned_hours.
		conflict.refresh_from_db()
		return Response(ConflictSerializer(conflict).data, status=status.HTTP_200_OK)
