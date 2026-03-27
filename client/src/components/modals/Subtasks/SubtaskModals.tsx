import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
	AlertTriangle,
	Plus,
	ChevronDown,
	X,
	Loader2,
	Trash2,
	CheckCircle2,
	ClipboardList,
	Pencil,
} from "lucide-react";
import { fetchTodayView, createSubtask, type Activity, type Subtask } from "@/api/dashboard";
import { toast } from "sonner";
import "@/pages/Dashboard/Dashboard.css";
import { formatDate, type KanbanState } from "@/pages/Dashboard/utils/dashboardUtils";
import { useTheme } from "@/hooks/useTheme";

function formatHours(value: number): string {
	if (!Number.isFinite(value)) return "0";
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

interface EditSubtaskModalProps {
	subtask: Subtask;
	initialName: string;
	initialHours: string;
	initialDate: string;
	initialStatus: Subtask["status"];
	initialPostponementNote?: string;
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
	setName: (v: string) => void;
	setHours: (v: string) => void;
	setDate: (v: string) => void;
	setStatus: (v: Subtask["status"]) => void;
	setPostponementNote?: (v: string) => void;
	saving: boolean;
	onSave: () => void;
	onClose: () => void;
}
export function EditSubtaskModal({
	subtask,
	initialName,
	initialHours,
	initialDate,
	initialStatus,
	initialPostponementNote = "",
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
	setName,
	setHours,
	setDate,
	setStatus,
	setPostponementNote,
	saving,
	onSave,
	onClose,
}: EditSubtaskModalProps) {
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const { isDark } = useTheme();
	const conflictDateSet = useMemo(() => new Set(conflictDates), [conflictDates]);
	const parsedHours = Number.parseFloat(initialHours);
	const draftHours = Number.isFinite(parsedHours) ? Math.max(0, parsedHours) : 0;
	const initialSubtaskHours = Number(subtask.estimated_hours) || 0;
	const countsNow = initialStatus !== "completed";
	const countedBefore = subtask.status !== "completed";
	const baseDateLoad = initialDate ? (dateLoadMap[initialDate] ?? 0) : 0;
	let projectedDateLoad = baseDateLoad;
	if (countedBefore && subtask.target_date === initialDate) {
		projectedDateLoad -= initialSubtaskHours;
	}
	if (countsNow) {
		projectedDateLoad += draftHours;
	}
	projectedDateLoad = Math.max(0, projectedDateLoad);
	const hasConflictOnDate =
		!!initialDate &&
		(conflictDateSet.has(initialDate) || (maxDailyHours > 0 && projectedDateLoad > maxDailyHours));
	const capacityPercent =
		maxDailyHours > 0 ? Math.min((projectedDateLoad / maxDailyHours) * 100, 100) : 0;

	const smModalBg = isDark
		? "linear-gradient(152deg,#0c1731 0%,#14274f 34%,#101f40 66%,#0a132a 100%)"
		: "linear-gradient(152deg,#f7f3ff 0%,#efe9ff 34%,#ece6ff 66%,#e8e2ff 100%)";
	const smModalBdr = isDark ? "#1e293b" : "rgba(124,92,255,0.2)";
	const smTitleClr = isDark ? "#f1f5f9" : "#1e1a33";
	const smSubClr = isDark ? "#64748b" : "#7a62c9";
	const smCancelBdr = isDark ? "#334155" : "rgba(124,92,255,0.22)";
	const smCancelClr = isDark ? "#94a3b8" : "#7a62c9";

	const labelStyle: React.CSSProperties = {
		display: "block",
		fontSize: "11px",
		fontWeight: 700,
		color: isDark ? "#94a3b8" : "#7a62c9",
		textTransform: "uppercase",
		letterSpacing: "0.06em",
		marginBottom: "6px",
	};
	const inputStyle: React.CSSProperties = {
		width: "100%",
		background: isDark ? "#0f172a" : "#ffffff",
		border: `1px solid ${isDark ? "#334155" : "rgba(124,92,255,0.22)"}`,
		borderRadius: "7px",
		padding: "9px 12px",
		fontSize: "14px",
		color: isDark ? "#f1f5f9" : "#1e1a33",
		outline: "none",
		boxSizing: "border-box",
		transition: "border-color 0.15s",
	};

	return createPortal(
		<>
			{/* Backdrop */}
			<div
				onClick={onClose}
				data-testid="edit-subtask-backdrop"
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(4,3,12,0.72)",
					backdropFilter: "blur(14px) saturate(150%)",
					WebkitBackdropFilter: "blur(14px) saturate(150%)",
					zIndex: 2200,
					animation: "fadeInBackdrop 0.18s ease",
				}}
			/>
			{/* Dialog */}
			<div
				data-testid="edit-subtask-layer"
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 2201,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "20px",
				}}
			>
				<div
					data-testid="edit-subtask-modal"
					style={{
						position: "relative",
						background: smModalBg,
						border: `1px solid ${smModalBdr}`,
						borderRadius: "16px",
						width: "100%",
						maxWidth: "440px",
						boxShadow: "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(124,92,255,0.03)",
						animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
					}}
				>
					<div className="modal-glow-line" />
					<div className="modal-glow-halo" />
					{/* Header */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "18px 20px 14px",
							borderBottom: `1px solid ${smModalBdr}`,
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<div
								style={{
									width: "32px",
									height: "32px",
									borderRadius: "8px",
									background: "rgba(192,132,252,0.12)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Pencil size={15} color="#c084fc" />
							</div>
							<div>
								<p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: smTitleClr }}>
									Editar tarea
								</p>
								<p
									style={{
										margin: 0,
										fontSize: "11px",
										color: smSubClr,
										marginTop: "1px",
										maxWidth: "260px",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{subtask.name}
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="modal-close-x"
							aria-label="Cerrar"
							data-testid="edit-subtask-close-btn"
						>
							<X size={15} />
						</button>
					</div>
					{/* Body */}
					<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
						<div>
							<label style={labelStyle}>Nombre</label>
							<input
								style={inputStyle}
								value={initialName}
								onChange={(e) => setName(e.target.value)}
								maxLength={200}
								autoFocus
								data-testid="edit-subtask-name-input"
								onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
								onBlur={(e) =>
									(e.currentTarget.style.borderColor = isDark ? "#334155" : "rgba(124,92,255,0.22)")
								}
							/>
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
							<div>
								<label style={labelStyle}>Horas est.</label>
								<input
									style={inputStyle}
									type="number"
									min="0"
									step="0.5"
									value={initialHours}
									onChange={(e) => setHours(e.target.value)}
									data-testid="edit-subtask-hours-input"
									onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
									onBlur={(e) =>
										(e.currentTarget.style.borderColor = isDark
											? "#334155"
											: "rgba(124,92,255,0.22)")
									}
								/>
							</div>
							<div>
								<label style={labelStyle}>Fecha límite</label>
								<input
									style={inputStyle}
									type="date"
									value={initialDate}
									onChange={(e) => setDate(e.target.value)}
									data-testid="edit-subtask-date-input"
									onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
									onBlur={(e) =>
										(e.currentTarget.style.borderColor = isDark
											? "#334155"
											: "rgba(124,92,255,0.22)")
									}
								/>
							</div>
						</div>
						{initialDate && (
							<div
								style={{
									marginTop: "-4px",
									padding: "10px 12px",
									borderRadius: "9px",
									border: hasConflictOnDate
										? "1px solid rgba(248,113,113,0.36)"
										: "1px solid rgba(124,92,255,0.24)",
									background: hasConflictOnDate
										? "rgba(248,113,113,0.08)"
										: isDark
											? "rgba(124,92,255,0.09)"
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
										fontWeight: 700,
										color: isDark ? "#cbd5e1" : "#5b4a8e",
									}}
								>
									<span>Capacidad para {formatDate(initialDate)}</span>
									<strong style={{ color: hasConflictOnDate ? "#f87171" : "#7c3aed" }}>
										{maxDailyHours > 0
											? `${formatHours(projectedDateLoad)}h / ${formatHours(maxDailyHours)}h`
											: `${formatHours(projectedDateLoad)}h`}
									</strong>
								</div>
								{maxDailyHours > 0 && (
									<div
										style={{
											marginTop: "7px",
											height: "6px",
											borderRadius: "999px",
											background: isDark ? "rgba(148,163,184,0.22)" : "rgba(124,92,255,0.14)",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												height: "100%",
												width: `${capacityPercent}%`,
												background: hasConflictOnDate
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
										margin: "8px 0 0",
										fontSize: "11px",
										lineHeight: 1.35,
										color: hasConflictOnDate ? "#f87171" : isDark ? "#a78bfa" : "#6d28d9",
									}}
								>
									{hasConflictOnDate
										? "Hay un conflicto de carga para esta fecha. Puedes guardar y resolverlo despues en Conflictos."
										: "Sin conflicto detectado para esa fecha."}
								</p>
							</div>
						)}
						<div>
							<label style={labelStyle}>Estado</label>
							<StatusPicker value={initialStatus} onChange={setStatus} qaPrefix="edit-subtask" />
						</div>
						{initialStatus === "postponed" && (
							<div>
								<label style={labelStyle}>Nota opcional posposición</label>
								<textarea
									style={{
										...inputStyle,
										minHeight: "70px",
										resize: "vertical",
										fontFamily: "inherit",
									}}
									value={initialPostponementNote}
									onChange={(e) => setPostponementNote?.(e.target.value)}
									placeholder="Razón por la que se pospone..."
									maxLength={500}
									data-testid="edit-subtask-postponement-note"
									onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
									onBlur={(e) =>
										(e.currentTarget.style.borderColor = isDark
											? "#334155"
											: "rgba(124,92,255,0.22)")
									}
								/>
							</div>
						)}
					</div>
					{/* Footer */}
					<div style={{ display: "flex", gap: "8px", padding: "14px 20px 18px" }}>
						<button
							onClick={onSave}
							disabled={saving}
							className="modal-btn-primary"
							data-testid="edit-subtask-save-btn"
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
							data-testid="edit-subtask-cancel-btn"
							style={{
								padding: "10px 18px",
								borderRadius: "8px",
								border: `1px solid ${smCancelBdr}`,
								cursor: "pointer",
								fontSize: "13px",
								fontWeight: 600,
								background: "transparent",
								color: smCancelClr,
							}}
						>
							Cancelar
						</button>
					</div>
				</div>
			</div>
		</>,
		document.body,
	);
}

/* ============ DELETE CONFIRM MODAL ============ */
interface DeleteConfirmModalProps {
	subtaskName: string;
	deleting: boolean;
	onConfirm: () => void;
	onClose: () => void;
}
export function DeleteConfirmModal({
	subtaskName,
	deleting,
	onConfirm,
	onClose,
}: DeleteConfirmModalProps) {
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !deleting) onClose();
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose, deleting]);
	const { isDark } = useTheme();
	const dcModalBg = isDark
		? "linear-gradient(155deg,#1a0e0e 0%,#110909 55%,#090404 100%)"
		: "linear-gradient(155deg,#fff5f5 0%,#fff0f0 55%,#ffe8e8 100%)";
	const dcTitleClr = isDark ? "#f1f5f9" : "#1e1a33";
	const dcTextClr = isDark ? "#94a3b8" : "#7a728f";
	const dcStrongClr = isDark ? "#e2e8f0" : "#1e1a33";
	const dcCancelBdr = isDark ? "#334155" : "rgba(124,92,255,0.22)";
	const dcCancelClr = isDark ? "#94a3b8" : "#7a62c9";

	return createPortal(
		<>
			{/* Backdrop */}
			<div
				onClick={() => {
					if (!deleting) onClose();
				}}
				data-testid="delete-subtask-backdrop"
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(4,3,12,0.72)",
					backdropFilter: "blur(14px) saturate(150%)",
					WebkitBackdropFilter: "blur(14px) saturate(150%)",
					zIndex: 2200,
					animation: "fadeInBackdrop 0.18s ease",
				}}
			/>
			{/* Dialog */}
			<div
				data-testid="delete-subtask-layer"
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 2201,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "20px",
				}}
			>
				<div
					data-testid="delete-subtask-modal"
					style={{
						position: "relative",
						background: dcModalBg,
						border: "1px solid rgba(248,113,113,0.2)",
						borderRadius: "16px",
						width: "100%",
						maxWidth: "360px",
						boxShadow: "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(239,68,68,0.03)",
						animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
						textAlign: "center",
						padding: "32px 28px 24px",
					}}
				>
					<div
						className="modal-glow-line"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(239,68,68,0.5) 28%, rgba(248,113,113,0.3) 62%, transparent)",
						}}
					/>
					{/* Icon */}
					<div
						style={{
							width: "56px",
							height: "56px",
							borderRadius: "50%",
							background: "rgba(248,113,113,0.12)",
							border: "1px solid rgba(248,113,113,0.25)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							margin: "0 auto 20px",
						}}
					>
						<Trash2 size={22} color="#f87171" />
					</div>
					<p style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 700, color: dcTitleClr }}>
						¿Eliminar tarea?
					</p>
					<p style={{ margin: "0 0 24px", fontSize: "13px", color: dcTextClr, lineHeight: 1.6 }}>
						Se eliminará permanentemente{" "}
						<strong style={{ color: dcStrongClr }}>"{subtaskName}"</strong>. Esta acción no se puede
						deshacer.
					</p>
					<div style={{ display: "flex", gap: "10px" }}>
						<button
							onClick={onConfirm}
							disabled={deleting}
							className="modal-btn-danger"
							data-testid="delete-subtask-confirm-btn"
							style={{
								flex: 1,
								padding: "11px 14px",
								borderRadius: "8px",
								border: "none",
								cursor: deleting ? "wait" : "pointer",
								fontSize: "13px",
								fontWeight: 700,
								background: "#ef4444",
								color: "#fff",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "7px",
								opacity: deleting ? 0.7 : 1,
							}}
						>
							{deleting ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
							{deleting ? "Eliminando..." : "Sí, eliminar"}
						</button>
						<button
							onClick={onClose}
							disabled={deleting}
							className="modal-btn-cancel"
							data-testid="delete-subtask-cancel-btn"
							style={{
								flex: 1,
								padding: "11px 14px",
								borderRadius: "8px",
								border: `1px solid ${dcCancelBdr}`,
								cursor: "pointer",
								fontSize: "13px",
								fontWeight: 600,
								background: "transparent",
								color: dcCancelClr,
							}}
						>
							Cancelar
						</button>
					</div>
				</div>
			</div>
		</>,
		document.body,
	);
}

