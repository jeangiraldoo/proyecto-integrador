"""
Tests for the auto-reset behaviour when rescheduling a postponed subtask.

Business rule: when a PATCH request provides a new target_date for a subtask
whose current status is "postponed", the backend silently resets the status
to "pending" and records that transition in the Progress history.
"""

from typing import Any, cast

import pytest
from django.urls import reverse
from rest_framework import status

from planner.models import Activity, Progress, Subject, Subtask

# Helpers


def _make_activity(user):
	subject = Subject.objects.create(name="Test Subject")
	return Activity.objects.create(
		user=user,
		subject=subject,
		title="Test Activity",
		course_name="Test Course",
		description="desc",
		due_date="2099-12-31",
		status="pending",
	)


def _make_subtask(activity, *, name="Task", target_date="2099-06-01", subtask_status="pending"):
	count = Subtask.objects.filter(activity_id=activity).count()
	return Subtask.objects.create(
		activity_id=activity,
		name=name,
		estimated_hours=2,
		target_date=target_date,
		status=subtask_status,
		ordering=count + 1,
	)


def _subtask_url(activity_id, subtask_id):
	return reverse(
		"activity-subtask-detail",
		kwargs={"activity_id": activity_id, "subtask_id": subtask_id},
	)


def _model_id(instance: object) -> int:
	return cast(int, cast(Any, instance).id)


# Tests


@pytest.mark.django_db
class TestPostponedSubtaskReschedule:
	def test_rescheduling_postponed_resets_status_to_pending(self, auth_client, user):
		activity = _make_activity(user)
		subtask = _make_subtask(activity, subtask_status="postponed")
		url = _subtask_url(_model_id(activity), _model_id(subtask))

		res = auth_client.patch(url, {"target_date": "2099-07-01"}, format="json")

		assert res.status_code == status.HTTP_200_OK
		assert res.data["status"] == "pending"
		subtask.refresh_from_db()
		assert subtask.status == "pending"

	def test_rescheduling_postponed_records_progress_as_pending(self, auth_client, user):
		activity = _make_activity(user)
		subtask = _make_subtask(activity, subtask_status="postponed")
		url = _subtask_url(_model_id(activity), _model_id(subtask))

		auth_client.patch(url, {"target_date": "2099-07-01"}, format="json")

		entry = Progress.objects.filter(subtask=subtask).latest("recorded_at")
		assert entry.status == "pending"

	def test_rescheduling_non_postponed_does_not_change_status(self, auth_client, user):
		"""Only postponed subtasks are auto-reset; other statuses are preserved."""
		activity = _make_activity(user)
		subtask = _make_subtask(activity, subtask_status="in_progress")
		url = _subtask_url(_model_id(activity), _model_id(subtask))

		res = auth_client.patch(url, {"target_date": "2099-07-01"}, format="json")

		assert res.status_code == status.HTTP_200_OK
		assert res.data["status"] == "in_progress"

	def test_patching_postponed_without_target_date_keeps_status(self, auth_client, user):
		"""Updating fields other than target_date on a postponed subtask leaves it postponed."""
		activity = _make_activity(user)
		subtask = _make_subtask(activity, subtask_status="postponed")
		url = _subtask_url(_model_id(activity), _model_id(subtask))

		res = auth_client.patch(url, {"estimated_hours": 3}, format="json")

		assert res.status_code == status.HTTP_200_OK
		assert res.data["status"] == "postponed"
