import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
	CalendarClock,
	X,
	Clock,
	ArrowUpDown,
	Loader2,
	Trash2,
	BookOpen,
	CheckCircle2,
	Circle,
	ClipboardList,
	Pencil,
} from "lucide-react";
import { type Subtask } from "../api/dashboard";
import { useTheme } from "../hooks/useTheme";
import { toast } from "sonner";
import "./Dashboard.css";
import { formatDate, type KanbanGroup } from "./dashboardUtils";
import { EditSubtaskModal, DeleteConfirmModal } from "./SubtaskModals";

export function SubtaskDetailPanel({
	subtask,
	group,
	onClose,
	onToggle,
	toggling,
	onEdit,
	onDelete,
}: {
	subtask: Subtask;
	group: KanbanGroup;
	onClose: () => void;
	onToggle: () => void;
	toggling: boolean;
	onEdit: (
		fields: Partial<Pick<Subtask, "name" | "estimated_hours" | "target_date" | "status">>,
	) => Promise<void>;
	onDelete: () => Promise<void>;
}) {
	const { isDark } = useTheme();
	const sdp = {
		panelBg: isDark ? "#0f172a" : "#ffffff",
		panelBdr: isDark ? "#1e293b" : "rgba(124,92,255,0.18)",
		divider: isDark ? "#1e293b" : "rgba(124,92,255,0.12)",
		iconClr: isDark ? "#475569" : "#c4b5fd",
		iconHoverX: isDark ? "#f1f5f9" : "#1e1a33",
		titleClr: isDark ? "#f1f5f9" : "#1e1a33",
		titleDone: isDark ? "#64748b" : "#9580c9",
		metaIcon: isDark ? "#334155" : "#c4b5fd",
		metaLabel: isDark ? "#475569" : "#9580c9",
		metaValue: isDark ? "#94a3b8" : "#3d3466",
		tsLabel: isDark ? "#334155" : "#b8a8e0",
		tsKey: isDark ? "#475569" : "#9580c9",
		tsVal: isDark ? "#64748b" : "#7a6ba8",
		ctaBg: isDark ? "#1e293b" : "rgba(124,92,255,0.1)",
		ctaClr: isDark ? "#64748b" : "#7c3aed",
	};
	const isCompleted = subtask.status === "completed";
	const groupMeta: Record<KanbanGroup, { accent: string; bgAccent: string; label: string }> = {
		overdue: { accent: "#f87171", bgAccent: "rgba(248,113,113,0.1)", label: "Vencida" },
		today: { accent: "#c084fc", bgAccent: "rgba(192,132,252,0.1)", label: "Para hoy" },
		upcoming: { accent: "#60a5fa", bgAccent: "rgba(96,165,250,0.1)", label: "Próxima" },
	};
	const { accent, bgAccent, label } = groupMeta[group];
	const statusConfig: Record<string, { label: string; color: string }> = {
		pending: { label: "Pendiente", color: "#fbbf24" },
		in_progress: { label: "En progreso", color: "#60a5fa" },
		completed: { label: "Completada", color: "#34d399" },
	};
	const statusInfo = statusConfig[subtask.status] ?? { label: subtask.status, color: "#64748b" };

	// ---- Edit state ----
	const [editMode, setEditMode] = useState(false);
	const [editName, setEditName] = useState(subtask.name);
	const [editHours, setEditHours] = useState(String(subtask.estimated_hours));
	const [editDate, setEditDate] = useState(subtask.target_date);
	const [editStatus, setEditStatus] = useState<Subtask["status"]>(subtask.status);
	const [editSaving, setEditSaving] = useState(false);

	// ---- Delete confirm state ----
	const [deleteStep, setDeleteStep] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Reset local edit fields whenever we open a different subtask
	useEffect(() => {
		setEditMode(false);
		setDeleteStep(false);
		setEditName(subtask.name);
		setEditHours(String(subtask.estimated_hours));
		setEditDate(subtask.target_date);
		setEditStatus(subtask.status);
	}, [subtask.id]); // eslint-disable-line react-hooks/exhaustive-deps

	// ESC closes the panel only when no sub-modal is open (they handle ESC themselves)
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			if (editMode || deleteStep) return;
			onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, editMode, deleteStep]);

	async function saveEdit() {
		const hours = parseFloat(editHours);
		if (!editName.trim()) {
			toast.error("El nombre no puede estar vacío.");
			return;
		}
		if (isNaN(hours) || hours < 0) {
			toast.error("Horas debe ser un número válido.");
			return;
		}
		setEditSaving(true);
		try {
			await onEdit({
				name: editName.trim(),
				estimated_hours: hours,
				target_date: editDate,
				status: editStatus,
			});
			setEditMode(false);
		} catch {
			// toast already shown upstream
		} finally {
			setEditSaving(false);
		}
	}

	async function confirmDelete() {
		setDeleting(true);
		try {
			await onDelete();
		} catch {
			toast.error("No se pudo eliminar la tarea.");
			setDeleting(false);
			setDeleteStep(false);
		}
	}

	function formatDt(iso: string) {
		if (!iso) return "—";
		try {
			return new Date(iso).toLocaleDateString("es-CO", {
				day: "2-digit",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return iso;
		}
	}

	return createPortal(
		<>
			{/* Backdrop */}
			<div
				onClick={onClose}
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.4)",
					zIndex: 2000,
					animation: "fadeInBackdrop 0.18s ease",
					backdropFilter: "blur(3px)",
				}}
			/>
			<aside
				role="dialog"
				aria-modal="true"
				aria-label="Detalle de tarea"
				style={{
					position: "fixed",
					top: 0,
					right: 0,
					bottom: 0,
					width: "360px",
					background: sdp.panelBg,
					borderLeft: `1px solid ${sdp.panelBdr}`,
					zIndex: 2001,
					display: "flex",
					flexDirection: "column",
					boxShadow: "-12px 0 48px rgba(0,0,0,0.55)",
					animation: "slideInRight 0.24s cubic-bezier(0.16,1,0.3,1)",
				}}
			>
				{/* ---- Header ---- */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "13px 16px",
						borderBottom: `1px solid ${sdp.divider}`,
					}}
				>
					<span
						style={{
							fontSize: "10px",
							fontWeight: 700,
							color: accent,
							background: bgAccent,
							padding: "3px 10px",
							borderRadius: "20px",
							textTransform: "uppercase",
							letterSpacing: "0.06em",
							flexShrink: 0,
						}}
					>
						{label}
					</span>
					<div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "2px" }}>
						<button
							onClick={() => setEditMode(true)}
							title="Editar"
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: sdp.iconClr,
								padding: "6px",
								borderRadius: "5px",
								display: "flex",
								transition: "color 0.15s",
							}}
							onMouseOver={(e) => (e.currentTarget.style.color = "#c084fc")}
							onMouseOut={(e) => (e.currentTarget.style.color = sdp.iconClr)}
						>
							<Pencil size={15} />
						</button>
						<button
							onClick={() => setDeleteStep(true)}
							title="Eliminar"
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: sdp.iconClr,
								padding: "6px",
								borderRadius: "5px",
								display: "flex",
								transition: "color 0.15s",
							}}
							onMouseOver={(e) => (e.currentTarget.style.color = "#f87171")}
							onMouseOut={(e) => (e.currentTarget.style.color = sdp.iconClr)}
						>
							<Trash2 size={15} />
						</button>
						<button
							onClick={onClose}
							title="Cerrar"
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: sdp.iconClr,
								padding: "6px",
								borderRadius: "5px",
								display: "flex",
								transition: "color 0.15s",
							}}
							onMouseOver={(e) => (e.currentTarget.style.color = isDark ? "#f1f5f9" : "#1e1a33")}
							onMouseOut={(e) => (e.currentTarget.style.color = sdp.iconClr)}
							aria-label="Cerrar"
						>
							<X size={17} />
						</button>
					</div>
				</div>

				{/* ---- Scrollable body ---- */}
				<div
					style={{
						flex: 1,
						overflowY: "auto",
						padding: "18px 18px",
						display: "flex",
						flexDirection: "column",
						gap: "16px",
					}}
				>
					{/* === VIEW MODE === */}
					{/* Title + course badge */}
					<div>
						{subtask.course_name && (
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: "6px",
									fontSize: "11px",
									fontWeight: 700,
									color: "#c084fc",
									background: "rgba(192,132,252,0.1)",
									padding: "3px 10px",
									borderRadius: "20px",
									marginBottom: "12px",
								}}
							>
								<BookOpen size={12} />
								{subtask.course_name}
							</div>
						)}
						<h2
							style={{
								fontSize: "17px",
								fontWeight: 700,
								color: isCompleted ? sdp.titleDone : sdp.titleClr,
								margin: 0,
								lineHeight: 1.45,
								textDecoration: isCompleted ? "line-through" : "none",
							}}
						>
							{subtask.name}
						</h2>
					</div>

					<div style={{ height: "1px", background: sdp.divider }} />

					{/* Meta rows */}
					<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
						{subtask.activity && (
							<div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
								<span
									style={{ color: sdp.metaIcon, display: "flex", flexShrink: 0, marginTop: "1px" }}
								>
									<ClipboardList size={15} />
								</span>
								<div>
									<p
										style={{
											fontSize: "10px",
											color: sdp.metaLabel,
											margin: "0 0 2px 0",
											textTransform: "uppercase",
											letterSpacing: "0.05em",
											fontWeight: 600,
										}}
									>
										Actividad
									</p>
									<p style={{ fontSize: "13px", color: sdp.metaValue, margin: 0, fontWeight: 500 }}>
										{subtask.activity.title}
									</p>
								</div>
							</div>
						)}
						<div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
							<span
								style={{ color: sdp.metaIcon, display: "flex", flexShrink: 0, marginTop: "1px" }}
							>
								<CalendarClock size={15} />
							</span>
							<div>
								<p
									style={{
										fontSize: "10px",
										color: sdp.metaLabel,
										margin: "0 0 2px 0",
										textTransform: "uppercase",
										letterSpacing: "0.05em",
										fontWeight: 600,
									}}
								>
									Fecha límite
								</p>
								<p style={{ fontSize: "13px", color: sdp.metaValue, margin: 0, fontWeight: 500 }}>
									{formatDate(subtask.target_date)}
								</p>
							</div>
						</div>
						<div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
							<span
								style={{ color: sdp.metaIcon, display: "flex", flexShrink: 0, marginTop: "1px" }}
							>
								<Clock size={15} />
							</span>
							<div>
								<p
									style={{
										fontSize: "10px",
										color: sdp.metaLabel,
										margin: "0 0 2px 0",
										textTransform: "uppercase",
										letterSpacing: "0.05em",
										fontWeight: 600,
									}}
								>
									Tiempo estimado
								</p>
								<p style={{ fontSize: "13px", color: "#fbbf24", margin: 0, fontWeight: 700 }}>
									{subtask.estimated_hours}h
								</p>
							</div>
						</div>
						<div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
							<span
								style={{ color: sdp.metaIcon, display: "flex", flexShrink: 0, marginTop: "1px" }}
							>
								{isCompleted ? <CheckCircle2 size={15} color="#34d399" /> : <Circle size={15} />}
							</span>
							<div>
								<p
									style={{
										fontSize: "10px",
										color: sdp.metaLabel,
										margin: "0 0 2px 0",
										textTransform: "uppercase",
										letterSpacing: "0.05em",
										fontWeight: 600,
									}}
								>
									Estado
								</p>
								<p
									style={{ fontSize: "13px", color: statusInfo.color, margin: 0, fontWeight: 700 }}
								>
									{statusInfo.label}
								</p>
							</div>
						</div>
						{subtask.ordering > 0 && (
							<div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
								<span
									style={{ color: sdp.metaIcon, display: "flex", flexShrink: 0, marginTop: "1px" }}
								>
									<ArrowUpDown size={15} />
								</span>
								<div>
									<p
										style={{
											fontSize: "10px",
											color: sdp.metaLabel,
											margin: "0 0 2px 0",
											textTransform: "uppercase",
											letterSpacing: "0.05em",
											fontWeight: 600,
										}}
									>
										Posición
									</p>
									<p style={{ fontSize: "13px", color: sdp.metaValue, margin: 0, fontWeight: 500 }}>
										#{subtask.ordering}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Timestamps section */}
					{(subtask.created_at || subtask.updated_at) && (
						<>
							<div style={{ height: "1px", background: sdp.divider }} />
							<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
								<p
									style={{
										fontSize: "10px",
										color: sdp.tsLabel,
										textTransform: "uppercase",
										letterSpacing: "0.06em",
										fontWeight: 600,
										margin: 0,
									}}
								>
									Fechas de registro
								</p>
								{subtask.created_at && (
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}
									>
										<span style={{ fontSize: "11px", color: sdp.tsKey }}>Creada</span>
										<span style={{ fontSize: "11px", color: sdp.tsVal, fontFamily: "monospace" }}>
											{formatDt(subtask.created_at)}
										</span>
									</div>
								)}
								{subtask.updated_at && (
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}
									>
										<span style={{ fontSize: "11px", color: sdp.tsKey }}>Última edición</span>
										<span style={{ fontSize: "11px", color: sdp.tsVal, fontFamily: "monospace" }}>
											{formatDt(subtask.updated_at)}
										</span>
									</div>
								)}
							</div>
						</>
					)}
				</div>

				{/* ---- Footer CTA ---- */}
				<div style={{ padding: "14px 18px", borderTop: `1px solid ${sdp.divider}` }}>
					<button
						onClick={onToggle}
						disabled={toggling}
						style={{
							width: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "8px",
							padding: "11px 16px",
							borderRadius: "8px",
							border: "none",
							cursor: toggling ? "wait" : "pointer",
							fontSize: "13px",
							fontWeight: 700,
							background: isCompleted ? sdp.ctaBg : "linear-gradient(135deg,#7c3aed,#6d28d9)",
							color: isCompleted ? sdp.ctaClr : "#fff",
							transition: "opacity 0.15s",
							boxShadow: isCompleted ? "none" : "0 4px 14px rgba(124,58,237,0.35)",
						}}
						onMouseOver={(e) => {
							if (!toggling) e.currentTarget.style.opacity = "0.85";
						}}
						onMouseOut={(e) => {
							e.currentTarget.style.opacity = "1";
						}}
					>
						{toggling ? (
							<Loader2 size={15} className="spinner" />
						) : isCompleted ? (
							<Circle size={15} />
						) : (
							<CheckCircle2 size={15} />
						)}
						{isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
					</button>
				</div>
			</aside>

			{/* ============ MODALS PORTAL ============ */}
			{editMode && (
				<EditSubtaskModal
					subtask={subtask}
					initialName={editName}
					initialHours={editHours}
					initialDate={editDate}
					initialStatus={editStatus}
					setName={setEditName}
					setHours={setEditHours}
					setDate={setEditDate}
					setStatus={setEditStatus}
					saving={editSaving}
					onSave={() => void saveEdit()}
					onClose={() => setEditMode(false)}
				/>
			)}
			{deleteStep && (
				<DeleteConfirmModal
					subtaskName={subtask.name}
					deleting={deleting}
					onConfirm={() => void confirmDelete()}
					onClose={() => setDeleteStep(false)}
				/>
			)}
		</>,
		document.body,
	);
}

/* ============ EDIT SUBTASK MODAL ============ */
