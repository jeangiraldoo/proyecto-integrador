import { useState, useEffect, useRef } from "react";
import {
	X,
	Plus,
	Trash2,
	GripVertical,
	CalendarDays,
	ClipboardList,
	Layers,
	AlertCircle,
	AlertTriangle,
} from "lucide-react";
import { createPortal } from "react-dom";
import "./CreateActivityModal.css";

/* ---- Constants ---- */
const MAX_SUBTASKS = 10;

/* ---- Types ---- */
interface Subtask {
	id: number;
	title: string;
	target_date: string;
	estimated_hours: number | string;
}

interface NewActivityPayload {
	subject: string; // 👈 Ahora es un string de texto
	title: string;
	description?: string;
	due_date: string;
	total_estimated_hours?: number;
	subtasks: Omit<Subtask, "id">[];
}

interface Props {
	open: boolean;
	onClose: () => void;
	onCreate: (payload: NewActivityPayload) => void;
}

/* ---- Helpers ---- */
function formatDate(iso: string): string {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

// Today's date as YYYY-MM-DD for min validation
function todayIso() {
	return new Date().toISOString().split("T")[0];
}

let nextId = 1;

/* ---- Custom Date Input ---- */
function DateInput({
	id,
	value,
	onChange,
	variant = "purple",
	hasError = false,
}: {
	id?: string;
	value: string;
	onChange: (v: string) => void;
	variant?: "purple" | "green";
	hasError?: boolean;
}) {
	const wrapClass = [
		variant === "green" ? "ca-subform-date-wrapper" : "ca-date-wrapper",
		hasError ? "input-error" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={wrapClass}>
			<span className="ca-date-icon">
				<CalendarDays size={15} />
			</span>
			<input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
		</div>
	);
}

/* ---- Inline field error ---- */
function FieldError({ msg }: { msg: string }) {
	return (
		<span className="ca-field-error">
			<AlertCircle size={12} />
			{msg}
		</span>
	);
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function CreateActivityModal({ open, onClose, onCreate }: Props) {
	/* Main form */
	const [subject, setSubject] = useState(""); // 👈 Texto de la materia
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [estimatedHours, setEstimatedHours] = useState<number | string>("");

	/* Validation — only shown after first submit attempt */
	const [submitted, setSubmitted] = useState(false);

	/* Subtask subform */
	const [stTitle, setStTitle] = useState("");
	const [stDate, setStDate] = useState("");
	const [stHours, setStHours] = useState<number | string>("");
	const [stSubmitted, setStSubmitted] = useState(false);

	/* Subtask list */
	const [subtasks, setSubtasks] = useState<Subtask[]>([]);

	/* Drag */
	const dragIndex = useRef<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	useEffect(() => {
		if (!open) clearAll();
	}, [open]);

	function clearAll() {
		setSubject("");
		setTitle("");
		setDescription("");
		setDueDate("");
		setEstimatedHours("");
		setStTitle("");
		setStDate("");
		setStHours("");
		setSubtasks([]);
		setSubmitted(false);
		setStSubmitted(false);
		dragIndex.current = null;
		setDragOverIndex(null);
	}

	/* ---- Validation ---- */
	const subjectError = !subject.trim() ? "La materia es obligatoria" : "";
	const titleError = !title.trim() ? "El título es obligatorio" : "";
	const dueDateError = !dueDate
		? "La fecha de entrega es obligatoria"
		: dueDate < todayIso()
			? "La fecha no puede ser en el pasado"
			: "";
	const stTitleError = !stTitle.trim() ? "Ingresa un nombre para la subtarea" : "";

	const mainValid = !titleError && !dueDateError && !subjectError;

	/* Missing fields summary for footer */
	const missingCount = (subjectError ? 1 : 0) + (titleError ? 1 : 0) + (dueDateError ? 1 : 0);

	/* ---- Subtask actions ---- */
	function handleAddSubtask() {
		setStSubmitted(true);
		if (!stTitle.trim()) return;
		if (subtasks.length >= MAX_SUBTASKS) return;
		setSubtasks((prev) => [
			...prev,
			{ id: nextId++, title: stTitle.trim(), target_date: stDate, estimated_hours: stHours },
		]);
		setStTitle("");
		setStDate("");
		setStHours("");
		setStSubmitted(false);
	}

	function handleDeleteSubtask(id: number) {
		setSubtasks((prev) => prev.filter((s) => s.id !== id));
	}

	/* ---- Drag & Drop ---- */
	function handleDragStart(e: React.DragEvent, idx: number) {
		dragIndex.current = idx;
		e.dataTransfer.effectAllowed = "move";
	}
	function handleDragEnter(idx: number) {
		if (dragIndex.current === null || dragIndex.current === idx) return;
		setDragOverIndex(idx);
	}
	function handleDrop(e: React.DragEvent, dropIdx: number) {
		e.preventDefault();
		const from = dragIndex.current;
		if (from === null || from === dropIdx) return;
		setSubtasks((prev) => {
			const next = [...prev];
			const [removed] = next.splice(from, 1);
			next.splice(dropIdx, 0, removed);
			return next;
		});
		dragIndex.current = null;
		setDragOverIndex(null);
	}
	function handleDragEnd() {
		dragIndex.current = null;
		setDragOverIndex(null);
	}

	/* ---- Submit ---- */
	function handleSubmit(e?: React.FormEvent) {
		e?.preventDefault();
		setSubmitted(true);
		if (!mainValid) return;

		onCreate({
			subject: subject.trim(), // 👈 Enviamos el texto de la materia
			title: title.trim(),
			description: description.trim(),
			due_date: dueDate,
			total_estimated_hours: estimatedHours === "" ? 0 : Number(estimatedHours),
			subtasks: subtasks.map(({ title, target_date, estimated_hours }) => ({
				title,
				target_date,
				estimated_hours,
			})),
		});
		onClose();
		clearAll();
	}

	const atMax = subtasks.length >= MAX_SUBTASKS;

	if (!open) return null;

	const modal = (
		<div
			className="ca-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ca-modal-title"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="ca-modal">
				{/* ====== HEADER ====== */}
				<div className="ca-header">
					<div className="ca-header-left">
						<div className="ca-header-icon">
							<ClipboardList size={20} />
						</div>
						<div className="ca-header-text">
							<h3 id="ca-modal-title">Nueva actividad</h3>
							<p className="ca-subtitle">Rellena los datos para planificar tu día</p>
						</div>
					</div>
					<button className="ca-close" onClick={onClose} aria-label="Cerrar">
						<X size={15} />
					</button>
				</div>

				{/* ====== BODY ====== */}
				<form className="ca-body" onSubmit={handleSubmit} noValidate>
					{/* ---- LEFT COLUMN ---- */}
					<div className="ca-col-left">
						<div className="ca-col-heading">
							<span className="ca-col-heading-dot" />
							<span>Información general</span>
						</div>

						{/* Subject (Materia) 👈 AHORA ES UN INPUT */}
						<div className="ca-row">
							<label
								htmlFor="ca-subject"
								className={submitted && subjectError ? "label-error" : ""}
							>
								Materia {submitted && subjectError ? "·" : "*"}
							</label>
							<input
								id="ca-subject"
								type="text"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								placeholder="Ej. Diseño de Interfaces..."
								className={submitted && subjectError ? "input-error" : ""}
								autoFocus
							/>
							{submitted && subjectError && <FieldError msg={subjectError} />}
						</div>

						{/* Title */}
						<div className="ca-row">
							<label htmlFor="ca-title" className={submitted && titleError ? "label-error" : ""}>
								Título {submitted && titleError ? "·" : "*"}
							</label>
							<input
								id="ca-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="¿Qué vas a hacer?"
								className={submitted && titleError ? "input-error" : ""}
							/>
							{submitted && titleError && <FieldError msg={titleError} />}
						</div>

						{/* Due date + Hours */}
						<div className="ca-row split">
							<div>
								<label
									htmlFor="ca-due-date"
									className={submitted && dueDateError ? "label-error" : ""}
								>
									Fecha de entrega *
								</label>
								<DateInput
									id="ca-due-date"
									value={dueDate}
									onChange={setDueDate}
									variant="purple"
									hasError={submitted && !!dueDateError}
								/>
								{submitted && dueDateError && <FieldError msg={dueDateError} />}
							</div>
							<div>
								<label htmlFor="ca-hours">Horas estimadas</label>
								<input
									id="ca-hours"
									type="number"
									min={0}
									step={0.5}
									value={estimatedHours}
									onChange={(e) =>
										setEstimatedHours(e.target.value === "" ? "" : Number(e.target.value))
									}
									placeholder="0"
								/>
							</div>
						</div>

						{/* Description */}
						<div className="ca-row">
							<label htmlFor="ca-desc">Descripción</label>
							<textarea
								id="ca-desc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Añade contexto o notas relevantes..."
								rows={4}
							/>
						</div>
					</div>

					{/* ---- RIGHT COLUMN ---- */}
					<div className="ca-col-right">
						<div className="ca-col-heading">
							<span className="ca-col-heading-dot green" />
							<span>Subtareas</span>
							{subtasks.length > 0 && (
								<span
									style={{
										marginLeft: "auto",
										fontSize: "11px",
										fontWeight: 700,
										color: atMax ? "rgba(251,146,60,0.8)" : "rgba(255,255,255,0.25)",
									}}
								>
									{subtasks.length}/{MAX_SUBTASKS}
								</span>
							)}
						</div>

						{/* Subform */}
						<div className="ca-subform">
							<div className="ca-subform-grid">
								{/* Name — full width */}
								<div className="ca-subform-field full">
									<label htmlFor="st-title">¿Qué debes hacer?</label>
									<input
										id="st-title"
										value={stTitle}
										onChange={(e) => setStTitle(e.target.value)}
										placeholder="Nombre de la subtarea"
										disabled={atMax}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddSubtask();
											}
										}}
									/>
									{stSubmitted && stTitleError && <FieldError msg={stTitleError} />}
								</div>

								{/* Target date */}
								<div className="ca-subform-field">
									<label>Fecha objetivo</label>
									<DateInput value={stDate} onChange={setStDate} variant="green" />
								</div>

								{/* Hours */}
								<div className="ca-subform-field">
									<label htmlFor="st-hours">Horas estimadas</label>
									<input
										id="st-hours"
										type="number"
										min={0}
										step={0.5}
										value={stHours}
										onChange={(e) =>
											setStHours(e.target.value === "" ? "" : Number(e.target.value))
										}
										placeholder="0"
										disabled={atMax}
									/>
								</div>
							</div>

							{/* Add button or max notice */}
							{atMax ? (
								<div className="ca-subform-max">
									<AlertTriangle size={13} />
									Límite de {MAX_SUBTASKS} subtareas alcanzado
								</div>
							) : (
								<button
									type="button"
									className="ca-subform-add-btn"
									onClick={handleAddSubtask}
									disabled={atMax}
								>
									<Plus size={14} />
									Añadir subtarea
								</button>
							)}
						</div>

						{/* Table */}
						<div className="ca-subtask-table-wrap">
							{subtasks.length === 0 ? (
								<div className="ca-subtask-empty">
									<div className="ca-subtask-empty-icon">
										<Layers size={16} />
									</div>
									<p>
										Las subtareas que añadas
										<br />
										aparecerán aquí
									</p>
								</div>
							) : (
								<table className="ca-subtask-table">
									<thead>
										<tr>
											<th style={{ width: 24 }} />
											<th className="th-center" style={{ width: 36 }}>
												#
											</th>
											<th>Título</th>
											<th>Fecha</th>
											<th>Horas</th>
											<th style={{ width: 36 }} />
										</tr>
									</thead>
									<tbody>
										{subtasks.map((st, idx) => (
											<tr
												key={st.id}
												draggable
												onDragStart={(e) => handleDragStart(e, idx)}
												onDragEnter={() => handleDragEnter(idx)}
												onDragOver={(e) => e.preventDefault()}
												onDrop={(e) => handleDrop(e, idx)}
												onDragEnd={handleDragEnd}
												className={[
													dragIndex.current === idx ? "row-dragging" : "",
													dragOverIndex === idx && dragIndex.current !== idx ? "row-drag-over" : "",
												]
													.filter(Boolean)
													.join(" ")}
											>
												<td className="col-drag" title="Arrastra para reordenar">
													<GripVertical size={14} />
												</td>
												<td className="col-order">
													<span className="ca-order-badge">{idx + 1}</span>
												</td>
												<td className="col-title">{st.title}</td>
												<td className="col-date">
													<span className="ca-pill">{formatDate(st.target_date)}</span>
												</td>
												<td className="col-hours">
													{st.estimated_hours !== "" && (
														<span className="ca-pill">{st.estimated_hours}h</span>
													)}
												</td>
												<td className="col-delete">
													<button
														type="button"
														onClick={() => handleDeleteSubtask(st.id)}
														aria-label="Eliminar subtarea"
													>
														<Trash2 size={12} />
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>

						{/* Buttons — anchored inside right column */}
						<div className="ca-col-actions">
							{submitted && missingCount > 0 && (
								<span className="ca-footer-hint">
									<AlertTriangle size={13} />
									{missingCount === 1
										? "Falta 1 campo obligatorio"
										: `Faltan ${missingCount} campos obligatorios`}
								</span>
							)}
							<div className="ca-footer-actions">
								<button type="button" className="btn btn-ghost" onClick={onClose}>
									Cancelar
								</button>
								<button type="button" className="btn btn-primary" onClick={handleSubmit}>
									Crear actividad
								</button>
							</div>
						</div>
					</div>
				</form>
			</div>
		</div>
	);

	if (typeof document !== "undefined") return createPortal(modal, document.body);
	return modal;
}
