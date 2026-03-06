from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from planner.models import Activity, Subtask

User = get_user_model()


@pytest.fixture
def api_client():
	return APIClient()


@pytest.fixture
def user(db):
	return User.objects.create_user(
		username="testuser",
		password="testpass",
		email="test@example.com",
		name="Test User",
	)


@pytest.fixture
def auth_client(api_client, user):
	api_client.force_authenticate(user=user)
	return api_client


@pytest.fixture
def activity(db, user):
	return Activity.objects.create(
		user=user,
		title="Math Homework",
		course_name="Math",
		description="Do the homework",
		due_date=date.today() + timedelta(days=30),
		status="pending",
	)


@pytest.fixture
def subtask(db, activity):
	return Subtask.objects.create(
		activity_id=activity,
		name="Read chapter 1",
		estimated_hours=2,
		target_date=date.today() + timedelta(days=5),
		status="pending",
		ordering=1,
	)


# ── Happy path ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSubtaskPartialUpdate:
	def test_update_name(self, auth_client, activity, subtask):
		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"name": "Read chapter 2"},
			format="json",
		)

		assert response.status_code == 201
		assert response.data["name"] == "Read chapter 2"

		subtask.refresh_from_db()
		assert subtask.name == "Read chapter 2"

	def test_update_target_date(self, auth_client, activity, subtask):
		new_date = date.today() + timedelta(days=10)

		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"target_date": new_date.isoformat()},
			format="json",
		)

		assert response.status_code == 201
		assert response.data["target_date"] == new_date.isoformat()

		subtask.refresh_from_db()
		assert subtask.target_date == new_date

	def test_update_estimated_hours(self, auth_client, activity, subtask):
		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"estimated_hours": 5},
			format="json",
		)

		assert response.status_code == 201
		assert response.data["estimated_hours"] == 5

		subtask.refresh_from_db()
		assert subtask.estimated_hours == 5

	def test_update_all_fields_at_once(self, auth_client, activity, subtask):
		new_date = date.today() + timedelta(days=7)

		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{
				"name": "Updated subtask",
				"target_date": new_date.isoformat(),
				"estimated_hours": 3,
			},
			format="json",
		)

		assert response.status_code == 201
		subtask.refresh_from_db()
		assert subtask.name == "Updated subtask"
		assert subtask.target_date == new_date
		assert subtask.estimated_hours == 3


# ── Error / rejection cases ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestSubtaskPartialUpdateValidation:
	def test_empty_name_is_rejected(self, auth_client, activity, subtask):
		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"name": ""},
			format="json",
		)

		assert response.status_code == 422
		assert "name" in response.data.get("errors", {})

		# DB must be unchanged
		subtask.refresh_from_db()
		assert subtask.name == "Read chapter 1"

	def test_blank_name_is_rejected(self, auth_client, activity, subtask):
		"""Whitespace-only name should also fail."""
		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"name": "   "},
			format="json",
		)

		assert response.status_code == 422
		assert "name" in response.data.get("errors", {})

	def test_past_target_date_is_rejected(self, auth_client, activity, subtask):
		yesterday = date.today() - timedelta(days=1)

		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"target_date": yesterday.isoformat()},
			format="json",
		)

		assert response.status_code == 422
		assert "target_date" in response.data.get("errors", {})

	def test_invalid_status_is_rejected(self, auth_client, activity, subtask):
		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"status": "flying"},
			format="json",
		)

		assert response.status_code == 422
		assert "status" in response.data.get("errors", {})

	def test_unauthenticated_request_is_rejected(self, api_client, activity, subtask):
		response = api_client.patch(
			f"/activities/{activity.id}/subtasks/{subtask.id}/",
			{"name": "Hacker"},
			format="json",
		)

		assert response.status_code == 401

	def test_subtask_not_found_returns_404(self, auth_client, activity):
		response = auth_client.patch(
			f"/activities/{activity.id}/subtasks/99999/",
			{"name": "Ghost"},
			format="json",
		)

		assert response.status_code == 404


# ── Activity deletion & cascade ───────────────────────────────────────────────
#
# NOTE: "Verificar que cancelar en el modal no borra datos" is a UI interaction
# (a confirmation modal) — that belongs in an E2E test, not here. We skip it.
#
# What we CAN verify at this layer: deleting an activity via the API removes it
# and all its subtasks from the database (Django's on_delete=CASCADE).


@pytest.mark.django_db
class TestActivityDeletion:
	def test_delete_activity_returns_204(self, auth_client, activity):
		response = auth_client.delete(f"/activities/{activity.id}/")

		assert response.status_code == 204

	def test_delete_activity_removes_it_from_db(self, auth_client, activity):
		activity_id = activity.id

		auth_client.delete(f"/activities/{activity_id}/")

		assert not Activity.objects.filter(id=activity_id).exists()

	def test_delete_activity_cascades_to_subtasks(self, auth_client, activity, subtask):
		activity_id = activity.id
		subtask_id = subtask.id

		auth_client.delete(f"/activities/{activity_id}/")

		assert not Subtask.objects.filter(id=subtask_id).exists()

	def test_delete_activity_cascades_to_multiple_subtasks(self, auth_client, activity):
		subtask_ids = []
		for i in range(3):
			s = Subtask.objects.create(
				activity_id=activity,
				name=f"Subtask {i}",
				estimated_hours=1,
				target_date=date.today() + timedelta(days=5),
				status="pending",
				ordering=i,
			)
			subtask_ids.append(s.id)

		auth_client.delete(f"/activities/{activity.id}/")

		assert not Subtask.objects.filter(id__in=subtask_ids).exists()

	def test_delete_nonexistent_activity_returns_404(self, auth_client):
		response = auth_client.delete("/activities/99999/")

		assert response.status_code == 404

	def test_unauthenticated_delete_is_rejected(self, api_client, activity):
		response = api_client.delete(f"/activities/{activity.id}/")

		assert response.status_code == 401
		assert Activity.objects.filter(id=activity.id).exists()


