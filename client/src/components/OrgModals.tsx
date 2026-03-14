import { useState, useEffect, useRef, useMemo } from "react";
import { X, BookOpen, Loader2, CheckCircle2, Pencil } from "lucide-react";
import { type Activity } from "../api/dashboard";
import { useTheme } from "../hooks/useTheme";
import "./Dashboard.css";

interface SubjectFormModalProps {
	mode: "add" | "rename";
	current?: string;
	isLoading?: boolean;
	onClose: () => void;
	onConfirm: (name: string) => void;
}
export function SubjectFormModal({
	mode,
	current,
	isLoading = false,
	onClose,
	onConfirm,
}: SubjectFormModalProps) {
	const { isDark } = useTheme();
	const [value, setValue] = useState(current ?? "");
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		setTimeout(() => inputRef.current?.focus(), 30);
	}, []);

	function submit() {
		const name = value.trim();
		if (!name) return;
		onConfirm(name);
	}

	const modalBg = isDark
		? "linear-gradient(155deg,#141f35 0%,#0f172a 55%,#09111e 100%)"
		: "linear-gradient(155deg,#f8f5ff 0%,#f0ecfb 60%,#ebe5f7 100%)";
	const modalBdr = isDark ? "#1e293b" : "rgba(124,92,255,0.2)";
	const inputBg = isDark ? "#0f172a" : "#ffffff";
	const inputBdr = isDark ? "#334155" : "rgba(124,92,255,0.22)";
	const inputClr = isDark ? "#f1f5f9" : "#1e1a33";
	const titleClr = isDark ? "#f1f5f9" : "#1e1a33";
	const subtitleClr = isDark ? "#64748b" : "#7a62c9";
	const cancelBdr = isDark ? "#334155" : "rgba(124,92,255,0.22)";
	const cancelClr = isDark ? "#94a3b8" : "#7a62c9";

	return (
		<div
			onClick={(e) => e.stopPropagation()}
			style={{
				fontFamily: "inherit",
				position: "relative",
				background: modalBg,
				border: `1px solid ${modalBdr}`,
				borderRadius: "16px",
				padding: "24px 28px 20px",
				width: "400px",
				display: "flex",
				flexDirection: "column",
				gap: "16px",
				boxShadow:
					"0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(124,92,255,0.04), 0 0 0 1px rgba(124,92,255,0.06)",
				animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
				overflow: "hidden",
			}}
		>
			{/* Single soft bloom — wider ellipse, no hard edge */}
			<div
				style={{
					position: "absolute",
					top: "-20px",
					left: "-20px",
					right: "-20px",
					height: "180px",
					background:
						"radial-gradient(ellipse 85% 60% at 50% 0%, rgba(124,92,255,0.18) 0%, rgba(124,92,255,0.06) 50%, transparent 100%)",
					pointerEvents: "none",
					zIndex: 1,
				}}
			/>

			{/* Header */}
			<div
				style={{
					position: "relative",
					zIndex: 2,
					display: "flex",
					alignItems: "center",
					gap: "12px",
				}}
			>
				{/* Icon square */}
				<div
					style={{
						width: "42px",
						height: "42px",
						flexShrink: 0,
						borderRadius: "13px",
						background: "linear-gradient(135deg,rgba(124,92,255,0.25),rgba(167,139,250,0.1))",
						border: "1px solid rgba(124,92,255,0.25)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#c084fc",
						boxShadow: "0 0 20px rgba(124,92,255,0.18)",
					}}
				>
					<BookOpen size={20} />
				</div>
				{/* Title + subtitle */}
				<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
					<h3
						style={{
							color: titleClr,
							fontWeight: 700,
							fontSize: "16px",
							margin: 0,
						}}
					>
						{mode === "add" ? "Nueva materia" : "Renombrar materia"}
					</h3>
					<p style={{ margin: 0, fontSize: "12px", color: subtitleClr }}>
						{mode === "add"
							? "Agrupa tus actividades por asignatura"
							: "Escribe el nuevo nombre para esta materia"}
					</p>
				</div>
				<button onClick={onClose} className="modal-close-x" aria-label="Cerrar">
					<X size={15} />
				</button>
			</div>
			<input
				ref={inputRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Nombre de la materia"
				onKeyDown={(e) => {
					if (e.key === "Enter") submit();
					if (e.key === "Escape") onClose();
				}}
				style={{
					fontFamily: "inherit",
					background: inputBg,
					border: `1px solid ${inputBdr}`,
					borderRadius: "8px",
					padding: "10px 14px",
					color: inputClr,
					fontSize: "14px",
					outline: "none",
					transition: "border-color 0.15s",
				}}
				onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
				onBlur={(e) => (e.currentTarget.style.borderColor = inputBdr)}
			/>
			<div style={{ display: "flex", gap: "8px" }}>
				<button
					onClick={submit}
					disabled={isLoading}
					className="modal-btn-primary"
					style={{
						flex: 1,
						padding: "10px 14px",
						borderRadius: "8px",
						border: "none",
						cursor: isLoading ? "wait" : "pointer",
						fontFamily: "inherit",
						fontSize: "13px",
						fontWeight: 700,
						background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
						color: "#fff",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "6px",
						boxShadow: "0 4px 14px rgba(124,58,237,0.28)",
						opacity: isLoading ? 0.7 : 1,
					}}
				>
					{isLoading ? <Loader2 size={13} className="spinner" /> : null}
					{isLoading ? "Guardando..." : mode === "add" ? "Guardar" : "Renombrar"}
				</button>
				<button
					onClick={onClose}
					className="modal-btn-cancel"
					style={{
						padding: "10px 18px",
						borderRadius: "8px",
						border: `1px solid ${cancelBdr}`,
						cursor: "pointer",
						fontFamily: "inherit",
						fontSize: "13px",
						fontWeight: 600,
						background: "transparent",
						color: cancelClr,
					}}
				>
					Cancelar
				</button>
			</div>
		</div>
	);
}

