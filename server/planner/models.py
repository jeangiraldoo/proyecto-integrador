from django.db import models
from django.contrib.auth.models import AbstractUser
from datetime import datetime


class User(AbstractUser):
	max_daily_hours = models.PositiveIntegerField(default=8)
	name = models.CharField(max_length=100)


class Activity(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activities")
	title = models.CharField(max_length=200)
	description = models.TextField()
	due_date = models.DateField()
	status = models.CharField(max_length=50)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return self.title


class Subtask(models.Model):
	activity_id = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="subtasks")
	name = models.CharField(max_length=200)
	estimated_hours = models.PositiveIntegerField()
	target_date = models.DateField()
	status = models.CharField(max_length=50)
	ordering = models.PositiveIntegerField()
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return self.name


class Progress(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="progress_entries")
	activity = models.ForeignKey(
		Activity, on_delete=models.CASCADE, related_name="progress_entries"
	)
	subtask = models.ForeignKey(Subtask, on_delete=models.CASCADE, related_name="progress_entries")
	status = models.CharField(max_length=50)
	note = models.TextField()
	recorded_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"Progress {self.id}"


class Conflict(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conflicts")
	affected_date = models.DateField()
	type = models.CharField(max_length=100)
	planned_hours = models.PositiveIntegerField()
	max_allowed_hours = models.PositiveIntegerField()
	status = models.CharField(max_length=50)
	detected_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"Conflict {self.id} ({self.type})"


class ConflictResolution(models.Model):
	conflict = models.OneToOneField(Conflict, on_delete=models.CASCADE, related_name="resolution")
	action = models.CharField(max_length=100)
	description = models.TextField()
	resolved_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"Resolution for conflict {self.conflict.id}"
