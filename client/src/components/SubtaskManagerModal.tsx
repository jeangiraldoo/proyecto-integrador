// src/components/SubtaskManagerModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Layers, AlertCircle, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { fetchSubtasks, createSubtask, deleteSubtask } from "../api/dashboard";
import type { Subtask } from "../api/dashboard";
import "./SubtaskManagerModal.css";

interface SubtaskManagerModalProps {
	activityId: number;
	activityTitle: string;
	open: boolean;
	onClose: () => void;
}

export default function SubtaskManagerModal({
	activityId,
	activityTitle,
	open,
	onClose,
}: SubtaskManagerModalProps) {
	// --- States ---
	const [subtasks, setSubtasks] = useState<Subtask[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Form States
	const [name, setName] = useState("");
	const [estimatedHours, setEstimatedHours] = useState<number | string>("");
	const [targetDate, setTargetDate] = useState("");
	const [errors, setErrors] = useState<{ name?: boolean; targetDate?: boolean; hours?: boolean }>(
		{},
	);

	// --- Fetch Data ---
	const loadSubtasks = useCallback(async () => {
		if (!activityId) return;
		try {
			setIsLoading(true);
			const data = await fetchSubtasks(activityId);
			setSubtasks(data);
		} catch (error) {
			console.error("Error fetching subtasks:", error);
			toast.error("No se pudieron cargar las subtareas.");
		} finally {
			setIsLoading(false);
		}
	}, [activityId]);

	useEffect(() => {
		if (open) {
			loadSubtasks();
			// Reset form
			setName("");
			setEstimatedHours("");
			setTargetDate("");
			setErrors({});
		}
	}, [open, loadSubtasks]);

	if (!open) return null;

	// --- Handlers ---
	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();

		// Client-side validation (UX/HCI Heuristic: Error Prevention)
		const newErrors = {
			name: !name.trim(),
			targetDate: !targetDate,
			hours: Number(estimatedHours) <= 0,
		};
		setErrors(newErrors);

		if (newErrors.name || newErrors.targetDate || newErrors.hours) {
			toast.error("Por favor, completa los campos correctamente.");
			return;
		}

		try {
			setIsSubmitting(true);
			const newSubtask = await createSubtask(activityId, {
				name: name.trim(),
				estimated_hours: Number(estimatedHours),
				target_date: targetDate,
				status: "pending",
				ordering: subtasks.length + 1,
			});

			// Update UI dynamically (FE-07)
			setSubtasks((prev) => [...prev, newSubtask]);
			toast.success("Subtarea añadida al plan.");

			// Clear form inputs
			setName("");
			setEstimatedHours("");
			setTargetDate("");
			setErrors({});
		} catch (error: unknown) {
			console.error("Error creating subtask:", error);
			if (isAxiosError(error) && error.response?.status === 422) {
				toast.error("Error de validación del servidor.");
			} else {
				toast.error("Ocurrió un error inesperado.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (subtaskId: number) => {
		try {
			await deleteSubtask(activityId, subtaskId);
			setSubtasks((prev) => prev.filter((st) => st.id !== subtaskId));
			toast.success("Subtarea eliminada.");
		} catch (error) {
			console.error("Error deleting subtask:", error);
			toast.error("No se pudo eliminar la subtarea.");
		}
	};

	// --- Render Modal via Portal ---
	const modalContent = (
		<div className="stm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<div className="stm-modal">
				{/* Header */}
				<div className="stm-header">
					<div className="stm-title-group">
						<h3 className="stm-title">Plan de Trabajo</h3>
						<p className="stm-subtitle">Actividad: {activityTitle}</p>
					</div>
					<button className="stm-close-btn" onClick={onClose} aria-label="Cerrar">
						<X size={18} />
					</button>
				</div>

				<div className="stm-body">
					{/* Subform (Formulario de Creación) */}
					<form className="stm-subform" onSubmit={handleCreate}>
						<div className="stm-subform-grid">
							<div className="stm-field full">
								<label>¿Qué debes hacer? (Nombre)</label>
								<input
									type="text"
									placeholder="Ej: Leer capítulo 3"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className={errors.name ? "input-error" : ""}
									disabled={isSubmitting}
								/>
							</div>
							<div className="stm-field">
								<label>Fecha Objetivo</label>
								<input
									type="date"
									value={targetDate}
									onChange={(e) => setTargetDate(e.target.value)}
									className={errors.targetDate ? "input-error" : ""}
									disabled={isSubmitting}
								/>
							</div>
							<div className="stm-field">
								<label>Tiempo (Horas)</label>
								<input
									type="number"
									step="0.5"
									placeholder="Ej: 2.5"
									value={estimatedHours}
									onChange={(e) => setEstimatedHours(e.target.value)}
									className={errors.hours ? "input-error" : ""}
									disabled={isSubmitting}
								/>
							</div>
						</div>
						<button type="submit" className="stm-btn-add" disabled={isSubmitting}>
							{isSubmitting ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
							{isSubmitting ? "Guardando..." : "Añadir subtarea"}
						</button>
					</form>

					{/* Listado de Subtareas (Tabla) */}
					<div className="stm-table-wrap">
						{isLoading ? (
							<div className="stm-empty">
								<Loader2 size={24} className="spin" />
								<p>Cargando plan de trabajo...</p>
							</div>
						) : subtasks.length === 0 ? (
							<div className="stm-empty">
								<Layers size={32} />
								<p>Esta actividad aún no tiene subtareas asociadas.</p>
							</div>
						) : (
							<table className="stm-table">
								<thead>
									<tr>
										<th style={{ width: "40px", textAlign: "center" }}>#</th>
										<th>Subtarea</th>
										<th>Fecha</th>
										<th>Horas</th>
										<th style={{ width: "50px", textAlign: "center" }}>Acción</th>
									</tr>
								</thead>
								<tbody>
									{subtasks.map((st, idx) => (
										<tr key={st.id}>
											<td style={{ textAlign: "center" }}>
												<span className="stm-badge-order">{idx + 1}</span>
											</td>
											<td style={{ fontWeight: 500, color: "#fff" }}>{st.name}</td>
											<td>
												<span className="stm-pill">
													{st.target_date.split("-").reverse().join("/")}
												</span>
											</td>
											<td>
												<span className="stm-pill">{st.estimated_hours}h</span>
											</td>
											<td style={{ textAlign: "center" }}>
												<button
													type="button"
													className="stm-btn-delete"
													onClick={() => handleDelete(st.id)}
													title="Eliminar subtarea"
												>
													<Trash2 size={16} />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>
		</div>
	);

	if (typeof document !== "undefined") return createPortal(modalContent, document.body);
	return modalContent;
}