/* ---- EditActivityForm ---- */
interface EditActivityFormProps {
	activity: Activity;
	subjects: string[];
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
	onClose: () => void;
	onSave: (
		id: number,
		payload: Partial<
			Pick<Activity, "title" | "description" | "due_date" | "status" | "course_name">
		>,
	) => Promise<void>;
}
export function EditActivityForm({
	activity,
	subjects,
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
	onClose,
	onSave,
}: EditActivityFormProps) {
	const [title, setTitle] = useState(activity.title);
	const [description, setDescription] = useState(activity.description || "");
	const [dueDate, setDueDate] = useState(activity.due_date);
	const [status, setStatus] = useState<Activity["status"]>(activity.status);
	const [courseName, setCourseName] = useState(activity.course_name || "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const { isDark } = useTheme();

	const eaModalBg = isDark
		? "linear-gradient(155deg,#141f35 0%,#0f172a 55%,#09111e 100%)"
		: "linear-gradient(155deg,#f8f5ff 0%,#f0ecfb 60%,#ebe5f7 100%)";
	const eaModalBdr = isDark ? "#1e293b" : "rgba(124,92,255,0.2)";
	const eaTitleClr = isDark ? "#f1f5f9" : "#1e1a33";
	const eaLabelClr = isDark ? "#64748b" : "#7a62c9";
	const eaCancelBdr = isDark ? "#334155" : "rgba(124,92,255,0.22)";
	const eaCancelClr = isDark ? "#94a3b8" : "#7a62c9";
	const conflictDateSet = useMemo(() => new Set(conflictDates), [conflictDates]);
	const selectedDateLoad = dueDate ? (dateLoadMap[dueDate] ?? 0) : 0;
	const dueDateHasConflict =
		!!dueDate &&
		(conflictDateSet.has(dueDate) || (maxDailyHours > 0 && selectedDateLoad > maxDailyHours));
	const dueDateCapacityPercent =
		maxDailyHours > 0 ? Math.min((selectedDateLoad / maxDailyHours) * 100, 100) : 0;

	const fld: React.CSSProperties = {
		fontFamily: "inherit",
		background: isDark ? "#0f172a" : "#ffffff",
		border: `1px solid ${isDark ? "#334155" : "rgba(124,92,255,0.22)"}`,
		borderRadius: "8px",
		padding: "10px 14px",
		color: isDark ? "#f1f5f9" : "#1e1a33",
		fontSize: "14px",
		outline: "none",
		width: "100%",
		boxSizing: "border-box",
	};

	function formatHours(value: number): string {
		if (!Number.isFinite(value)) return "0";
		return Number.isInteger(value)
			? String(value)
			: value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
	}

	async function handleSubmit() {
		if (!title.trim()) {
			setError("El título es obligatorio.");
			return;
		}
		setSaving(true);
		try {
			await onSave(activity.id, {
				title: title.trim(),
				description: description.trim(),
				due_date: dueDate,
				status,
				course_name: courseName,
			});
		} catch {
			setError("Error al guardar. Intenta de nuevo.");
			setSaving(false);
		}
	}

	return (
		<div
			onClick={(e) => e.stopPropagation()}
			style={{
				fontFamily: "inherit",
				position: "relative",
				background: eaModalBg,
				border: `1px solid ${eaModalBdr}`,
				borderRadius: "16px",
				padding: "24px 28px 20px",
				width: "480px",
				maxHeight: "88vh",
				overflowY: "auto",
				display: "flex",
				flexDirection: "column",
				gap: "18px",
				boxShadow: "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(124,92,255,0.03)",
				animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
			}}
		>
			<div className="modal-glow-line" />
			<div className="modal-glow-halo" />
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<div
						style={{
							width: "30px",
							height: "30px",
							borderRadius: "8px",
							background: "rgba(192,132,252,0.12)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Pencil size={14} color="#c084fc" />
					</div>
					<p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: eaTitleClr }}>
						Editar actividad
					</p>
				</div>
				<button onClick={onClose} className="modal-close-x" aria-label="Cerrar">
					<X size={15} />
				</button>
			</div>
			{error && (
				<p
					style={{
						color: "#f87171",
						fontSize: "13px",
						margin: 0,
						padding: "8px 12px",
						background: "rgba(239,68,68,0.1)",
						borderRadius: "6px",
					}}
				>
					{error}
				</p>
			)}
			<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
				<span
					style={{
						color: eaLabelClr,
						fontSize: "11px",
						fontWeight: 700,
						textTransform: "uppercase",
						letterSpacing: "0.06em",
					}}
				>
					Título *
				</span>
				<input value={title} onChange={(e) => setTitle(e.target.value)} style={fld} />
			</label>
			<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
				<span
					style={{
						color: eaLabelClr,
						fontSize: "11px",
						fontWeight: 700,
						textTransform: "uppercase",
						letterSpacing: "0.06em",
					}}
				>
					Descripción
				</span>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					rows={3}
					style={{ ...fld, resize: "vertical" as const }}
				/>
			</label>
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
				<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
					<span
						style={{
							color: eaLabelClr,
							fontSize: "11px",
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: "0.06em",
						}}
					>
						Fecha límite
					</span>
					<input
						type="date"
						value={dueDate}
						onChange={(e) => setDueDate(e.target.value)}
						style={fld}
					/>
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
									: isDark
										? "rgba(124,92,255,0.08)"
										: "rgba(124,92,255,0.07)",
							}}
						>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									gap: "8px",
									fontSize: "11px",
									color: isDark ? "#cbd5e1" : "#5b4a8e",
									fontWeight: 600,
								}}
							>
								<span>Capacidad para esta fecha</span>
								<strong style={{ color: dueDateHasConflict ? "#f87171" : "#7c3aed" }}>
									{maxDailyHours > 0
										? `${formatHours(selectedDateLoad)}h / ${formatHours(maxDailyHours)}h`
										: `${formatHours(selectedDateLoad)}h`}
								</strong>
							</div>
							{maxDailyHours > 0 && (
								<div
									style={{
										marginTop: "6px",
										height: "6px",
										borderRadius: "999px",
										background: isDark ? "rgba(148,163,184,0.22)" : "rgba(124,92,255,0.14)",
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
											transition: "width 320ms cubic-bezier(0.22,1,0.36,1), background 220ms ease",
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
									color: dueDateHasConflict ? "#ef4444" : isDark ? "#a78bfa" : "#6d28d9",
								}}
							>
								{dueDateHasConflict
									? "Hay un conflicto de carga para esta fecha. Puedes guardar y resolverlo despues en Conflictos."
									: "No hay conflicto detectado para esa fecha."}
							</p>
						</div>
					)}
				</label>
				<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
					<span
						style={{
							color: eaLabelClr,
							fontSize: "11px",
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: "0.06em",
						}}
					>
						Estado
					</span>
					<select
						value={status}
						onChange={(e) => setStatus(e.target.value as Activity["status"])}
						style={{ ...fld, appearance: "none" as const }}
					>
						<option value="pending">Pendiente</option>
						<option value="in_progress">En progreso</option>
						<option value="completed">Completado</option>
					</select>
				</label>
			</div>
			<label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
				<span
					style={{
						color: eaLabelClr,
						fontSize: "11px",
						fontWeight: 700,
						textTransform: "uppercase",
						letterSpacing: "0.06em",
					}}
				>
					Materia
				</span>
				<input
					value={courseName}
					onChange={(e) => setCourseName(e.target.value)}
					list="edit-act-subj"
					placeholder="Sin materia"
					style={fld}
				/>
				<datalist id="edit-act-subj">
					{subjects.map((s) => (
						<option key={s} value={s} />
					))}
				</datalist>
			</label>
			<div style={{ display: "flex", gap: "8px" }}>
				<button
					onClick={handleSubmit}
					disabled={saving}
					className="modal-btn-primary"
					style={{
						flex: 1,
						padding: "10px 14px",
						borderRadius: "8px",
						border: "none",
						cursor: saving ? "wait" : "pointer",
						fontSize: "13px",
						fontWeight: 700,
						background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
						color: "#fff",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "7px",
						opacity: saving ? 0.7 : 1,
						boxShadow: "0 4px 14px rgba(124,58,237,0.28)",
					}}
				>
					{saving ? <Loader2 size={13} className="spinner" /> : <CheckCircle2 size={13} />}
					{saving ? "Guardando..." : "Guardar cambios"}
				</button>
				<button
					onClick={onClose}
					disabled={saving}
					className="modal-btn-cancel"
					style={{
						padding: "10px 18px",
						borderRadius: "8px",
						border: `1px solid ${eaCancelBdr}`,
						cursor: "pointer",
						fontSize: "13px",
						fontWeight: 600,
						background: "transparent",
						color: eaCancelClr,
					}}
				>
					Cancelar
				</button>
			</div>
		</div>
	);
}
