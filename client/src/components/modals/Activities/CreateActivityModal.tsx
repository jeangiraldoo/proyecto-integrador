import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
}

/* ---- Helpers ---- */
function formatDate(iso: string): string {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

function todayIso() {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatHours(value: number): string {
	if (!Number.isFinite(value)) return "0";
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

let nextId = 1;

/* ---- Custom Date Input ---- */
function DateInput({
	id,
	value,
	onChange,
	variant = "purple",
	hasError = false,
	testId,
}: {
	id?: string;
	value: string;
	onChange: (v: string) => void;
	variant?: "purple" | "green";
	hasError?: boolean;
	testId?: string;
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
			<input
				id={id}
				type="date"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				data-testid={testId}
			/>
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
		<div
			className="ca-combobox-wrapper"
			ref={wrapperRef}
			data-testid="create-activity-subject-combobox"
		>
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
					data-testid="create-activity-subject-input"
				/>
				<button
					type="button"
					className={`ca-combobox-chevron ${open ? "open" : ""}`}
					tabIndex={-1}
					data-testid="create-activity-subject-toggle-btn"
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
				<ul
					className="ca-combobox-dropdown"
					role="listbox"
					data-testid="create-activity-subject-dropdown"
				>
					{filtered.map((s, idx) => (
						<li
							key={s}
							role="option"
							aria-selected={idx === activeIdx}
							className={`ca-combobox-option ${idx === activeIdx ? "highlighted" : ""}`}
							data-testid={`create-activity-subject-option-${idx}`}
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
							data-testid="create-activity-subject-add-option"
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
	initialSubject,
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
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
		// initialSubject is intentionally read only when `open` changes (seed on open)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	function clearAll() {
		setStep(1);
		setSlideDir("forward");
		setAnimKey(0);
		setSubject("");
		setTitle("");
		setDescription("");
		setDueDate("");
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
	const conflictDateSet = useMemo(() => new Set(conflictDates), [conflictDates]);
	const dueDateBaseLoad = dueDate ? (dateLoadMap[dueDate] ?? 0) : 0;
	const dueDateDraftLoad = dueDate
		? subtasks.reduce((sum, subtask) => {
				if (subtask.target_date !== dueDate) return sum;
				return sum + Number(subtask.estimated_hours || 0);
			}, 0)
		: 0;
	const dueDateProjectedLoad = dueDateBaseLoad + dueDateDraftLoad;
	const dueDateHasConflict =
		!!dueDate &&
		(conflictDateSet.has(dueDate) || (maxDailyHours > 0 && dueDateProjectedLoad > maxDailyHours));
	const dueDateCapacityPercent =
		maxDailyHours > 0 ? Math.min((dueDateProjectedLoad / maxDailyHours) * 100, 100) : 0;

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
			data-testid="create-activity-modal"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="ca-modal" data-testid="create-activity-modal-card">
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
					<button
						className="ca-close"
						onClick={onClose}
						aria-label="Cerrar"
						data-testid="create-activity-close-btn"
					>
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

								<div className="ca-row split">
									<div>
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
											data-testid="create-activity-title-input"
										/>
										{step1Submitted && titleError && <FieldError msg={titleError} />}
									</div>
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
											testId="create-activity-due-date-input"
										/>
										{step1Submitted && dueDateError && <FieldError msg={dueDateError} />}
										{dueDate && (
											<div
												style={{
													marginTop: "8px",
													padding: "8px 10px",
													borderRadius: "8px",
													border: dueDateHasConflict
														? "1px solid rgba(248,113,113,0.35)"
														: "1px solid rgba(124,92,255,0.2)",
													background: dueDateHasConflict
														? "rgba(248,113,113,0.08)"
														: "rgba(124,92,255,0.08)",
												}}
											>
												<div
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														gap: "8px",
														fontSize: "11px",
														color: "#cbd5e1",
														fontWeight: 600,
													}}
												>
													<span>Capacidad para {formatDate(dueDate)}</span>
													<strong style={{ color: dueDateHasConflict ? "#fca5a5" : "#c4b5fd" }}>
														{maxDailyHours > 0
															? `${formatHours(dueDateProjectedLoad)}h / ${formatHours(maxDailyHours)}h`
															: `${formatHours(dueDateProjectedLoad)}h`}
													</strong>
												</div>
												{maxDailyHours > 0 && (
													<div
														style={{
															marginTop: "6px",
															height: "6px",
															borderRadius: "999px",
															background: "rgba(148,163,184,0.22)",
															overflow: "hidden",
														}}
													>
														<div
															style={{
																height: "100%",
																width: `${dueDateCapacityPercent}%`,
																background: dueDateHasConflict
																	? "linear-gradient(90deg,#ef4444,#f97316)"
																	: "linear-gradient(90deg,#7c3aed,#a78bfa)",
																transition:
																	"width 320ms cubic-bezier(0.22,1,0.36,1), background 220ms ease",
																willChange: "width",
															}}
														/>
													</div>
												)}
												<p
													style={{
														margin: "7px 0 0",
														fontSize: "11px",
														lineHeight: 1.35,
														color: dueDateHasConflict ? "#fca5a5" : "#a78bfa",
													}}
												>
													{dueDateHasConflict
														? "Hay un conflicto de carga para esa fecha. Puedes continuar y resolverlo despues en Conflictos."
														: dueDateDraftLoad > 0
															? `Incluye ${formatHours(dueDateDraftLoad)}h nuevas de tus subtareas.`
															: "Sin conflicto detectado para esa fecha."}
												</p>
											</div>
										)}
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
										data-testid="create-activity-description-input"
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
												data-testid="create-activity-subtask-title-input"
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
											<DateInput
												value={stDate}
												onChange={setStDate}
												variant="green"
												testId="create-activity-subtask-date-input"
											/>
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
												data-testid="create-activity-subtask-hours-input"
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
											data-testid="create-activity-add-subtask-btn"
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
										<table
											className="ca-subtask-table"
											data-testid="create-activity-subtasks-table"
										>
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
														data-testid={`create-activity-subtask-row-${st.id}`}
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
																data-testid={`create-activity-subtask-delete-btn-${st.id}`}
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
									data-testid="create-activity-cancel-btn-step-1"
								>
									Cancelar
								</button>
								<button
									type="button"
									className="btn btn-primary"
									onClick={goNext}
									data-testid="create-activity-next-btn"
								>
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
									data-testid="create-activity-back-btn"
								>
									← Volver
								</button>
								<div className="ca-footer-right">
									<button
										type="button"
										className="btn btn-ghost"
										onClick={onClose}
										disabled={submitting}
										data-testid="create-activity-cancel-btn-step-2"
									>
										Cancelar
									</button>
									<button
										type="button"
										className="btn btn-primary"
										onClick={handleSubmit}
										disabled={submitting}
										data-testid="create-activity-submit-btn"
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
