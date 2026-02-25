from .models import Activity
from rest_framework import serializers
from datetime import date


class ActivitySerializer(serializers.ModelSerializer):
	class Meta:
		model = Activity
		fields = ["id", "user", "title", "description", "due_date", "status"]
		read_only_fields = ["id", "user"]

	def validate(self, attrs):
		errors = {}

		title = attrs.get("title", "").strip()
		if not title:
			errors["title"] = "Title is required"

		status = attrs.get("status")
		allowed_statuses = ["pending", "completed", "in_progress"]
		if status not in allowed_statuses:
			errors["status"] = f"Invalid status type. Must be one of: {allowed_statuses}"

		due_date = attrs.get("due_date")
		if due_date is None:
			errors["due_date"] = "Due date is required"
		elif due_date < date.today():
			errors["due_date"] = "Due date cannot be earlier than today"

		if errors:
			raise serializers.ValidationError({"errors": errors})

		return attrs