# import pytest
# from datetime import date, timedelta
# from django.contrib.auth import get_user_model
# from rest_framework.test import APIClient
# from planner.models import Activity, Subtask
#
# User = get_user_model()
#
#
# @pytest.fixture
# def api_client():
# 	return APIClient()
#
#
# @pytest.fixture
# def user(db):
# 	return User.objects.create_user(
# 		username="testuser",
# 		password="testpass",
# 		email="test@example.com",
# 		name="Test User",
# 	)
#
#
# @pytest.fixture
# def auth_client(api_client, user):
# 	api_client.force_authenticate(user=user)
# 	return api_client
#
#
# @pytest.fixture
# def activity(user):
# 	return Activity.objects.create(
# 		user=user,
# 		title="Math Homework",
# 		course_name="Math",
# 		description="Do the homework",
# 		due_date=date.today() + timedelta(days=30),
# 		status="pending",
# 	)
#
#
# @pytest.fixture
# def subtask(activity):
# 	return Subtask.objects.create(
# 		activity_id=activity,
# 		name="Read chapter 1",
# 		estimated_hours=2,
# 		target_date=date.today() + timedelta(days=5),
# 		status="pending",
# 		ordering=1,
# 	)
#
#
# # ── Happy path ────────────────────────────────────────────────────────────────
#
#
# @pytest.mark.django_db
# class TestSubtaskPartialUpdate:
# 	def test_update_name(self, auth_client, activity, subtask):
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"name": "Read chapter 2"},
# 			format="json",
# 		)
#
# 		assert response.status_code == 201
# 		assert response.data["name"] == "Read chapter 2"
#
# 		subtask.refresh_from_db()
# 		assert subtask.name == "Read chapter 2"
#
# 	def test_update_target_date(self, auth_client, activity, subtask):
# 		new_date = date.today() + timedelta(days=10)
#
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"target_date": new_date.isoformat()},
# 			format="json",
# 		)
#
# 		assert response.status_code == 201
# 		assert response.data["target_date"] == new_date.isoformat()
#
# 		subtask.refresh_from_db()
# 		assert subtask.target_date == new_date
#
# 	def test_update_estimated_hours(self, auth_client, activity, subtask):
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"estimated_hours": 5},
# 			format="json",
# 		)
#
# 		assert response.status_code == 201
# 		assert response.data["estimated_hours"] == 5
#
# 		subtask.refresh_from_db()
# 		assert subtask.estimated_hours == 5
#
# 	def test_update_all_fields_at_once(self, auth_client, activity, subtask):
# 		new_date = date.today() + timedelta(days=7)
#
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{
# 				"name": "Updated subtask",
# 				"target_date": new_date.isoformat(),
# 				"estimated_hours": 3,
# 			},
# 			format="json",
# 		)
#
# 		assert response.status_code == 201
# 		subtask.refresh_from_db()
# 		assert subtask.name == "Updated subtask"
# 		assert subtask.target_date == new_date
# 		assert subtask.estimated_hours == 3
#
#
# # ── Error / rejection cases ───────────────────────────────────────────────────
#
#
# @pytest.mark.django_db
# class TestSubtaskPartialUpdateValidation:
# 	def test_empty_name_is_rejected(self, auth_client, activity, subtask):
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"name": ""},
# 			format="json",
# 		)
#
# 		assert response.status_code == 422
# 		assert "name" in response.data.get("errors", {})
#
# 		# DB must be unchanged
# 		subtask.refresh_from_db()
# 		assert subtask.name == "Read chapter 1"
#
# 	def test_blank_name_is_rejected(self, auth_client, activity, subtask):
# 		"""Whitespace-only name should also fail."""
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"name": "   "},
# 			format="json",
# 		)
#
# 		assert response.status_code == 422
# 		assert "name" in response.data.get("errors", {})
#
# 	def test_past_target_date_is_rejected(self, auth_client, activity, subtask):
# 		yesterday = date.today() - timedelta(days=1)
#
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"target_date": yesterday.isoformat()},
# 			format="json",
# 		)
#
# 		assert response.status_code == 422
# 		assert "target_date" in response.data.get("errors", {})
#
# 	def test_invalid_status_is_rejected(self, auth_client, activity, subtask):
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"status": "flying"},
# 			format="json",
# 		)
#
# 		assert response.status_code == 422
# 		assert "status" in response.data.get("errors", {})
#
# 	def test_unauthenticated_request_is_rejected(self, api_client, activity, subtask):
# 		response = api_client.patch(
# 			f"/activities/{activity.id}/subtasks/{subtask.id}/",
# 			{"name": "Hacker"},
# 			format="json",
# 		)
#
# 		assert response.status_code == 401
#
# 	def test_subtask_not_found_returns_404(self, auth_client, activity):
# 		response = auth_client.patch(
# 			f"/activities/{activity.id}/subtasks/99999/",
# 			{"name": "Ghost"},
# 			format="json",
# 		)
#
# 		assert response.status_code == 404
