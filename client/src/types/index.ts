export interface Subtask {
  id: number;
  name: string;
  estimated_hours: number;
  target_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  ordering: number;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  user: number;
  title: string;
  course_name: string;
  description: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  subtask_count: number;
  total_estimated_hours: number;
  subtasks: Subtask[];
}

export interface Progress {
  id: number;
  user_id: number;
  activity_id: number;
  subtask_id: number;
  status: 'pending' | 'in_progress' | 'completed';
  note: string;
  recorded_at: string;
}

export interface Subject {
  id: number;
  name: string;
  creation_date: string;
}

export interface Conflict {
  id: number;
  affected_date: string;
  type: 'overload';
  planned_hours: number;
  max_allowed_hours: number;
  status: 'pending' | 'resolved';
  detected_at: string;
}

export interface FilterOption {
  id: string;
  label: string;
  color: string;
  checked: boolean;
}
