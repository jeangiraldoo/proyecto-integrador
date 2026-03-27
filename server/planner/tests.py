from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Activity, Progress, Subject, Subtask, User


def _make_user(username="testuser", email="test@example.com", password="testpass123"):
	return User.objects.create_user(username=username, email=email, password=password)


def _make_activity(user, title="Test Activity"):
	subject = Subject.objects.create(name="Math")
	return Activity.objects.create(
		user=user,
		subject=subject,
		title=title,
		course_name="Math",
		description="desc",
		due_date="2099-12-31",
		status="pending",
	)


def _make_subtask(activity, name="Task", target_date="2099-06-01", status="pending", hours=2):
	count = Subtask.objects.filter(activity_id=activity).count()
	return Subtask.objects.create(
		activity_id=activity,
		name=name,
		estimated_hours=hours,
		target_date=target_date,
		status=status,
		ordering=count + 1,
	)


# ---------------------------------------------------------------------------
# SubtaskSerializer — status validation
# ---------------------------------------------------------------------------


class SubtaskStatusValidationTests(APITestCase):
	def setUp(self):
		self.user = _make_user()
		self.client.force_authenticate(user=self.user)
		self.activity = _make_activity(self.user)
		self.subtask = _make_subtask(self.activity)
		self.url = reverse(
			"activity-subtask-detail",
			kwargs={"activity_id": self.activity.id, "subtask_id": self.subtask.id},
		)

	def test_valid_statuses_accepted(self):
		for s in ("pending", "in_progress", "completed", "postponed"):
			with self.subTest(status=s):
				res = self.client.patch(self.url, {"status": s}, format="json")
				self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

	def test_invalid_status_returns_422(self):
		res = self.client.patch(self.url, {"status": "unknown_status"}, format="json")
		self.assertEqual(res.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)


# ---------------------------------------------------------------------------
# partial_update — Progress record creation
# ---------------------------------------------------------------------------


class SubtaskPartialUpdateProgressTests(APITestCase):
	def setUp(self):
		self.user = _make_user()
		self.client.force_authenticate(user=self.user)
		self.activity = _make_activity(self.user)
		self.subtask = _make_subtask(self.activity)
		self.url = reverse(
			"activity-subtask-detail",
			kwargs={"activity_id": self.activity.id, "subtask_id": self.subtask.id},
		)

	def test_patch_creates_progress_record(self):
		res = self.client.patch(self.url, {"status": "in_progress"}, format="json")
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		self.assertEqual(Progress.objects.filter(subtask=self.subtask).count(), 1)

	def test_patch_with_note_persists_note(self):
		res = self.client.patch(
			self.url, {"status": "postponed", "note": "Esperando al profesor"}, format="json"
		)
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		entry = Progress.objects.get(subtask=self.subtask)
		self.assertEqual(entry.note, "Esperando al profesor")
		self.assertEqual(entry.status, "postponed")

	def test_patch_without_note_creates_empty_note(self):
		res = self.client.patch(self.url, {"status": "completed"}, format="json")
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		entry = Progress.objects.get(subtask=self.subtask)
		self.assertEqual(entry.note, "")

	def test_note_persists_after_subsequent_status_change(self):
		"""Progress history is immutable — old notes survive future updates."""
		self.client.patch(self.url, {"status": "postponed", "note": "blocked"}, format="json")
		self.client.patch(self.url, {"status": "completed"}, format="json")
		entries = Progress.objects.filter(subtask=self.subtask).order_by("recorded_at")
		self.assertEqual(entries.count(), 2)
		self.assertEqual(entries[0].note, "blocked")
		self.assertEqual(entries[0].status, "postponed")
		self.assertEqual(entries[1].status, "completed")

	def test_patch_subtask_status_updated(self):
		self.client.patch(self.url, {"status": "postponed"}, format="json")
		self.subtask.refresh_from_db()
		self.assertEqual(self.subtask.status, "postponed")


# ---------------------------------------------------------------------------
# ActivitySerializer — completed_subtasks_count / total_subtasks_count
# ---------------------------------------------------------------------------


class ActivityProgressCountTests(APITestCase):
	def setUp(self):
		self.user = _make_user()
		self.client.force_authenticate(user=self.user)
		self.activity = _make_activity(self.user)
		_make_subtask(self.activity, name="T1", status="completed")
		_make_subtask(self.activity, name="T2", status="completed")
		_make_subtask(self.activity, name="T3", status="pending")

	def _assert_counts(self, data):
		self.assertEqual(data["total_subtasks_count"], 3)
		self.assertEqual(data["completed_subtasks_count"], 2)

	def test_list_returns_progress_counts(self):
		res = self.client.get(reverse("activity-list"))
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		self._assert_counts(res.data[0])

	def test_retrieve_returns_progress_counts(self):
		res = self.client.get(reverse("activity-detail", kwargs={"pk": self.activity.id}))
		self.assertEqual(res.status_code, status.HTTP_200_OK)
		self._assert_counts(res.data)

	def test_no_subtasks_returns_zero_counts(self):
		activity2 = _make_activity(self.user, title="Empty")
		res = self.client.get(reverse("activity-detail", kwargs={"pk": activity2.id}))
		self.assertEqual(res.data["total_subtasks_count"], 0)
		self.assertEqual(res.data["completed_subtasks_count"], 0)

	def test_postponed_not_counted_as_completed(self):
		_make_subtask(self.activity, name="T4", status="postponed")
		res = self.client.get(reverse("activity-detail", kwargs={"pk": self.activity.id}))
		# total grows by 1, completed stays at 2
		self.assertEqual(res.data["total_subtasks_count"], 4)
		self.assertEqual(res.data["completed_subtasks_count"], 2)


