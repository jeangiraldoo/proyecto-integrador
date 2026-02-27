from datetime import date

from rest_framework import serializers
from .models import Activity, Subtask, User


class UserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ["id", "username", "email", "first_name", "last_name", "date_joined"]


class ActivitySerializer(serializers.ModelSerializer):
	class Meta:
		model = Activity
		fields = ["id", "user", "title", "description", "due_date", "status"]
		read_only_fields = ["id", "user"]

	def validate(self, attrs):
		errors = {}

		if "title" in attrs:
			title = attrs.get("title", "").strip()
			if not title:
				errors["title"] = "Title is required"

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


class SubtaskSerializer(serializers.ModelSerializer):
	name = serializers.CharField(required=True, allow_blank=True)
	status = serializers.CharField(required=True, allow_blank=True)
	target_date = serializers.DateField(required=True)

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
			if estimated_hours <= 0:
				errors["estimated_hours"] = "Estimated hours must be a positive number"

		if errors:
			raise serializers.ValidationError({"errors": errors})

		return attrs
