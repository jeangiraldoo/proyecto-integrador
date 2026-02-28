// src/components/Subtasks/types.ts

export interface Subtask {
	id: number;
	name: string;
	estimated_hours: number;
	target_date: string;
	status: string;
	ordering: number;
	created_at: string;
	updated_at: string;
}

export interface SubtaskFormData {
	name: string;
	estimated_hours: number;
	target_date: string;
}