/* ============ STATUS PICKER ============ */
export function StatusPicker({
	value,
	onChange,
	qaPrefix = "status-picker",
}: {
	value: Subtask["status"];
	onChange: (v: Subtask["status"]) => void;
	qaPrefix?: string;
}) {
	const { isDark } = useTheme();
	const opts: { v: Subtask["status"]; label: string; color: string }[] = [
		{ v: "pending", label: "Pendiente", color: "#fbbf24" },
		{ v: "in_progress", label: "En progreso", color: "#60a5fa" },
		{ v: "completed", label: "Completada", color: "#34d399" },
		{ v: "postponed", label: "Posponer", color: "#fb923c" },
	];
	return (
		<div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
			{opts.map(({ v, label, color }) => (
				<button
					key={v}
					type="button"
					onClick={() => onChange(v)}
					data-testid={`${qaPrefix}--status-${v}`}
					style={{
						flex: 1,
						padding: "7px 5px",
						borderRadius: "6px",
						border: `1.5px solid ${value === v ? color : isDark ? "#334155" : "rgba(124,92,255,0.18)"}`,
						background: value === v ? `${color}20` : "transparent",
						color: value === v ? color : isDark ? "#64748b" : "#9580c9",
						fontSize: "11px",
						fontWeight: 700,
						cursor: "pointer",
						transition: "all 0.14s",
						lineHeight: 1,
						minWidth: "70px",
					}}
				>
					{label}
				</button>
			))}
		</div>
	);
}

