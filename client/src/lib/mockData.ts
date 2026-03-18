import type { Activity, Subject } from '../types';

export const mockActivities: Activity[] = [
  {
    id: 101,
    user: 1,
    title: "Proyecto Integrador - Fase 2",
    course_name: "Ingeniería de Software",
    description: "Desarrollo del backend y conexión con el frontend.",
    due_date: "2026-03-30",
    status: "in_progress",
    subtask_count: 3,
    total_estimated_hours: 12,
    subtasks: [
      {
        id: 501,
        name: "Diseño de modelos de base de datos",
        estimated_hours: 2,
        target_date: "2026-03-18",
        status: "completed",
        ordering: 1,
        created_at: "2026-03-17T10:00:00Z",
        updated_at: "2026-03-17T15:30:00Z"
      },
      {
        id: 502,
        name: "Implementación de Serializadores",
        estimated_hours: 4,
        target_date: "2026-03-19",
        status: "in_progress",
        ordering: 2,
        created_at: "2026-03-17T10:05:00Z",
        updated_at: "2026-03-17T10:05:00Z"
      },
      {
        id: 503,
        name: "Pruebas unitarias de la API",
        estimated_hours: 6,
        target_date: "2026-03-21",
        status: "pending",
        ordering: 3,
        created_at: "2026-03-17T10:10:00Z",
        updated_at: "2026-03-17T10:10:00Z"
      }
    ]
  },
  {
    id: 102,
    user: 1,
    title: "Estudio de Algoritmos",
    course_name: "Matemática Discreta",
    description: "Repasar grafos y árboles.",
    due_date: "2026-03-25",
    status: "pending",
    subtask_count: 1,
    total_estimated_hours: 3,
    subtasks: [
      {
        id: 504,
        name: "Ejercicios de Dijkstra",
        estimated_hours: 3,
        target_date: "2026-03-22",
        status: "pending",
        ordering: 1,
        created_at: "2026-03-17T11:00:00Z",
        updated_at: "2026-03-17T11:00:00Z"
      }
    ]
  }
];

export const mockSubjects: Subject[] = [
  {
    id: 1,
    name: "Ingeniería de Software",
    creation_date: "2026-01-10T10:00:00Z"
  },
  {
    id: 2,
    name: "Matemática Discreta",
    creation_date: "2026-01-11T11:00:00Z"
  },
  {
    id: 3,
    name: "Base de Datos",
    creation_date: "2026-01-12T12:00:00Z"
  },
  {
    id: 4,
    name: "Programación Web",
    creation_date: "2026-01-13T13:00:00Z"
  }
];

export const statusOptions = [
  { id: 'pending', label: 'Pendiente', color: 'gray' },
  { id: 'in_progress', label: 'En Progreso', color: 'orange' },
  { id: 'completed', label: 'Completado', color: 'green' }
];

export const priorityOptions = [
  { id: 'low', label: 'Baja', color: 'blue' },
  { id: 'medium', label: 'Media', color: 'yellow' },
  { id: 'high', label: 'Alta', color: 'red' }
];
