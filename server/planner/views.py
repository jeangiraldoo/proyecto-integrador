import logging
from datetime import timedelta

from django.http import Http404
from django.utils import timezone
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
def health_check():
	return Response({"status": "ok"})


class MeView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		serializer = UserSerializer(request.user)
		return Response(serializer.data)


class ActivityViewSet(viewsets.ModelViewSet):
	serializer_class = ActivitySerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Activity.objects.filter(user=self.request.user)

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)

	def create(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		if not serializer.is_valid():
			return Response(serializer.errors, status=422)

		self.perform_create(serializer)
		headers = self.get_success_headers(serializer.data)
		return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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