/* ============ CREATE SUBTASK MODAL ============ */
export function CreateSubtaskModal({
	activities,
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
	onClose,
	onCreated,
}: {
	activities: Activity[];
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
	onClose: () => void;
	onCreated: (kanban: KanbanState) => void;
}) {
	const [selectedActivityId, setSelectedActivityId] = useState<number | "">("");
	const [name, setName] = useState("");
	const [targetDate, setTargetDate] = useState("");
	const [hours, setHours] = useState("1");
	const [status, setStatus] = useState<Subtask["status"]>("pending");
	const [saving, setSaving] = useState(false);
	const [actDropOpen, setActDropOpen] = useState(false);
	const { isDark } = useTheme();
	const _now = new Date();
	const todayIso = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	async function handleSubmit() {
		if (!selectedActivityId) {
			toast.error("Selecciona una actividad.");
			return;
		}
		if (!name.trim()) {
			toast.error("El nombre es obligatorio.");
			return;
		}
		if (!targetDate) {
			toast.error("Selecciona una fecha límite.");
			return;
		}
		const h = parseFloat(hours);
		if (isNaN(h) || h < 0) {
			toast.error("Horas inválidas.");
			return;
		}
		setSaving(true);
		try {
			await createSubtask(selectedActivityId as number, {
				name: name.trim(),
				estimated_hours: h,
				target_date: targetDate,
				status,
				ordering: 1,
			});
			const todayView = await fetchTodayView();
			const k: KanbanState = {
				overdue: todayView.overdue,
				today: todayView.today,
				upcoming: todayView.upcoming,
				postponed: todayView.postponed ?? [],
			};
			onCreated(k);
			toast.success("Tarea creada");
			onClose();
		} catch {
			toast.error("Error al crear la tarea.");
		} finally {
			setSaving(false);
		}
	}

	const selectedActivity = activities.find((a) => a.id === selectedActivityId);
	const conflictDateSet = useMemo(() => new Set(conflictDates), [conflictDates]);
	const parsedHours = Number.parseFloat(hours);
	const draftHours = Number.isFinite(parsedHours) ? Math.max(0, parsedHours) : 0;
	const targetBaseLoad = targetDate ? (dateLoadMap[targetDate] ?? 0) : 0;
	const newHoursForTargetDate = status === "completed" ? 0 : draftHours;
	const projectedTargetLoad = targetBaseLoad + newHoursForTargetDate;
	const hasConflictOnTargetDate =
		!!targetDate &&
		(conflictDateSet.has(targetDate) || (maxDailyHours > 0 && projectedTargetLoad > maxDailyHours));
	const targetCapacityPercent =
		maxDailyHours > 0 ? Math.min((projectedTargetLoad / maxDailyHours) * 100, 100) : 0;

	const inputStyle: React.CSSProperties = {
		background: isDark ? "#1e293b" : "#ffffff",
		border: `1px solid ${isDark ? "#334155" : "rgba(124,92,255,0.22)"}`,
		borderRadius: "6px",
		color: isDark ? "#f1f5f9" : "#1e1a33",
		fontSize: "13px",
		padding: "8px 11px",
		width: "100%",
		outline: "none",
		boxSizing: "border-box",
	};
	const labelStyle: React.CSSProperties = {
		fontSize: "10px",
		color: isDark ? "#64748b" : "#7a62c9",
		textTransform: "uppercase",
		letterSpacing: "0.05em",
		fontWeight: 600,
		display: "block",
		marginBottom: "6px",
	};

	return createPortal(
		<>
			<div
				onClick={onClose}
				data-testid="create-subtask-backdrop"
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.55)",
					zIndex: 2100,
					backdropFilter: "blur(4px)",
					animation: "fadeInBackdrop 0.18s ease",
				}}
			/>
			<div
				data-testid="create-subtask-layer"
				style={{
					position: "fixed",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					zIndex: 2101,
					pointerEvents: "none",
					padding: "24px",
				}}
			>
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Crear tarea"
					data-testid="create-subtask-modal"
					style={{
						pointerEvents: "auto",
						position: "relative",
						width: "min(560px, 100%)",
						background: isDark
							? "linear-gradient(155deg,#141f35 0%,#0f172a 55%,#09111e 100%)"
							: "linear-gradient(155deg,#f8f5ff 0%,#f0ecfb 60%,#ebe5f7 100%)",
						borderRadius: "14px",
						border: `1px solid ${isDark ? "#1e293b" : "rgba(124,92,255,0.2)"}`,
						boxShadow: "0 24px 64px rgba(0,0,0,0.65), inset 0 0 60px rgba(124,92,255,0.03)",
						display: "flex",
						flexDirection: "column",
						animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
						maxHeight: "calc(100vh - 48px)",
						overflow: "hidden",
					}}
					onClick={(e) => e.stopPropagation()}
				>
					{/* Soft radial bloom — no hard line */}
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
							padding: "18px 20px 16px",
							borderBottom: `1px solid ${isDark ? "#1e293b" : "rgba(124,92,255,0.2)"}`,
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
							<div
								style={{
									width: 42,
									height: 42,
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
								<ClipboardList size={20} />
							</div>
							<div>
								<h2
									style={{
										margin: 0,
										fontSize: "15px",
										fontWeight: 700,
										color: isDark ? "#f1f5f9" : "#1e1a33",
									}}
								>
									Nueva tarea
								</h2>
								<p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>
									Asóciala a una actividad existente
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="modal-close-x"
							aria-label="Cerrar"
							data-testid="create-subtask-close-btn"
						>
							<X size={15} />
						</button>
					</div>
					{/* Body */}
					<div
						style={{
							overflowY: "auto",
							padding: "20px",
							display: "flex",
							flexDirection: "column",
							gap: "16px",
						}}
					>
						{/* Activity picker */}
						<div>
							<label style={labelStyle}>Actividad</label>
							<div style={{ position: "relative" }}>
								<button
									type="button"
									onClick={() => setActDropOpen(!actDropOpen)}
									data-testid="create-subtask-activity-btn"
									style={{
										...inputStyle,
										textAlign: "left",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										gap: "8px",
										border: `1px solid ${actDropOpen ? "#c084fc" : isDark ? "#334155" : "rgba(124,92,255,0.18)"}`,
									}}
								>
									{selectedActivity ? (
										<>
											<span
												style={{
													fontSize: "10px",
													background: "rgba(192,132,252,0.1)",
													color: "#c084fc",
													padding: "1px 7px",
													borderRadius: "20px",
													fontWeight: 700,
													flexShrink: 0,
												}}
											>
												{selectedActivity.course_name || "Sin materia"}
											</span>
											<span
												style={{
													flex: 1,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{selectedActivity.title}
											</span>
										</>
									) : (
										<span style={{ color: "#475569", flex: 1 }}>Selecciona una actividad...</span>
									)}
									<ChevronDown
										size={14}
										color="#64748b"
										style={{
											flexShrink: 0,
											transform: actDropOpen ? "rotate(180deg)" : "none",
											transition: "transform 0.15s",
										}}
									/>
								</button>
								{actDropOpen && (
									<div
										data-testid="create-subtask-activity-dropdown"
										style={{
											position: "absolute",
											top: "calc(100% + 4px)",
											left: 0,
											right: 0,
											background: isDark ? "#1e293b" : "rgba(255,255,255,0.97)",
											border: `1px solid ${isDark ? "#334155" : "rgba(124,92,255,0.22)"}`,
											borderRadius: "8px",
											zIndex: 10,
											maxHeight: "200px",
											overflowY: "auto",
											boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
											animation: "fadeInScale 0.14s ease",
										}}
									>
										{activities.length === 0 ? (
											<p
												style={{
													padding: "12px",
													fontSize: "12px",
													color: isDark ? "#64748b" : "#7a62c9",
													margin: 0,
												}}
											>
												No hay actividades.
											</p>
										) : (
											activities.map((act) => (
												<button
													key={act.id}
													type="button"
													onClick={() => {
														setSelectedActivityId(act.id);
														setActDropOpen(false);
													}}
													data-testid={`create-subtask-activity-option-${act.id}`}
													style={{
														width: "100%",
														padding: "9px 12px",
														background:
															selectedActivityId === act.id
																? "rgba(192,132,252,0.1)"
																: "transparent",
														border: "none",
														cursor: "pointer",
														display: "flex",
														alignItems: "center",
														gap: "8px",
														borderBottom: "1px solid rgba(255,255,255,0.04)",
														textAlign: "left",
														transition: "background 0.12s",
													}}
													onMouseOver={(e) => {
														if (selectedActivityId !== act.id)
															e.currentTarget.style.background = "rgba(255,255,255,0.04)";
													}}
													onMouseOut={(e) => {
														if (selectedActivityId !== act.id)
															e.currentTarget.style.background = "transparent";
													}}
												>
													{act.course_name && (
														<span
															style={{
																fontSize: "10px",
																background: "rgba(192,132,252,0.1)",
																color: "#c084fc",
																padding: "1px 6px",
																borderRadius: "20px",
																fontWeight: 700,
																flexShrink: 0,
															}}
														>
															{act.course_name}
														</span>
													)}
													<span
														style={{
															fontSize: "12px",
															color: isDark ? "#f1f5f9" : "#1e1a33",
															flex: 1,
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
														}}
													>
														{act.title}
													</span>
													{selectedActivityId === act.id && (
														<CheckCircle2 size={13} color="#c084fc" style={{ flexShrink: 0 }} />
													)}
												</button>
											))
										)}
									</div>
								)}
							</div>
						</div>
						{/* Activity due date warning */}
						{selectedActivity &&
							(() => {
								const actIsOverdue = selectedActivity.due_date < todayIso;
								return (
									<>
										{actIsOverdue && (
											<div
												style={{
													display: "flex",
													alignItems: "flex-start",
													gap: "10px",
													background: "rgba(248,113,113,0.08)",
													border: "1px solid rgba(248,113,113,0.35)",
													borderRadius: "8px",
													padding: "10px 13px",
													marginBottom: "6px",
												}}
											>
												<AlertTriangle
													size={14}
													color="#f87171"
													style={{ flexShrink: 0, marginTop: "1px" }}
												/>
												<div>
													<p
														style={{
															margin: 0,
															fontSize: "12px",
															color: "#f87171",
															fontWeight: 700,
														}}
													>
														⚠ Actividad vencida
													</p>
													<p
														style={{
															margin: "3px 0 0",
															fontSize: "11px",
															color: isDark ? "#94a3b8" : "#7a728f",
															lineHeight: 1.4,
														}}
													>
														Esta actividad ya superó su fecha límite. La tarea se creará de todas
														formas.
													</p>
												</div>
											</div>
										)}
										<div
											style={{
												display: "flex",
												alignItems: "flex-start",
												gap: "10px",
												background: actIsOverdue
													? "rgba(248,113,113,0.05)"
													: "rgba(251,191,36,0.07)",
												border: actIsOverdue
													? "1px solid rgba(248,113,113,0.2)"
													: "1px solid rgba(251,191,36,0.25)",
												borderRadius: "8px",
												padding: "10px 13px",
											}}
										>
											<AlertTriangle
												size={14}
												color={actIsOverdue ? "#f87171" : "#fbbf24"}
												style={{ flexShrink: 0, marginTop: "1px" }}
											/>
											<div>
												<p
													style={{
														margin: 0,
														fontSize: "12px",
														color: actIsOverdue ? "#f87171" : "#fbbf24",
														fontWeight: 600,
													}}
												>
													Plazo de la actividad: {formatDate(selectedActivity.due_date)}
												</p>
												<p
													style={{
														margin: "3px 0 0",
														fontSize: "11px",
														color: isDark ? "#94a3b8" : "#7a728f",
														lineHeight: 1.4,
													}}
												>
													{actIsOverdue
														? "Puedes asignar cualquier fecha futura para esta tarea."
														: "La tarea debe completarse dentro de este mismo plazo."}
												</p>
											</div>
										</div>
									</>
								);
							})()}
						{/* Name */}
						<div>
							<label style={labelStyle}>Nombre de la tarea</label>
							<input
								style={inputStyle}
								placeholder="ej. Revisar capítulo 3..."
								value={name}
								onChange={(e) => setName(e.target.value)}
								maxLength={200}
								autoFocus
								data-testid="create-subtask-name-input"
								onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
								onBlur={(e) =>
									(e.currentTarget.style.borderColor = isDark ? "#334155" : "rgba(124,92,255,0.22)")
								}
							/>
						</div>
						{/* Date + Hours */}
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
							<div>
								<label style={labelStyle}>Fecha límite</label>
								<input
									style={inputStyle}
									type="date"
									min={todayIso}
									max={
										selectedActivity && selectedActivity.due_date >= todayIso
											? selectedActivity.due_date
											: undefined
									}
									value={targetDate}
									onChange={(e) => setTargetDate(e.target.value)}
									data-testid="create-subtask-date-input"
									onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
									onBlur={(e) =>
										(e.currentTarget.style.borderColor = isDark
											? "#334155"
											: "rgba(124,92,255,0.22)")
									}
								/>
							</div>
							<div>
								<label style={labelStyle}>Tiempo estimado (h)</label>
								<input
									style={inputStyle}
									type="number"
									min="0"
									step="0.5"
									value={hours}
									onChange={(e) => setHours(e.target.value)}
									data-testid="create-subtask-hours-input"
									onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
									onBlur={(e) =>
										(e.currentTarget.style.borderColor = isDark
											? "#334155"
											: "rgba(124,92,255,0.22)")
									}
								/>
							</div>
						</div>
						{targetDate && (
							<div
								style={{
									marginTop: "-4px",
									padding: "10px 12px",
									borderRadius: "9px",
									border: hasConflictOnTargetDate
										? "1px solid rgba(248,113,113,0.36)"
										: "1px solid rgba(124,92,255,0.24)",
									background: hasConflictOnTargetDate
										? "rgba(248,113,113,0.08)"
										: isDark
											? "rgba(124,92,255,0.09)"
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
										fontWeight: 700,
										color: isDark ? "#cbd5e1" : "#5b4a8e",
									}}
								>
									<span>Capacidad para {formatDate(targetDate)}</span>
									<strong style={{ color: hasConflictOnTargetDate ? "#f87171" : "#7c3aed" }}>
										{maxDailyHours > 0
											? `${formatHours(projectedTargetLoad)}h / ${formatHours(maxDailyHours)}h`
											: `${formatHours(projectedTargetLoad)}h`}
									</strong>
								</div>
								{maxDailyHours > 0 && (
									<div
										style={{
											marginTop: "7px",
											height: "6px",
											borderRadius: "999px",
											background: isDark ? "rgba(148,163,184,0.22)" : "rgba(124,92,255,0.14)",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												height: "100%",
												width: `${targetCapacityPercent}%`,
												background: hasConflictOnTargetDate
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
										margin: "8px 0 0",
										fontSize: "11px",
										lineHeight: 1.35,
										color: hasConflictOnTargetDate ? "#f87171" : isDark ? "#a78bfa" : "#6d28d9",
									}}
								>
									{hasConflictOnTargetDate
										? "Hay un conflicto de carga para esta fecha. Puedes guardar y resolverlo despues en Conflictos."
										: "Sin conflicto detectado para esa fecha."}
								</p>
							</div>
						)}
						{/* Status */}
						<div>
							<label style={labelStyle}>Estado inicial</label>
							<StatusPicker value={status} onChange={setStatus} qaPrefix="create-subtask" />
						</div>
					</div>
					{/* Footer */}
					<div
						style={{
							padding: "14px 20px",
							borderTop: `1px solid ${isDark ? "#1e293b" : "rgba(124,92,255,0.2)"}`,
							display: "flex",
							gap: "8px",
						}}
					>
						<button
							onClick={() => void handleSubmit()}
							disabled={saving}
							className="modal-btn-primary"
							data-testid="create-subtask-submit-btn"
							style={{
								flex: 1,
								padding: "10px 16px",
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
								gap: "8px",
								opacity: saving ? 0.7 : 1,
								boxShadow: "0 4px 14px rgba(124,58,237,0.28)",
							}}
						>
							{saving ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />}
							{saving ? "Creando..." : "Crear tarea"}
						</button>
						<button
							onClick={onClose}
							disabled={saving}
							className="modal-btn-cancel"
							data-testid="create-subtask-cancel-btn"
							style={{
								padding: "10px 18px",
								borderRadius: "8px",
								border: `1px solid ${isDark ? "#334155" : "rgba(124,92,255,0.22)"}`,
								cursor: "pointer",
								fontSize: "13px",
								fontWeight: 600,
								background: "transparent",
								color: isDark ? "#94a3b8" : "#7a62c9",
							}}
						>
							Cancelar
						</button>
					</div>
				</div>
			</div>
		</>,
		document.body,
	);
}

/* ---- SubjectFormModal ---- */
