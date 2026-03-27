// src/components/SubtaskManagerModal.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X, Plus, Trash2, Layers, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { fetchSubtasks, createSubtask, deleteSubtask } from "@/api/dashboard";
import type { Subtask } from "@/api/dashboard";
import "./SubtaskManagerModal.css";

interface SubtaskManagerModalProps {
	activityId: number;
	activityTitle: string;
	activityDueDate?: string;
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
	qaPrefix?: string;
	open: boolean;
	onClose: () => void;
	onSubtasksChange?: (subtasks: Subtask[]) => void;
}

function getTodayIso(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatHours(value: number): string {
	if (!Number.isFinite(value)) return "0";
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

function formatDateLabel(isoDate: string): string {
	const parts = isoDate.split("-");
	if (parts.length !== 3) return isoDate;
	const [year, month, day] = parts;
	return `${day}/${month}/${year}`;
}

function extractApiErrorMessage(data: unknown): string | null {
	if (!data || typeof data !== "object") return null;

	const payload = data as Record<string, unknown>;
	const details = "errors" in payload ? payload.errors : payload;
	if (!details || typeof details !== "object") return null;

	const detailEntries = Object.entries(details as Record<string, unknown>);
	for (const [, value] of detailEntries) {
		if (typeof value === "string" && value.trim()) return value;
		if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0];
	}

	return null;
}

export default function SubtaskManagerModal({
	activityId,
	activityTitle,
	activityDueDate,
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
	qaPrefix = "subtask-manager-modal",
	open,
	onClose,
	onSubtasksChange,
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
	const conflictDateSet = useMemo(() => new Set(conflictDates), [conflictDates]);
	const parsedDraftHours = Number(estimatedHours);
	const draftHours =
		Number.isFinite(parsedDraftHours) && parsedDraftHours >= 0 ? parsedDraftHours : 0;
	const selectedDateLoad = targetDate ? (dateLoadMap[targetDate] ?? 0) : 0;
	const projectedDateLoad = targetDate ? selectedDateLoad + draftHours : 0;
	const hasConflictOnDate =
		!!targetDate &&
		(conflictDateSet.has(targetDate) || (maxDailyHours > 0 && projectedDateLoad > maxDailyHours));
	const capacityPercent =
		maxDailyHours > 0 ? Math.min((projectedDateLoad / maxDailyHours) * 100, 100) : 0;

	// --- Fetch Data ---
	const loadSubtasks = useCallback(async () => {
		if (!activityId) return;
		try {
			setIsLoading(true);
			const data = await fetchSubtasks(activityId);
			setSubtasks(data);
		} catch (error) {
			console.error("Error fetching subtasks:", error);
			toast.error("No se pudieron cargar las tareas.");
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
		const todayIso = getTodayIso();
		const parsedHours = Number(estimatedHours);
		const dueDateCeilingApplies = !!activityDueDate && activityDueDate >= todayIso;
		const targetDateExceedsActivityDueDate =
			dueDateCeilingApplies && !!targetDate && !!activityDueDate && targetDate > activityDueDate;

		// Client-side validation (UX/HCI Heuristic: Error Prevention)
		const newErrors = {
			name: !name.trim(),
			targetDate: !targetDate,
			hours: !Number.isInteger(parsedHours) || parsedHours < 0,
		};
		setErrors(newErrors);

		if (
			newErrors.name ||
			newErrors.targetDate ||
			newErrors.hours ||
			targetDateExceedsActivityDueDate
		) {
			if (targetDateExceedsActivityDueDate && activityDueDate) {
				toast.error(
					`La fecha objetivo no puede superar la fecha limite de la actividad (${activityDueDate}).`,
				);
				return;
			}

			if (newErrors.hours) {
				toast.error("Las horas deben ser un numero entero mayor o igual a 0.");
				return;
			}

			toast.error("Por favor, completa los campos correctamente.");
			return;
		}

		try {
			setIsSubmitting(true);
			const newSubtask = await createSubtask(activityId, {
				name: name.trim(),
				estimated_hours: parsedHours,
				target_date: targetDate,
				status: "pending",
				ordering: subtasks.length + 1,
			});

			// Update UI dynamically (FE-07)
			setSubtasks((prev) => {
				const next = [...prev, newSubtask];
				onSubtasksChange?.(next);
				return next;
			});
			toast.success("Tarea añadida al plan.");

			// Clear form inputs
			setName("");
			setEstimatedHours("");
			setTargetDate("");
			setErrors({});
		} catch (error: unknown) {
			console.error("Error creating subtask:", error);
			if (isAxiosError(error)) {
				const apiMessage = extractApiErrorMessage(error.response?.data);
				if (apiMessage) {
					toast.error(apiMessage);
				} else if (error.response?.status === 422) {
					toast.error("Error de validacion del servidor.");
				} else {
					toast.error("Ocurrio un error inesperado.");
				}
			} else {
				toast.error("Ocurrio un error inesperado.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (subtaskId: number) => {
		try {
			await deleteSubtask(activityId, subtaskId);
			setSubtasks((prev) => {
				const next = prev.filter((st) => st.id !== subtaskId);
				onSubtasksChange?.(next);
				return next;
			});
			toast.success("Tarea eliminada.");
		} catch (error) {
			console.error("Error deleting subtask:", error);
			toast.error("No se pudo eliminar la tarea.");
		}
	};

	// --- Render Modal via Portal ---
	const modalContent = (
		<div
			className="stm-backdrop"
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
			data-testid={`${qaPrefix}--backdrop`}
		>
			<div className="stm-modal" data-testid={qaPrefix}>
				{/* Header */}
				<div className="stm-header">
					<div className="stm-title-group">
						<h3 className="stm-title">Plan de Trabajo</h3>
						<p className="stm-subtitle">Actividad: {activityTitle}</p>
					</div>
					<button
						className="stm-close-btn"
						onClick={onClose}
						aria-label="Cerrar"
						data-testid={`${qaPrefix}--close-btn`}
					>
						<X size={18} />
					</button>
				</div>

				<div className="stm-body">
					{/* Subform (Formulario de Creación) */}
					<form className="stm-subform" onSubmit={handleCreate} data-testid={`${qaPrefix}--form`}>
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
									data-testid={`${qaPrefix}--name-input`}
								/>
							</div>
							<div className="stm-field">
								<label>Fecha Objetivo</label>
								<input
									type="date"
									value={targetDate}
									onChange={(e) => setTargetDate(e.target.value)}
									max={
										activityDueDate && activityDueDate >= getTodayIso()
											? activityDueDate
											: undefined
									}
									className={errors.targetDate ? "input-error" : ""}
									disabled={isSubmitting}
									data-testid={`${qaPrefix}--date-input`}
								/>
							</div>
							<div className="stm-field">
								<label>Tiempo (Horas)</label>
								<input
									type="number"
									step="1"
									min="0"
									placeholder="Ej: 2"
									value={estimatedHours}
									onChange={(e) => setEstimatedHours(e.target.value)}
									className={errors.hours ? "input-error" : ""}
									disabled={isSubmitting}
									data-testid={`${qaPrefix}--hours-input`}
								/>
							</div>
						</div>
						{targetDate && (
							<div
								className={`stm-capacity${hasConflictOnDate ? " is-conflict" : ""}`}
								data-testid={`${qaPrefix}--capacity`}
							>
								<div className="stm-capacity-top">
									<span>Capacidad para {formatDateLabel(targetDate)}</span>
									<strong>
										{maxDailyHours > 0
											? `${formatHours(projectedDateLoad)}h / ${formatHours(maxDailyHours)}h`
											: `${formatHours(projectedDateLoad)}h`}
									</strong>
								</div>
								{maxDailyHours > 0 && (
									<div className="stm-capacity-track">
										<div className="stm-capacity-fill" style={{ width: `${capacityPercent}%` }} />
									</div>
								)}
								<p className="stm-capacity-text">
									{hasConflictOnDate
										? "Hay un conflicto de carga para esta fecha. Puedes guardar y resolverlo despues en Conflictos."
										: "Sin conflicto detectado para esa fecha."}
								</p>
							</div>
						)}
						<button
							type="submit"
							className="stm-btn-add"
							disabled={isSubmitting}
							data-testid={`${qaPrefix}--add-btn`}
						>
							{isSubmitting ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
							{isSubmitting ? "Guardando..." : "Añadir tarea"}
						</button>
					</form>

					{/* Listado de Subtareas (Tabla) */}
					<div className="stm-table-wrap" data-testid={`${qaPrefix}--table-wrap`}>
						{isLoading ? (
							<div className="stm-empty">
								<Loader2 size={24} className="spin" />
								<p>Cargando plan de trabajo...</p>
							</div>
						) : subtasks.length === 0 ? (
							<div className="stm-empty">
								<Layers size={32} />
								<p>Esta actividad aún no tiene tareas asociadas.</p>
							</div>
						) : (
							<table className="stm-table">
								<thead>
									<tr>
										<th style={{ width: "40px", textAlign: "center" }}>#</th>
										<th>Tarea</th>
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
													title="Eliminar tarea"
													data-testid={`${qaPrefix}--delete-btn-${st.id}`}
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
