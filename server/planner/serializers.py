from datetime import date

from rest_framework import serializers

from .models import Activity, Subtask, User


class UserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		# include readable name and the user's max daily hours
		fields = ["id", "username", "email", "name", "max_daily_hours", "date_joined"]


class SubtaskSerializer(serializers.ModelSerializer):
	name = serializers.CharField(required=True, allow_blank=True)
	status = serializers.CharField(required=False, allow_blank=True, default="pending")
	target_date = serializers.DateField(required=True)
	ordering = serializers.IntegerField(required=False, default=0)

	class Meta:
		model = Subtask
		fields = [
			"id",
			"name",
			"estimated_hours",
			"target_date",
			"status",
			"ordering",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["id", "created_at", "updated_at"]

	def validate(self, attrs):
		errors = {}

		if "name" in attrs:
			name = attrs["name"].strip()
			if not name:
				errors["name"] = "Name is required"

		if "status" in attrs:
			status = attrs["status"]
			allowed_statuses = ["pending", "completed", "in_progress"]
			if status not in allowed_statuses:
				errors["status"] = f"Invalid status type. Must be one of: {allowed_statuses}"

		if "target_date" in attrs:
			target_date = attrs["target_date"]
			if target_date < date.today():
				errors["target_date"] = "Target date cannot be earlier than today"

			activity = self.context.get("activity")
			if activity and target_date > activity.due_date:
				errors["target_date"] = (
					f"Target date cannot be later than the activity due date ({activity.due_date})"
				)

		if "estimated_hours" in attrs:
			estimated_hours = attrs["estimated_hours"]
			if estimated_hours < 0:
				errors["estimated_hours"] = "Estimated hours must be zero or a positive number"

		if errors:
			raise serializers.ValidationError({"errors": errors})

		return attrs


class ActivitySerializer(serializers.ModelSerializer):
	total_estimated_hours = serializers.SerializerMethodField()
	subtask_count = serializers.SerializerMethodField()
	subtasks = SubtaskSerializer(many=True, required=False)

	class Meta:
		model = Activity
		fields = [
			"id",
			"user",
			"title",
			"course_name",
			"description",
			"due_date",
			"status",
			"subtasks",
			"subtask_count",
			"total_estimated_hours",
		]
		read_only_fields = ["id", "user", "subtask_count", "total_estimated_hours"]

	def validate(self, attrs):
		errors = {}

		if "title" in attrs:
			title = attrs.get("title", "").strip()
			if not title:
				errors["title"] = "Title is required"

		if "course_name" in attrs:
			title = attrs.get("course_name", "").strip()
			if not title:
				errors["course_name"] = "Course name is required"

		if "status" in attrs:
			status = attrs.get("status")
			allowed_statuses = ["pending", "completed", "in_progress"]
			if status not in allowed_statuses:
				errors["status"] = f"Invalid status type. Must be one of: {allowed_statuses}"

		if "due_date" in attrs:
			due_date = attrs.get("due_date")
			if due_date < date.today():
				errors["due_date"] = "Due date cannot be earlier than today"

		if errors:
			raise serializers.ValidationError({"errors": errors})

		return attrs

	def get_total_estimated_hours(self, obj) -> int:
		# Sum estimated_hours across related subtasks. If there are no subtasks,
		# allow a client-provided hint (stored temporarily on the instance during create)
		if obj.subtasks.exists():
			return int(sum(s.estimated_hours for s in obj.subtasks.all()))
		# fallback to any client-provided value stored on the instance
		client_val = getattr(obj, "_client_total_estimated_hours", None)
		if client_val is not None:
			try:
				return int(client_val)
			except Exception:
				return 0
		return 0

	def get_subtask_count(self, obj) -> int:
		return obj.subtasks.count()

	def create(self, validated_data):
		# Handle nested subtasks if provided
		subtasks_data = validated_data.pop("subtasks", [])
		# capture any client-provided total_estimated_hours (not stored in DB)
		client_total = None
		try:
			# access raw input data available on the serializer
			client_total = self.initial_data.get("total_estimated_hours")
		except Exception:
			client_total = None
		# `user` may be supplied by the view via serializer.save(user=...)
		activity = Activity.objects.create(**validated_data)
		for idx, s in enumerate(subtasks_data, start=1):
			# ensure ordering if not provided
			ordering = s.get("ordering", idx)
			Subtask.objects.create(
				activity_id=activity,
				name=s.get("name", ""),
				estimated_hours=s.get("estimated_hours", 0) or 0,
				target_date=s.get("target_date"),
				status=s.get("status", "pending"),
				ordering=ordering,
			)
		# If no subtasks were created but the client provided a total, keep it
		# on the instance so the SerializerMethodField can return it in the response.
		if not subtasks_data and client_total is not None:
			try:
				activity._client_total_estimated_hours = int(client_total)
			except Exception:
				activity._client_total_estimated_hours = None
		return activity


# Note: a single SubtaskSerializer is defined above for nested use in ActivitySerializer.
