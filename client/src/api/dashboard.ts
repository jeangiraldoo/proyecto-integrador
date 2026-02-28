import client from "./client";

/* ============ TYPES ============ */

export interface User {
	id: number;
	username: string;
	email: string;
	name: string;
	max_daily_hours: number;
	date_joined: string;
}

export interface Activity {
	id: number;
	user: number;
	title: string;
	description: string;
	due_date: string; // "YYYY-MM-DD"
	status: "pending" | "completed" | "in_progress";
	subtask_count: number;
	total_estimated_hours: number;
}

export interface Subtask {
	id: number;
	name: string;
	estimated_hours: number;
	target_date: string;
	status: "pending" | "completed" | "in_progress";
	ordering: number;
	created_at: string;
	updated_at: string;
}

export interface TodayViewResponse {
	overdue: Subtask[];
	today: Subtask[];
	upcoming: Subtask[];
	meta: { n_days: number };
}

/* ============ API CALLS ============ */

export async function fetchMe(): Promise<User> {
	const { data } = await client.get<User>("/me/");
	return data;
}

export async function fetchActivities(): Promise<Activity[]> {
	const { data } = await client.get<Activity[]>("/activities/");
	return data;
}

export async function createActivity(
	payload: Pick<Activity, "title" | "description" | "due_date" | "status">,
): Promise<Activity> {
	const { data } = await client.post<Activity>("/activities/", payload);
	return data;
}

export async function updateActivity(
	id: number,
	payload: Partial<Pick<Activity, "title" | "description" | "due_date" | "status">>,
): Promise<Activity> {
	const { data } = await client.patch<Activity>(`/activities/${id}/`, payload);
	return data;
}

export async function deleteActivity(id: number): Promise<void> {
	await client.delete(`/activities/${id}/`);
}

export async function fetchTodayView(nDays?: number): Promise<TodayViewResponse> {
	const params = nDays !== undefined ? { n_days: nDays } : {};
	const { data } = await client.get<TodayViewResponse>("/today/", { params });
	return data;
}

/* -- Subtask endpoints (ready for teammate) -- */

export async function fetchSubtasks(activityId: number): Promise<Subtask[]> {
	const { data } = await client.get<Subtask[]>(`/activities/${activityId}/subtasks/`);
	return data;
}

export async function createSubtask(
	activityId: number,
	payload: Pick<Subtask, "name" | "estimated_hours" | "target_date" | "status" | "ordering">,
): Promise<Subtask> {
	const { data } = await client.post<Subtask>(`/activities/${activityId}/subtasks/`, payload);
	return data;
}

export async function updateSubtask(
	activityId: number,
	subtaskId: number,
	payload: Partial<
		Pick<Subtask, "name" | "estimated_hours" | "target_date" | "status" | "ordering">
	>,
): Promise<Subtask> {
	const { data } = await client.patch<Subtask>(
		`/activities/${activityId}/subtasks/${subtaskId}/`,
		payload,
	);
	return data;
}

export async function deleteSubtask(activityId: number, subtaskId: number): Promise<void> {
	await client.delete(`/activities/${activityId}/subtasks/${subtaskId}/`);
}
