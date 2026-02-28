// src/components/Subtasks/SubtaskManager.tsx
import React, { useState, useEffect } from "react";
import { Plus, ListTodo, AlertCircle } from "lucide-react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import client from "../../api/client";
import SubtaskForm from "./SubtaskForm";
import type { Subtask, SubtaskFormData } from "./types";
import "./Subtasks.css";

interface SubtaskManagerProps {
	activityId: number;
}

export default function SubtaskManager({ activityId }: SubtaskManagerProps) {
	const [subtasks, setSubtasks] = useState<Subtask[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isLoadingList, setIsLoadingList] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [fetchError, setFetchError] = useState(false);

	// Fetch subtasks on component mount (FE-12: Handle UI states)
	const fetchSubtasks = useCallback(async () => {
		try {
			setIsLoadingList(true);
			setFetchError(false);
			const response = await client.get(`/activities/${activityId}/subtasks/`);
			setSubtasks(response.data);
		} catch (error) {
			console.error("Error fetching subtasks:", error);
			setFetchError(true);
			toast.error("Error al cargar las subtareas.");
		} finally {
			setIsLoadingList(false);
		}
	}, [activityId]);

	useEffect(() => {
		fetchSubtasks();
	}, [fetchSubtasks]);

	const handleCreateSubtask = async (data: SubtaskFormData) => {
		try {
			setIsSubmitting(true);
			// Standardizing payload as required by BE-03
			const payload = {
				...data,
				status: "pending",
				ordering: subtasks.length + 1,
			};

			const response = await client.post(`/activities/${activityId}/subtasks/`, payload);

			// Dynamic update without reload (FE-07)
			setSubtasks([...subtasks, response.data]);
			toast.success("Subtarea creada correctamente");
			setIsModalOpen(false);
		} catch (error: unknown) {
			console.error("Error creating subtask:", error);
			// Handling API validation errors (BE-05 & FE-08)
			if (isAxiosError(error) && error.response?.status === 422) {
				toast.error("Datos inválidos. Revisa el formulario.");
			} else {
				toast.error("Ocurrió un error en el servidor.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="subtask-manager-container">
			<div className="subtask-header">
				<h3>Plan de Trabajo (Subtareas)</h3>
				<button onClick={() => setIsModalOpen(true)} className="btn-add-subtask">
					<Plus size={16} /> Añadir nueva
				</button>
			</div>

			{/* Status handling: Error */}
			{fetchError && (
				<div className="state-container error-state">
					<AlertCircle size={24} />
					<p>No pudimos cargar tu plan. Intenta recargar la página.</p>
					<button onClick={fetchSubtasks} className="btn-secondary">
						Reintentar
					</button>
				</div>
			)}

			{/* Status handling: Loading */}
			{isLoadingList && !fetchError && (
				<div className="state-container loading-state">
					<div className="spinner-large" />
					<p>Cargando subtareas...</p>
				</div>
			)}

			{/* Status handling: Empty state (UX-06 requirement) */}
			{!isLoadingList && !fetchError && subtasks.length === 0 && (
				<div className="state-container empty-state">
					<ListTodo size={48} />
					<p>Esta actividad aún no tiene subtareas.</p>
					<button onClick={() => setIsModalOpen(true)} className="btn-primary mt-2">
						Crear la primera subtarea
					</button>
				</div>
			)}

			{/* Status handling: Success/List */}
			{!isLoadingList && !fetchError && subtasks.length > 0 && (
				<ul className="subtask-list">
					{subtasks.map((task) => (
						<li key={task.id} className="subtask-item">
							<div className="subtask-info">
								<span className={`status-indicator status-${task.status.toLowerCase()}`} />
								<span className="subtask-name">{task.name}</span>
							</div>
							<div className="subtask-meta">
								<span className="subtask-date">🎯 {task.target_date}</span>
								<span className="subtask-hours">⏳ {task.estimated_hours}h</span>
							</div>
						</li>
					))}
				</ul>
			)}

			{/* Modal injection */}
			{isModalOpen && (
				<SubtaskForm
					activityId={activityId}
					onClose={() => setIsModalOpen(false)}
					onSubmit={handleCreateSubtask}
					isLoading={isSubmitting}
				/>
			)}
		</div>
	);
}
