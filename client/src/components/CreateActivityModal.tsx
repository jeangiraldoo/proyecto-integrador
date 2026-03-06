import { useState, useEffect, useRef, useCallback } from "react";
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
	Loader2,
	Check,
	ChevronDown,
	PlusCircle,
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
	subject: string;
	title: string;
	description?: string;
	due_date: string;
	total_estimated_hours?: number;
	subtasks: Omit<Subtask, "id">[];
}

interface Props {
	open: boolean;
	initialSubject?: string;
	onClose: () => void;
	onCreate: (payload: NewActivityPayload) => Promise<void>;
	knownSubjects?: string[];
}

/* ---- Helpers ---- */
function formatDate(iso: string): string {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

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

/* ---- Subject Combobox ---- */
function SubjectCombobox({
	value,
	onChange,
	knownSubjects,
	hasError,
}: {
	value: string;
	onChange: (v: string) => void;
	knownSubjects: string[];
	hasError: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [activeIdx, setActiveIdx] = useState(-1);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const query = value.trim().toLowerCase();
	const filtered = knownSubjects.filter((s) => s.toLowerCase().includes(query));
	const exactMatch = knownSubjects.some((s) => s.toLowerCase() === query);
	const showAdd = query.length > 0 && !exactMatch;

	// Close on outside click
	useEffect(() => {
		function handler(e: MouseEvent) {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
				setOpen(false);
				setActiveIdx(-1);
			}
		}
		if (open) document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	// Reset active when query changes

	const select = useCallback(
		(val: string) => {
			onChange(val);
			setOpen(false);
			setActiveIdx(-1);
		},
		[onChange],
	);

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!open) {
			if (e.key === "ArrowDown") {
				setOpen(true);
				e.preventDefault();
			}
			return;
		}
		const totalItems = filtered.length + (showAdd ? 1 : 0);
		if (e.key === "ArrowDown") {
			setActiveIdx((i) => (i + 1) % totalItems);
			e.preventDefault();
		} else if (e.key === "ArrowUp") {
			setActiveIdx((i) => (i - 1 + totalItems) % totalItems);
			e.preventDefault();
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (activeIdx >= 0 && activeIdx < filtered.length) {
				select(filtered[activeIdx]);
			} else if (activeIdx === filtered.length && showAdd) {
				// "Añadir" option selected via keyboard
				select(value.trim());
			} else if (value.trim()) {
				select(value.trim());
			}
		} else if (e.key === "Escape") {
			setOpen(false);
			setActiveIdx(-1);
		}
	}

	const dropdownVisible = open && (filtered.length > 0 || showAdd);

	return (
		<div className="ca-combobox-wrapper" ref={wrapperRef}>
			<div className={`ca-combobox-input-row ${hasError ? "input-error" : ""}`}>
				<input
					ref={inputRef}
					type="text"
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setActiveIdx(-1);
						setOpen(true);
					}}
					onFocus={() => {
						if (value.trim()) setOpen(true);
					}}
					onKeyDown={handleKeyDown}
					placeholder="Ej. Cálculo III, Redes, Bases de Datos..."
					autoComplete="off"
					className="ca-combobox-input"
				/>
				<button
					type="button"
					className={`ca-combobox-chevron ${open ? "open" : ""}`}
					tabIndex={-1}
					onMouseDown={(e) => {
						e.preventDefault();
						if (open) {
							setOpen(false);
						} else {
							inputRef.current?.focus();
							setOpen(true);
						}
					}}
				>
					<ChevronDown size={14} />
				</button>
			</div>

			{dropdownVisible && (
				<ul className="ca-combobox-dropdown" role="listbox">
					{filtered.map((s, idx) => (
						<li
							key={s}
							role="option"
							aria-selected={idx === activeIdx}
							className={`ca-combobox-option ${idx === activeIdx ? "highlighted" : ""}`}
							onMouseDown={(e) => {
								e.preventDefault();
								select(s);
							}}
						>
							{s}
						</li>
					))}
					{showAdd && (
						<li
							role="option"
							aria-selected={activeIdx === filtered.length}
							className={`ca-combobox-option ca-combobox-add ${
								activeIdx === filtered.length ? "highlighted" : ""
							}`}
							onMouseDown={(e) => {
								e.preventDefault();
								select(value.trim());
							}}
						>
							<PlusCircle size={13} />
							<span>Añadir &ldquo;{value.trim()}&rdquo;</span>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}

/* ---- Wizard Stepper ---- */
function WizardStepper({ step }: { step: 1 | 2 }) {
	return (
		<div className="ca-stepper">
			<div className={`ca-step-item ${step === 1 ? "active" : "done"}`}>
				<div className="ca-step-circle">
					{step > 1 ? <Check size={13} strokeWidth={3} /> : <span>1</span>}
				</div>
				<span className="ca-step-label">Información general</span>
			</div>

			<div className={`ca-step-connector ${step > 1 ? "done" : ""}`} />

			<div className={`ca-step-item ${step === 2 ? "active" : "idle"}`}>
				<div className="ca-step-circle">
					<span>2</span>
				</div>
				<span className="ca-step-label">Subtareas (Opcional)</span>
			</div>
		</div>
	);
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function CreateActivityModal({
	open,
	onClose,
	onCreate,
	knownSubjects = [],
}: Props) {
	/* Wizard */
	const [step, setStep] = useState<1 | 2>(1);
	const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
	const [animKey, setAnimKey] = useState(0);

	/* Main form */
	const [subject, setSubject] = useState("");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [estimatedHours, setEstimatedHours] = useState<number | string>("");

	/* Validation */
	const [step1Submitted, setStep1Submitted] = useState(false);
	const [step2Submitted, setStep2Submitted] = useState(false);

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

	/* Submitting */
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!open) {
			clearAll();
		} else if (initialSubject) {
			setSubject(initialSubject);
		}
	}, [open, initialSubject]);

	function clearAll() {
		setStep(1);
		setSlideDir("forward");
		setAnimKey(0);
		setSubject("");
		setTitle("");
		setDescription("");
		setDueDate("");
		setEstimatedHours("");
		setStTitle("");
		setStDate("");
		setStHours("");
		setSubtasks([]);
		setStep1Submitted(false);
		setStep2Submitted(false);
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

	const step1Valid = !subjectError && !titleError && !dueDateError;
	const missingCount = (subjectError ? 1 : 0) + (titleError ? 1 : 0) + (dueDateError ? 1 : 0);

	/* suppress unused warning */
	void step2Submitted;

	/* ---- Navigation ---- */
	function goNext() {
		setStep1Submitted(true);
		if (!step1Valid) return;
		setSlideDir("forward");
		setAnimKey((k) => k + 1);
		setStep(2);
	}

	function goBack() {
		setSlideDir("back");
		setAnimKey((k) => k + 1);
		setStep(1);
	}

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
	async function handleSubmit() {
		setStep2Submitted(true);

		const payload: NewActivityPayload = {
			subject: subject.trim(),
			title: title.trim(),
			description: description.trim(),
			due_date: dueDate,
			total_estimated_hours: estimatedHours === "" ? 0 : Number(estimatedHours),
			subtasks: subtasks.map(({ title, target_date, estimated_hours }) => ({
				title,
				target_date,
				estimated_hours,
			})),
		};

		try {
			setSubmitting(true);
			await onCreate(payload);
			clearAll();
			onClose();
		} catch (err) {
			console.error("Create failed in modal:", err);
		} finally {
			setSubmitting(false);
		}
	}

	const atMax = subtasks.length >= MAX_SUBTASKS;

	if (!open) return null;

	const slideClass = slideDir === "forward" ? "ca-step-slide-forward" : "ca-step-slide-back";

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

				{/* ====== STEPPER ====== */}
				<WizardStepper step={step} />

				{/* ====== STEP CONTENT ====== */}
				<div className="ca-wizard-body">
					<div key={animKey} className={`ca-step-content ${slideClass}`}>
						{/* --z-- STEP 1: General Info ---- */}
						{step === 1 && (
							<div className="ca-step-panel">
								<div className="ca-row">
									<label className={step1Submitted && subjectError ? "label-error" : ""}>
										Materia {step1Submitted && subjectError ? "·" : "*"}
									</label>
									<SubjectCombobox
										value={subject}
										onChange={setSubject}
										knownSubjects={knownSubjects}
										hasError={step1Submitted && !!subjectError}
									/>
									{step1Submitted && subjectError && <FieldError msg={subjectError} />}
								</div>

								<div className="ca-row">
									<label
										htmlFor="ca-title"
										className={step1Submitted && titleError ? "label-error" : ""}
									>
										Título {step1Submitted && titleError ? "·" : "*"}
									</label>
									<input
										id="ca-title"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										placeholder="¿Qué vas a hacer?"
										className={step1Submitted && titleError ? "input-error" : ""}
									/>
									{step1Submitted && titleError && <FieldError msg={titleError} />}
								</div>

								<div className="ca-row split">
									<div>
										<label
											htmlFor="ca-due-date"
											className={step1Submitted && dueDateError ? "label-error" : ""}
										>
											Fecha de entrega *
										</label>
										<DateInput
											id="ca-due-date"
											value={dueDate}
											onChange={setDueDate}
											variant="purple"
											hasError={step1Submitted && !!dueDateError}
										/>
										{step1Submitted && dueDateError && <FieldError msg={dueDateError} />}
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
						)}

						{/* ---- STEP 2: Subtasks ---- */}
						{step === 2 && (
							<div className="ca-step-panel">
								<div className="ca-subform">
									<div className="ca-col-heading" style={{ marginBottom: 4 }}>
										<span className="ca-col-heading-dot green" />
										<span>Añadir subtarea</span>
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

									<div className="ca-subform-grid">
										<div className="ca-subform-field full">
											<label htmlFor="st-title">¿Qué debes hacer?</label>
											<input
												id="st-title"
												value={stTitle}
												onChange={(e) => setStTitle(e.target.value)}
												placeholder="Nombre de la subtarea"
												disabled={atMax}
												autoFocus
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														handleAddSubtask();
													}
												}}
											/>
											{stSubmitted && stTitleError && <FieldError msg={stTitleError} />}
										</div>

										<div className="ca-subform-field">
											<label>Fecha objetivo</label>
											<DateInput value={stDate} onChange={setStDate} variant="green" />
										</div>

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
															dragOverIndex === idx && dragIndex.current !== idx
																? "row-drag-over"
																: "",
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
							</div>
						)}
					</div>
				</div>

				{/* ====== FOOTER ====== */}
				<div className="ca-wizard-footer">
					<div className="ca-footer-hints">
						{step === 1 && step1Submitted && missingCount > 0 && (
							<span className="ca-footer-hint">
								<AlertTriangle size={13} />
								{missingCount === 1
									? "Falta 1 campo obligatorio"
									: `Faltan ${missingCount} campos obligatorios`}
							</span>
						)}
					</div>

					<div className="ca-footer-actions">
						{step === 1 ? (
							<>
								<button
									type="button"
									className="btn btn-ghost"
									onClick={onClose}
									disabled={submitting}
								>
									Cancelar
								</button>
								<button type="button" className="btn btn-primary" onClick={goNext}>
									Siguiente →
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									className="btn btn-ghost btn-back"
									onClick={goBack}
									disabled={submitting}
								>
									← Volver
								</button>
								<div className="ca-footer-right">
									<button
										type="button"
										className="btn btn-ghost"
										onClick={onClose}
										disabled={submitting}
									>
										Cancelar
									</button>
									<button
										type="button"
										className="btn btn-primary"
										onClick={handleSubmit}
										disabled={submitting}
									>
										{submitting ? (
											<>
												<Loader2 size={14} className="spin" /> Procesando...
											</>
										) : (
											"Crear actividad"
										)}
									</button>
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);

	if (typeof document !== "undefined") return createPortal(modal, document.body);
	return modal;
}
