import pytest
from rest_framework.test import APIClient

from planner.models import User


@pytest.fixture
def user(db):
	"""Create and return a test user."""
	return User.objects.create_user(
		username="testuser",
		password="testpass123",
		name="Test User",
		email="test@example.com",
	)


@pytest.fixture
def other_user(db):
	"""Create and return a second user for data isolation tests."""
	return User.objects.create_user(
		username="otheruser",
		password="otherpass123",
		name="Other User",
		email="other@example.com",
	)


@pytest.fixture
def auth_client(user):
	"""Return an API client authenticated as the test user."""
	client = APIClient()
	client.force_authenticate(user=user)
	return client


@pytest.fixture
def unauth_client():
	"""Return an unauthenticated API client."""
	return APIClient()
