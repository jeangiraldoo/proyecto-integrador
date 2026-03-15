"""
Functional tests for the GET /today/ endpoint.

Covers:
- Authentication enforcement
- Data isolation between users
- Grouping into overdue / today / upcoming
- Ordering within each group
- n_days query parameter handling
- Empty-list responses
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from planner.models import Activity, Subtask


TODAY_URL = reverse("today")


# ──────────────────────────────────────────────
#  Helper
# ──────────────────────────────────────────────


def _create_activity(user, *, title="Activity", due_date=None):
	"""Shortcut to create an Activity for a given user."""
	if due_date is None:
		due_date = timezone.localdate() + timedelta(days=30)
	return Activity.objects.create(
		user=user,
		title=title,
		course_name="Course",
		description="desc",
		due_date=due_date,
		status="pending",
	)


def _create_subtask(activity, *, name="Subtask", target_date=None, estimated_hours=1, ordering=1):
	"""Shortcut to create a Subtask linked to an Activity."""
	if target_date is None:
		target_date = timezone.localdate()
	return Subtask.objects.create(
		activity_id=activity,
		name=name,
		estimated_hours=estimated_hours,
		target_date=target_date,
		status="pending",
		ordering=ordering,
	)


# ──────────────────────────────────────────────
#  1. Authentication
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayAuthentication:
	"""Unauthenticated requests must be rejected."""

	def test_returns_401_for_unauthenticated_request(self, unauth_client):
		response = unauth_client.get(TODAY_URL)
		assert response.status_code == 401


# ──────────────────────────────────────────────
#  2. Data isolation between users
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayDataIsolation:
	"""Authenticated users must only see their own subtasks."""

	def test_does_not_return_other_users_subtasks(self, auth_client, user, other_user):
		today = timezone.localdate()

		# subtask belonging to the authenticated user
		act_mine = _create_activity(user)
		_create_subtask(act_mine, name="Mine", target_date=today)

		# subtask belonging to another user
		act_other = _create_activity(other_user, title="Other activity")
		_create_subtask(act_other, name="Not mine", target_date=today)

		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		all_names = [
			s["name"]
			for group in ("overdue", "today", "upcoming")
			for s in response.data[group]
		]
		assert "Mine" in all_names
		assert "Not mine" not in all_names


# ──────────────────────────────────────────────
#  3. Grouping logic (overdue / today / upcoming)
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayGrouping:
	"""Subtasks are grouped correctly based on their target_date."""

	def test_subtask_with_past_target_date_is_overdue(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="Late", target_date=timezone.localdate() - timedelta(days=2))

		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		overdue_names = [s["name"] for s in response.data["overdue"]]
		assert "Late" in overdue_names
		assert all(s["name"] != "Late" for s in response.data["today"])
		assert all(s["name"] != "Late" for s in response.data["upcoming"])

	def test_subtask_with_today_target_date_is_in_today(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="Now", target_date=timezone.localdate())

		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		today_names = [s["name"] for s in response.data["today"]]
		assert "Now" in today_names
		assert all(s["name"] != "Now" for s in response.data["overdue"])
		assert all(s["name"] != "Now" for s in response.data["upcoming"])

	def test_subtask_with_future_target_date_within_n_days_is_upcoming(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="Soon", target_date=timezone.localdate() + timedelta(days=3))

		response = auth_client.get(TODAY_URL)  # default n_days=7

		assert response.status_code == 200
		upcoming_names = [s["name"] for s in response.data["upcoming"]]
		assert "Soon" in upcoming_names

	def test_subtask_beyond_n_days_is_excluded(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="Far away", target_date=timezone.localdate() + timedelta(days=30))

		response = auth_client.get(TODAY_URL)  # default n_days=7

		assert response.status_code == 200
		all_names = [
			s["name"]
			for group in ("overdue", "today", "upcoming")
			for s in response.data[group]
		]
		assert "Far away" not in all_names

	def test_all_three_groups_populated(self, auth_client, user):
		"""When subtasks span past, today, and future, all three groups appear."""
		today = timezone.localdate()
		act = _create_activity(user)

		_create_subtask(act, name="Old", target_date=today - timedelta(days=1), ordering=1)
		_create_subtask(act, name="Current", target_date=today, ordering=2)
		_create_subtask(act, name="Future", target_date=today + timedelta(days=2), ordering=3)

		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		assert len(response.data["overdue"]) >= 1
		assert len(response.data["today"]) >= 1
		assert len(response.data["upcoming"]) >= 1


# ──────────────────────────────────────────────
#  4. Ordering within groups
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayOrdering:
	"""Subtasks within each group follow the specified ordering rules."""

	def test_overdue_sorted_by_target_date_then_estimated_hours(self, auth_client, user):
		today = timezone.localdate()
		act = _create_activity(user)

		# Same date, different hours  ⇒  lower hours first
		_create_subtask(
			act, name="B", target_date=today - timedelta(days=2), estimated_hours=5, ordering=1
		)
		_create_subtask(
			act, name="A", target_date=today - timedelta(days=2), estimated_hours=1, ordering=2
		)
		# Earlier date  ⇒  appears first regardless of hours
		_create_subtask(
			act, name="C", target_date=today - timedelta(days=5), estimated_hours=10, ordering=3
		)

		response = auth_client.get(TODAY_URL)
		names = [s["name"] for s in response.data["overdue"]]

		# C first (oldest date), then A before B (same date, lower hours first)
		assert names == ["C", "A", "B"]

	def test_today_sorted_by_estimated_hours(self, auth_client, user):
		today = timezone.localdate()
		act = _create_activity(user)

		_create_subtask(act, name="Heavy", target_date=today, estimated_hours=8, ordering=1)
		_create_subtask(act, name="Light", target_date=today, estimated_hours=1, ordering=2)
		_create_subtask(act, name="Medium", target_date=today, estimated_hours=4, ordering=3)

		response = auth_client.get(TODAY_URL)
		names = [s["name"] for s in response.data["today"]]

		assert names == ["Light", "Medium", "Heavy"]

	def test_upcoming_sorted_by_target_date_then_estimated_hours(self, auth_client, user):
		today = timezone.localdate()
		act = _create_activity(user)

		_create_subtask(
			act, name="D3-H5", target_date=today + timedelta(days=3), estimated_hours=5, ordering=1
		)
		_create_subtask(
			act, name="D3-H1", target_date=today + timedelta(days=3), estimated_hours=1, ordering=2
		)
		_create_subtask(
			act, name="D1-H9", target_date=today + timedelta(days=1), estimated_hours=9, ordering=3
		)

		response = auth_client.get(TODAY_URL)
		names = [s["name"] for s in response.data["upcoming"]]

		# D1 first (earliest), then within D3: lowest hours first
		assert names == ["D1-H9", "D3-H1", "D3-H5"]


# ──────────────────────────────────────────────
#  5. Empty responses
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayEmptyResponse:
	"""Endpoint returns 200 with empty lists when there are no subtasks."""

	def test_returns_empty_lists_for_user_with_no_data(self, auth_client):
		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		assert response.data["overdue"] == []
		assert response.data["today"] == []
		assert response.data["upcoming"] == []

	def test_returns_empty_lists_for_user_with_activities_but_no_subtasks(
		self, auth_client, user
	):
		_create_activity(user)

		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		assert response.data["overdue"] == []
		assert response.data["today"] == []
		assert response.data["upcoming"] == []


# ──────────────────────────────────────────────
#  6. n_days query parameter
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayNDays:
	"""The optional n_days query param controls the upcoming window."""

	def test_custom_n_days_includes_subtasks_within_window(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="3-day", target_date=timezone.localdate() + timedelta(days=3))

		response = auth_client.get(TODAY_URL, {"n_days": 3})

		assert response.status_code == 200
		upcoming_names = [s["name"] for s in response.data["upcoming"]]
		assert "3-day" in upcoming_names

	def test_custom_n_days_excludes_subtasks_beyond_window(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="4-day", target_date=timezone.localdate() + timedelta(days=4))

		response = auth_client.get(TODAY_URL, {"n_days": 2})

		assert response.status_code == 200
		upcoming_names = [s["name"] for s in response.data["upcoming"]]
		assert "4-day" not in upcoming_names

	def test_n_days_zero_returns_no_upcoming(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="Tomorrow", target_date=timezone.localdate() + timedelta(days=1))

		response = auth_client.get(TODAY_URL, {"n_days": 0})

		assert response.status_code == 200
		assert response.data["upcoming"] == []
		assert response.data["meta"]["n_days"] == 0

	def test_negative_n_days_returns_422(self, auth_client):
		response = auth_client.get(TODAY_URL, {"n_days": -1})
		assert response.status_code == 422

	def test_non_integer_n_days_returns_422(self, auth_client):
		response = auth_client.get(TODAY_URL, {"n_days": "abc"})
		assert response.status_code == 422

	def test_default_n_days_is_7(self, auth_client):
		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		assert response.data["meta"]["n_days"] == 7


# ──────────────────────────────────────────────
#  7. Response structure
# ──────────────────────────────────────────────


@pytest.mark.django_db
class TestTodayResponseStructure:
	"""The response JSON has the expected shape."""

	def test_response_contains_required_keys(self, auth_client):
		response = auth_client.get(TODAY_URL)

		assert response.status_code == 200
		assert "overdue" in response.data
		assert "today" in response.data
		assert "upcoming" in response.data
		assert "meta" in response.data
		assert "n_days" in response.data["meta"]

	def test_subtask_fields_present(self, auth_client, user):
		act = _create_activity(user)
		_create_subtask(act, name="Check fields", target_date=timezone.localdate())

		response = auth_client.get(TODAY_URL)
		subtask = response.data["today"][0]

		expected_fields = {"id", "name", "estimated_hours", "target_date", "status", "ordering", "created_at", "updated_at"}
		assert expected_fields.issubset(set(subtask.keys()))
