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
	course_name: string;
	description: string;
	due_date: string; // "YYYY-MM-DD"
	status: "pending" | "completed" | "in_progress";
	subtask_count: number;
	total_estimated_hours: number;
	subtasks?: Subtask[];
	total_subtasks_count?: number;
	completed_subtasks_count?: number;
}

export interface Subtask {
	id: number;
	name: string;
	estimated_hours: number;
	target_date: string;
	status: "pending" | "completed" | "in_progress" | "postponed";
	ordering: number;
	created_at: string;
	updated_at: string;
	postponement_note?: string;
	// Populated by TodayView endpoint (TodaySubtaskSerializer)
	activity?: { id: number; title: string };
	course_name?: string;
}

export interface PaginatedResponse<T> {
	count: number;
	next: string | null;
	previous: string | null;
	results: T;
}

export type TodayStatusFilter = "vencidas" | "hoy" | "proximas" | "pospuestas";

export interface TodayViewResponse {
	overdue: Subtask[];
	today: Subtask[];
	upcoming: Subtask[];
	postponed?: Subtask[];
	meta: {
		n_days: number;
		filters: {
			courseId: number | null;
			status: TodayStatusFilter | null;
		};
	};
}

export interface TodayViewParams {
	nDays?: number;
	courseId?: number;
	status?: TodayStatusFilter;
	page?: number;
	limit?: number;
}

export interface Subject {
	id: number;
	name: string;
	creation_date: string;
}

export interface Conflict {
	id: number;
	affected_date: string;
	planned_hours: number;
	max_allowed_hours: number;
	status: string;
	detected_at: string;
}

/* ============ API CALLS ============ */

export async function fetchMe(): Promise<User> {
	const { data } = await client.get<User>("/me/");
	return data;
}

export async function updateMe(payload: Partial<Pick<User, "max_daily_hours">>): Promise<User> {
	const { data } = await client.patch<User>("/me/", payload);
	return data;
}

export async function fetchActivities(
	page?: number,
	limit?: number,
): Promise<PaginatedResponse<Activity[]> | Activity[]> {
	const params: Record<string, string | number> = {};
	if (page !== undefined) params.page = page;
	if (limit !== undefined) params.limit = limit;
	const { data } = await client.get<PaginatedResponse<Activity[]> | Activity[]>("/activities/", {
		params,
	});
	return data;
}

export type CreateActivityPayload = {
	title: string;
	course_name: string;
	description?: string;
	due_date: string;
	status: Activity["status"];
	total_estimated_hours?: number;
	subtasks?: { name: string; target_date: string; estimated_hours: number }[];
};

export async function createActivity(payload: CreateActivityPayload): Promise<Activity> {
	const { data } = await client.post<Activity>("/activities/", payload);
	return data;
}

export async function updateActivity(
	id: number,
	payload: Partial<Pick<Activity, "title" | "description" | "due_date" | "status" | "course_name">>,
): Promise<Activity> {
	const { data } = await client.patch<Activity>(`/activities/${id}/`, payload);
	return data;
}

export async function deleteActivity(id: number): Promise<void> {
	await client.delete(`/activities/${id}/`);
}

export async function fetchTodayView(
	params?: TodayViewParams,
): Promise<TodayViewResponse | PaginatedResponse<TodayViewResponse>> {
	const query: Record<string, string | number> = {};
	if (params?.nDays !== undefined) query.n_days = params.nDays;
	if (params?.courseId !== undefined) query.courseId = params.courseId;
	if (params?.status !== undefined) query.status = params.status;
	if (params?.page !== undefined) query.page = params.page;
	if (params?.limit !== undefined) query.limit = params.limit;
	const { data } = await client.get<TodayViewResponse | PaginatedResponse<TodayViewResponse>>(
		"/today/",
		{ params: query },
	);
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
		Pick<
			Subtask,
			"name" | "estimated_hours" | "target_date" | "status" | "ordering" | "postponement_note"
		>
	>,
): Promise<Subtask> {
	const { postponement_note, ...rest } = payload;
	const submitPayload =
		postponement_note !== undefined ? { ...rest, note: postponement_note } : rest;
	const { data } = await client.patch<Subtask>(
		`/activities/${activityId}/subtasks/${subtaskId}/`,
		submitPayload,
	);
	return data;
}

export async function deleteSubtask(activityId: number, subtaskId: number): Promise<void> {
	await client.delete(`/activities/${activityId}/subtasks/${subtaskId}/`);
}

/* -- Subject endpoints -- */

export async function fetchSubjects(): Promise<Subject[]> {
	const { data } = await client.get<Subject[]>("/subjects/");
	return data;
}

export async function createSubject(name: string): Promise<Subject> {
	const { data } = await client.post<Subject>("/subjects/", { name });
	return data;
}

export async function updateSubject(id: number, name: string): Promise<Subject> {
	const { data } = await client.patch<Subject>(`/subjects/${id}/`, { name });
	return data;
}

export async function deleteSubject(id: number): Promise<void> {
	await client.delete(`/subjects/${id}/`);
}

/* -- Conflict endpoints -- */

export async function fetchConflicts(): Promise<Conflict[]> {
	const { data } = await client.get<Conflict[]>("/conflicts/");
	return data;
}
