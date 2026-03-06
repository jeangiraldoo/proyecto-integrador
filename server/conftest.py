from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
	"""Unauthenticated API client."""
	return APIClient()


@pytest.fixture
def user(db):
	"""A plain test user."""
	return User.objects.create_user(
		username="testuser",
		password="testpass123",
		email="test@example.com",
		name="Test User",
		max_daily_hours=8,
	)


@pytest.fixture
def other_user(db):
	"""A second user, used to verify data isolation between users."""
	return User.objects.create_user(
		username="otheruser",
		password="otherpass123",
		email="other@example.com",
		name="Other User",
	)


@pytest.fixture
def auth_client(api_client, user):
	"""API client authenticated as `user`."""
	refresh = RefreshToken.for_user(user)
	api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
	return api_client


@pytest.fixture
def other_auth_client(other_user):
	"""API client authenticated as `other_user`."""
	client = APIClient()
	refresh = RefreshToken.for_user(other_user)
	client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
	return client


@pytest.fixture
def activity(db, user):
	"""A single Activity owned by `user`."""
	from planner.models import Activity

	return Activity.objects.create(
		user=user,
		title="Test Activity",
		course_name="Math",
		description="A test activity",
		due_date=date.today() + timedelta(days=10),
		status="pending",
	)


@pytest.fixture
def subtask(db, activity):
	"""A single Subtask belonging to `activity`."""
	from planner.models import Subtask

	return Subtask.objects.create(
		activity_id=activity,
		name="Test Subtask",
		estimated_hours=2,
		target_date=date.today() + timedelta(days=5),
		status="pending",
		ordering=1,
	)
