from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from planner.models import Activity, Subtask

User = get_user_model()

TODAY = date.today()
YESTERDAY = TODAY - timedelta(days=1)
TWO_DAYS_AGO = TODAY - timedelta(days=2)
TOMORROW = TODAY + timedelta(days=1)
IN_THREE_DAYS = TODAY + timedelta(days=3)


@pytest.fixture
def api_client():
	return APIClient()


@pytest.fixture
def user(db):
	return User.objects.create_user(
		username="todayuser",
		password="testpass",
		email="today@example.com",
		name="Today User",
	)


@pytest.fixture
def auth_client(api_client, user):
	api_client.force_authenticate(user=user)
	return api_client


@pytest.fixture
def activity(db, user):
	# due_date far in the future so subtask target_dates never exceed it
	return Activity.objects.create(
		user=user,
		title="Test Activity",
		course_name="Test Course",
		description="",
		due_date=TODAY + timedelta(days=60),
		status="pending",
	)


def make_subtask(activity, name, target_date, estimated_hours, ordering=1):
	"""Helper to create subtasks without repeating boilerplate."""
	return Subtask.objects.create(
		activity_id=activity,
		name=name,
		estimated_hours=estimated_hours,
		target_date=target_date,
		status="pending",
		ordering=ordering,
	)


# ── Group ordering (overdue → today → upcoming) ───────────────────────────────


@pytest.mark.django_db
class TestTodayResponseStructure:
	def test_response_has_all_groups(self, auth_client):
		response = auth_client.get("/today/")

		assert response.status_code == 200
		assert "overdue" in response.data
		assert "today" in response.data
		assert "upcoming" in response.data
		assert "meta" in response.data

	def test_subtask_with_past_date_appears_in_overdue(self, auth_client, activity):
		make_subtask(activity, "Overdue task", YESTERDAY, 2)

		response = auth_client.get("/today/")

		names = [s["name"] for s in response.data["overdue"]]
		assert "Overdue task" in names
		assert len(response.data["today"]) == 0
		assert len(response.data["upcoming"]) == 0

	def test_subtask_with_today_date_appears_in_today(self, auth_client, activity):
		make_subtask(activity, "Today task", TODAY, 2)

		response = auth_client.get("/today/")

		names = [s["name"] for s in response.data["today"]]
		assert "Today task" in names
		assert len(response.data["overdue"]) == 0
		assert len(response.data["upcoming"]) == 0

	def test_subtask_with_future_date_appears_in_upcoming(self, auth_client, activity):
		make_subtask(activity, "Upcoming task", TOMORROW, 2)

		response = auth_client.get("/today/")

		names = [s["name"] for s in response.data["upcoming"]]
		assert "Upcoming task" in names
		assert len(response.data["overdue"]) == 0
		assert len(response.data["today"]) == 0


@pytest.mark.django_db
class TestOverdueOrdering:
	def test_oldest_date_appears_first(self, auth_client, activity):
		make_subtask(activity, "Less overdue", YESTERDAY, 2, ordering=1)
		make_subtask(activity, "More overdue", TWO_DAYS_AGO, 2, ordering=2)

		response = auth_client.get("/today/")

		overdue = response.data["overdue"]
		assert len(overdue) == 2
		assert overdue[0]["name"] == "More overdue"  # TWO_DAYS_AGO comes first
		assert overdue[1]["name"] == "Less overdue"  # YESTERDAY comes second

	def test_overdue_tiebreak_by_estimated_hours(self, auth_client, activity):
		"""Same date → fewer estimated hours appears first."""
		make_subtask(activity, "Heavy overdue", YESTERDAY, 5, ordering=1)
		make_subtask(activity, "Light overdue", YESTERDAY, 1, ordering=2)

		response = auth_client.get("/today/")

		overdue = response.data["overdue"]
		assert len(overdue) == 2
		assert overdue[0]["name"] == "Light overdue"  # 1h before 5h
		assert overdue[1]["name"] == "Heavy overdue"


@pytest.mark.django_db
class TestUpcomingOrdering:
	def test_nearest_date_appears_first(self, auth_client, activity):
		make_subtask(activity, "Further upcoming", IN_THREE_DAYS, 2, ordering=1)
		make_subtask(activity, "Closer upcoming", TOMORROW, 2, ordering=2)

		response = auth_client.get("/today/")

		upcoming = response.data["upcoming"]
		assert len(upcoming) == 2
		assert upcoming[0]["name"] == "Closer upcoming"  # TOMORROW comes first
		assert upcoming[1]["name"] == "Further upcoming"  # IN_THREE_DAYS comes second

	def test_upcoming_tiebreak_by_estimated_hours(self, auth_client, activity):
		"""Same date → fewer estimated hours appears first."""
		make_subtask(activity, "Heavy upcoming", TOMORROW, 4, ordering=1)
		make_subtask(activity, "Light upcoming", TOMORROW, 1, ordering=2)

		response = auth_client.get("/today/")

		upcoming = response.data["upcoming"]
		assert len(upcoming) == 2
		assert upcoming[0]["name"] == "Light upcoming"  # 1h before 4h
		assert upcoming[1]["name"] == "Heavy upcoming"


@pytest.mark.django_db
class TestTodayOrdering:
	def test_today_tiebreak_by_estimated_hours(self, auth_client, activity):
		"""Today group has no date variance — tiebreak is purely by hours."""
		make_subtask(activity, "Heavy today", TODAY, 6, ordering=1)
		make_subtask(activity, "Light today", TODAY, 2, ordering=2)

		response = auth_client.get("/today/")

		today = response.data["today"]
		assert len(today) == 2
		assert today[0]["name"] == "Light today"  # 2h before 6h
		assert today[1]["name"] == "Heavy today"


@pytest.mark.django_db
class TestTodayMeta:
	def test_default_n_days_is_7(self, auth_client):
		response = auth_client.get("/today/")

		assert response.data["meta"]["n_days"] == 7

	def test_custom_n_days_is_respected(self, auth_client):
		response = auth_client.get("/today/?n_days=3")

		assert response.data["meta"]["n_days"] == 3

	def test_subtask_beyond_n_days_not_in_upcoming(self, auth_client, activity):
		"""A subtask 10 days out should not appear when n_days=3."""
		make_subtask(activity, "Far future", TODAY + timedelta(days=10), 2)

		response = auth_client.get("/today/?n_days=3")

		names = [s["name"] for s in response.data["upcoming"]]
		assert "Far future" not in names
