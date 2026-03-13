// Shared types and helper utilities used across Dashboard views

// Local type matching CreateActivityModal's payload
export type NewActivityPayloadFromModal = {
	subject: string;
	title: string;
	description?: string;
	due_date: string;
	total_estimated_hours?: number;
	subtasks: { title: string; target_date: string; estimated_hours: number | string }[];
};

export type SectionVariant = "overdue" | "today" | "upcoming";

export function formatDate(iso: string | null | undefined): string {
	if (iso == null || typeof iso !== "string") return "—";
	const parts = iso.split("-");
	if (parts.length < 3) return iso;
	const [y, m, d] = parts;
	return `${d}/${m}/${y}`;
}

export function daysUntil(dateIso: string): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const d = new Date(dateIso + "T00:00:00");
	return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function classifyActivity(dueDateIso: string): SectionVariant {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const due = new Date(dueDateIso + "T00:00:00");
	if (due < today) return "overdue";
	if (due.getTime() === today.getTime()) return "today";
	return "upcoming";
}

import type { Subtask } from "../api/dashboard";

export type KanbanGroup = "overdue" | "today" | "upcoming";
export type KanbanState = { overdue: Subtask[]; today: Subtask[]; upcoming: Subtask[] };
export const EMPTY_KANBAN: KanbanState = { overdue: [], today: [], upcoming: [] };

export function checkDailyConflicts(
	subtasks: Array<{ target_date: string; estimated_hours: number }>,
	maxDailyHours: number,
): { date: string; totalHours: number } | null {
	if (maxDailyHours <= 0) return null;
	const hoursMap = new Map<string, number>();

	for (const subtask of subtasks) {
		if (!subtask.target_date) continue;
		const current = hoursMap.get(subtask.target_date) ?? 0;
		hoursMap.set(subtask.target_date, current + (Number(subtask.estimated_hours) || 0));
	}

	for (const [date, totalHours] of hoursMap.entries()) {
		if (totalHours > maxDailyHours) return { date, totalHours };
	}

	return null;
}
