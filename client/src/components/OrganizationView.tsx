import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
	CalendarClock,
	Plus,
	ChevronDown,
	X,
	Clock,
	Loader2,
	Inbox,
	Trash2,
	BookOpen,
	CheckCircle2,
	Circle,
	ClipboardList,
	Pencil,
} from "lucide-react";
import { updateActivity, fetchSubtasks, type Activity, type Subtask } from "../api/dashboard";
import { toast } from "sonner";
import "./Dashboard.css";
import { formatDate, daysUntil } from "./dashboardUtils";
import { EditActivityForm, SubjectFormModal } from "./OrgModals";
import SubtaskManagerModal from "./SubtaskManagerModal";

interface OrgViewProps {
	activities: Activity[];
	subjects: string[];
	onDelete: (id: number, title: string) => void;
	onAddSubject: (name: string) => void;
	onRemoveSubject: (name: string) => void;
	onRenameSubject: (oldName: string, newName: string) => void;
	onActivityUpdate: (updated: Activity) => void;
	onOpenCreate: (subject?: string) => void;
	activeFilters: string[];
	searchQuery: string;
}

export default function OrganizationView({
	activities,
	subjects,
	onDelete,
	onAddSubject,
	onRemoveSubject,
	onRenameSubject,
	onActivityUpdate,
	onOpenCreate,
	activeFilters,
	searchQuery,
}: OrgViewProps) {
	const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
	const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
	const [orgSubjectModal, setOrgSubjectModal] = useState<{
		mode: "add" | "rename";
		current?: string;
	} | null>(null);
	const [orgConfirmDelete, setOrgConfirmDelete] = useState<string | null>(null);
	const [orgEditActivity, setOrgEditActivity] = useState<Activity | null>(null);
	const [subtaskStateByActivity, setSubtaskStateByActivity] = useState<
		Record<number, { loading: boolean; items: Subtask[] }>
	>({});
	const [subtaskModalActivity, setSubtaskModalActivity] = useState<Activity | null>(null);

	const grouped = useMemo(() => {
		const map: Record<string, Activity[]> = {};
		for (const s of subjects) {
			if (!map[s]) map[s] = [];
		}
		const q = searchQuery.trim().toLowerCase();
		for (const a of activities) {
			if (
				q &&
				!a.title.toLowerCase().includes(q) &&
				!(a.course_name ?? "").toLowerCase().includes(q)
			)
				continue;
			const key = a.course_name || "Sin materia";
			if (!map[key]) map[key] = [];
			map[key].push(a);
		}
		// Sort each bucket according to activeFilters
		const primary = activeFilters.find((f) =>
			["urgency", "date", "duration", "alphabetical"].includes(f),
		);
		for (const key of Object.keys(map)) {
			if (primary === "urgency" || primary === "date") {
				map[key].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
			} else if (primary === "duration") {
				map[key].sort((a, b) => b.total_estimated_hours - a.total_estimated_hours);
			} else if (primary === "alphabetical") {
				map[key].sort((a, b) => a.title.localeCompare(b.title));
			} else {
				// Default: incomplete first, then by due date
				map[key].sort((a, b) => {
					if (a.status === "completed" && b.status !== "completed") return 1;
					if (a.status !== "completed" && b.status === "completed") return -1;
					return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
				});
			}
		}
		return map;
	}, [activities, subjects, searchQuery, activeFilters]);

	async function loadSubtasks(activityId: number, force = false) {
		if (!force && subtaskStateByActivity[activityId]?.items.length) return;
		setSubtaskStateByActivity((prev) => ({
			...prev,
			[activityId]: { loading: true, items: prev[activityId]?.items ?? [] },
		}));
		try {
			const items = await fetchSubtasks(activityId);
			setSubtaskStateByActivity((prev) => ({
				...prev,
				[activityId]: { loading: false, items },
			}));
		} catch {
			setSubtaskStateByActivity((prev) => ({
				...prev,
				[activityId]: { loading: false, items: [] },
			}));
		}
	}

	function toggleActivity(activityId: number) {
		if (expandedActivity === activityId) {
			setExpandedActivity(null);
		} else {
			setExpandedActivity(activityId);
			void loadSubtasks(activityId);
		}
	}

	const statusColors: Record<string, string> = {
		pending: "#fbbf24",
		in_progress: "#60a5fa",
		completed: "#34d399",
	};
	const statusLabels: Record<string, string> = {
		pending: "Pendiente",
		in_progress: "En curso",
		completed: "Completada",
	};

	const allSubjectKeys = Object.keys(grouped).sort((a, b) => {
		if (activeFilters.includes("org-za")) return b.localeCompare(a);
		if (activeFilters.includes("org-count"))
			return (grouped[b]?.length ?? 0) - (grouped[a]?.length ?? 0);
		if (activeFilters.includes("org-hours")) {
			const ha = (grouped[a] ?? []).reduce((s, x) => s + x.total_estimated_hours, 0);
			const hb = (grouped[b] ?? []).reduce((s, x) => s + x.total_estimated_hours, 0);
			return hb - ha;
		}
		// default or org-az: A → Z
		return a.localeCompare(b);
	});

	if (allSubjectKeys.length === 0) {
		return (
			<div
				className="fade-in"
				style={{
					padding: "4rem 2rem",
					textAlign: "center",
					color: "#94a3b8",
					animationDelay: "0.2s",
				}}
			>
				<BookOpen
					size={48}
					style={{ opacity: 0.2, margin: "0 auto 1rem auto", display: "block" }}
				/>
				<p style={{ marginBottom: "1.5rem" }}>No tienes materias registradas aún.</p>
				<button
					className="btn-add"
					style={{ margin: "0 auto", display: "inline-flex" }}
					onClick={() => {
						const name = window.prompt("Nombre de la nueva materia:");
						if (name) onAddSubject(name);
					}}
				>
					<BookOpen size={15} />
					<span>Agregar materia</span>
				</button>
			</div>
		);
	}

	return (
		<>
			<div
				className="fade-in"
				style={{
					animationDelay: "0.2s",
					marginTop: "1.5rem",
					display: "flex",
					flexDirection: "column",
					gap: "1rem",
				}}
			>
				{allSubjectKeys.map((subject) => {
					const acts = grouped[subject] ?? [];
					const isOpen = expandedSubject === subject;
					const totalHours = acts.reduce((s, a) => s + a.total_estimated_hours, 0);
					const completedCount = acts.filter((a) => a.status === "completed").length;

					return (
						<div
							key={subject}
							style={{
								background: "#1e293b",
								borderRadius: "12px",
								border: isOpen ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid #334155",
								overflow: "hidden",
								transition: "border-color 0.2s",
							}}
						>
							{/* Subject header row */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "12px",
									padding: "14px 20px",
									cursor: "pointer",
									background: isOpen ? "rgba(139, 92, 246, 0.08)" : "transparent",
									transition: "background 0.2s",
								}}
								onClick={() => setExpandedSubject(isOpen ? null : subject)}
							>
								<BookOpen size={18} color="#c084fc" style={{ flexShrink: 0 }} />
								<span style={{ fontWeight: 700, fontSize: "15px", color: "#f1f5f9", flex: 1 }}>
									{subject}
								</span>
								<span
									style={{
										fontSize: "12px",
										color: "#64748b",
										display: "flex",
										alignItems: "center",
										gap: "6px",
									}}
								>
									<span
										style={{
											background: "#0f172a",
											padding: "2px 8px",
											borderRadius: "20px",
											color: "#94a3b8",
										}}
									>
										{acts.length} actividad{acts.length !== 1 ? "es" : ""}
									</span>
									{totalHours > 0 && (
										<span
											style={{
												background: "#0f172a",
												padding: "2px 8px",
												borderRadius: "20px",
												color: "#fbbf24",
											}}
										>
											{totalHours}h
										</span>
									)}
									{completedCount > 0 && (
										<span
											style={{
												background: "rgba(52, 211, 153, 0.1)",
												padding: "2px 8px",
												borderRadius: "20px",
												color: "#34d399",
											}}
										>
											{completedCount} completada{completedCount !== 1 ? "s" : ""}
										</span>
									)}
								</span>
								<div
									style={{ display: "flex", gap: "2px", flexShrink: 0 }}
									onClick={(e) => e.stopPropagation()}
								>
									<button
										title="Renombrar materia"
										onClick={() => setOrgSubjectModal({ mode: "rename", current: subject })}
										style={{
											background: "none",
											border: "none",
											cursor: "pointer",
											padding: "4px 5px",
											color: "#475569",
											borderRadius: "6px",
											display: "flex",
											alignItems: "center",
										}}
										onMouseEnter={(e) => (e.currentTarget.style.color = "#c084fc")}
										onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
									>
										<Pencil size={13} />
									</button>
									<button
										title="Eliminar materia"
										onClick={() => setOrgConfirmDelete(subject)}
										style={{
											background: "none",
											border: "none",
											cursor: "pointer",
											padding: "4px 5px",
											color: "#475569",
											borderRadius: "6px",
											display: "flex",
											alignItems: "center",
										}}
										onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
										onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
									>
										<Trash2 size={13} />
									</button>
								</div>
								<ChevronDown
									size={16}
									color="#64748b"
									style={{
										transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
										transition: "transform 0.2s",
										flexShrink: 0,
									}}
								/>
							</div>

							{/* Subject body */}
							{isOpen && (
								<div style={{ borderTop: "1px solid #334155" }}>
									{acts.length === 0 ? (
										<div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
											<Inbox
												size={28}
												style={{ opacity: 0.4, margin: "0 auto 0.5rem auto", display: "block" }}
											/>
											<p style={{ fontSize: "13px", marginBottom: "1rem" }}>
												No hay actividades en esta materia
											</p>
											<button
												style={{
													background: "transparent",
													border: "1px dashed #475569",
													color: "#94a3b8",
													borderRadius: "6px",
													padding: "6px 14px",
													fontSize: "12px",
													cursor: "pointer",
													display: "inline-flex",
													alignItems: "center",
													gap: "6px",
												}}
												onClick={() => onOpenCreate(subject)}
												onMouseOver={(e) => {
													e.currentTarget.style.borderColor = "#94a3b8";
													e.currentTarget.style.color = "#f1f5f9";
												}}
												onMouseOut={(e) => {
													e.currentTarget.style.borderColor = "#475569";
													e.currentTarget.style.color = "#94a3b8";
												}}
											>
												<Plus size={13} /> Agregar actividad
											</button>
										</div>
									) : (
										<div
											style={{
												padding: "12px",
												display: "flex",
												flexDirection: "column",
												gap: "8px",
											}}
										>
											{acts.map((act) => {
												const isActOpen = expandedActivity === act.id;
												const stState = subtaskStateByActivity[act.id];
												const subtasks = stState?.items ?? [];
												const completedSubs = subtasks.filter(
													(s) => s.status === "completed",
												).length;
												const totalSubs = subtasks.length || act.subtask_count || 0;

												const isActOverdue =
													act.status !== "completed" && daysUntil(act.due_date) < 0;
												return (
													<div
														key={act.id}
														style={{
															borderRadius: "11px",
															border: isActOpen
																? isActOverdue
																	? "1px solid rgba(248,113,113,0.35)"
																	: "1px solid rgba(139,92,246,0.4)"
																: isActOverdue
																	? "1px solid rgba(248,113,113,0.2)"
																	: "1px solid #1e2d45",
															borderLeft: isActOverdue
																? "4px solid #f87171"
																: `4px solid ${statusColors[act.status] ?? "#334155"}`,
															overflow: "hidden",
															transition: "border-color 0.2s, box-shadow 0.2s",
															background: isActOpen
																? isActOverdue
																	? "rgba(30,10,10,0.97)"
																	: "rgba(10,18,35,0.95)"
																: isActOverdue
																	? "rgba(248,113,113,0.04)"
																	: "#0c1628",
															boxShadow: isActOpen
																? isActOverdue
																	? "0 0 0 1px rgba(248,113,113,0.12)"
																	: "0 0 0 1px rgba(139,92,246,0.15)"
																: "none",
															opacity: act.status === "completed" ? 0.6 : 1,
														}}
													>
														{/* Activity header */}
														<div
															style={{
																display: "flex",
																alignItems: "flex-start",
																gap: "12px",
																padding: "14px 16px",
															}}
														>
															<div style={{ flex: 1, minWidth: 0 }}>
																<div
																	style={{
																		display: "flex",
																		alignItems: "center",
																		gap: "8px",
																		marginBottom: "5px",
																		flexWrap: "wrap",
																	}}
																>
																	<span
																		style={{
																			fontSize: "10px",
																			padding: "2px 9px",
																			borderRadius: "20px",
																			background: `${statusColors[act.status] ?? "#64748b"}22`,
																			color: statusColors[act.status] ?? "#64748b",
																			fontWeight: 700,
																			whiteSpace: "nowrap",
																		}}
																	>
																		<span
																			style={{
																				width: 5,
																				height: 5,
																				borderRadius: "50%",
																				background: statusColors[act.status] ?? "#64748b",
																				display: "inline-block",
																				marginRight: 5,
																				verticalAlign: "middle",
																			}}
																		/>
																		{statusLabels[act.status] ?? act.status}
																	</span>
																	<span
																		style={{
																			fontSize: "14px",
																			fontWeight: 700,
																			color: act.status === "completed" ? "#64748b" : "#f1f5f9",
																			textDecoration:
																				act.status === "completed" ? "line-through" : "none",
																			flex: 1,
																			minWidth: 0,
																		}}
																	>
																		{act.title}
																	</span>
																</div>
																<div
																	style={{
																		display: "flex",
																		alignItems: "center",
																		gap: "6px",
																		flexWrap: "wrap",
																	}}
																>
																	{(() => {
																		const d = daysUntil(act.due_date);
																		let dc = "#7dd3fc",
																			db = "rgba(125,211,252,0.1)",
																			dt = formatDate(act.due_date);
																		if (act.status !== "completed") {
																			if (d < 0) {
																				dc = "#f87171";
																				db = "rgba(248,113,113,0.12)";
																				dt = `Vencida ${formatDate(act.due_date)}`;
																			} else if (d === 0) {
																				dc = "#fbbf24";
																				db = "rgba(251,191,36,0.14)";
																				dt = "Hoy";
																			} else if (d === 1) {
																				dc = "#fb923c";
																				db = "rgba(251,146,60,0.13)";
																				dt = "Mañana";
																			} else if (d <= 3) {
																				dc = "#fb923c";
																				db = "rgba(251,146,60,0.10)";
																			}
																		}
																		return (
																			<span
																				style={{
																					fontSize: "11px",
																					padding: "2px 9px",
																					borderRadius: "20px",
																					background: db,
																					color: dc,
																					fontWeight: 600,
																					display: "flex",
																					alignItems: "center",
																					gap: "4px",
																					whiteSpace: "nowrap",
																				}}
																			>
																				<CalendarClock size={11} />
																				{dt}
																			</span>
																		);
																	})()}
																	{act.total_estimated_hours > 0 && (
																		<span
																			style={{
																				fontSize: "11px",
																				padding: "2px 8px",
																				borderRadius: "20px",
																				background: "rgba(251,191,36,0.1)",
																				color: "#d4a017",
																				fontWeight: 700,
																				display: "flex",
																				alignItems: "center",
																				gap: "3px",
																			}}
																		>
																			<Clock size={10} />
																			{act.total_estimated_hours}h
																		</span>
																	)}
																	{totalSubs > 0 && (
																		<span
																			style={{
																				fontSize: "11px",
																				padding: "2px 8px",
																				borderRadius: "20px",
																				background:
																					completedSubs === totalSubs
																						? "rgba(52,211,153,0.1)"
																						: "rgba(99,102,241,0.1)",
																				color: completedSubs === totalSubs ? "#34d399" : "#6366f1",
																				fontWeight: 600,
																				display: "flex",
																				alignItems: "center",
																				gap: "3px",
																			}}
																		>
																			<CheckCircle2 size={10} />
																			{completedSubs}/{totalSubs}
																		</span>
																	)}
																</div>
															</div>
															<div
																style={{
																	display: "flex",
																	alignItems: "center",
																	gap: "6px",
																	flexShrink: 0,
																	paddingTop: "2px",
																}}
															>
																<button
																	style={{
																		background: isActOpen
																			? "rgba(139,92,246,0.2)"
																			: "rgba(99,102,241,0.08)",
																		border: `1px solid ${isActOpen ? "rgba(192,132,252,0.5)" : "#1e3050"}`,
																		color: isActOpen ? "#c084fc" : "#64748b",
																		borderRadius: "7px",
																		padding: "5px 10px",
																		fontSize: "11px",
																		cursor: "pointer",
																		display: "flex",
																		alignItems: "center",
																		gap: "4px",
																		transition: "all 0.18s",
																		whiteSpace: "nowrap",
																	}}
																	onClick={() => toggleActivity(act.id)}
																	onMouseOver={(e) => {
																		if (!isActOpen) {
																			e.currentTarget.style.borderColor = "#c084fc";
																			e.currentTarget.style.color = "#c084fc";
																		}
																	}}
																	onMouseOut={(e) => {
																		if (!isActOpen) {
																			e.currentTarget.style.borderColor = "#1e3050";
																			e.currentTarget.style.color = "#64748b";
																		}
																	}}
																>
																	{stState?.loading ? (
																		<Loader2 size={12} className="spinner" />
																	) : (
																		<ClipboardList size={12} />
																	)}
																	Subtareas
																	<ChevronDown
																		size={11}
																		style={{
																			transform: isActOpen ? "rotate(180deg)" : "rotate(0deg)",
																			transition: "transform 0.18s",
																		}}
																	/>
																</button>
																<button
																	style={{
																		background: "transparent",
																		border: "none",
																		color: "#334155",
																		cursor: "pointer",
																		padding: "5px",
																		borderRadius: "5px",
																		display: "flex",
																		transition: "color 0.15s",
																	}}
																	onClick={() => setOrgEditActivity(act)}
																	onMouseOver={(e) => (e.currentTarget.style.color = "#c084fc")}
																	onMouseOut={(e) => (e.currentTarget.style.color = "#334155")}
																	title="Editar actividad"
																>
																	<Pencil size={14} />
																</button>
																<button
																	style={{
																		background: "transparent",
																		border: "none",
																		color: "#334155",
																		cursor: "pointer",
																		padding: "5px",
																		borderRadius: "5px",
																		display: "flex",
																		transition: "color 0.15s",
																	}}
																	onClick={() => onDelete(act.id, act.title)}
																	onMouseOver={(e) => (e.currentTarget.style.color = "#f87171")}
																	onMouseOut={(e) => (e.currentTarget.style.color = "#334155")}
																	title="Eliminar actividad"
																>
																	<Trash2 size={14} />
																</button>
															</div>
														</div>
														{isActOpen && (
															<div
																style={{
																	borderTop: "1px solid #0f1e33",
																	padding: "6px 16px 14px 16px",
																}}
															>
																{totalSubs > 0 && (
																	<div style={{ marginBottom: "10px", marginTop: "6px" }}>
																		<div
																			style={{
																				display: "flex",
																				justifyContent: "space-between",
																				marginBottom: "4px",
																			}}
																		>
																			<span
																				style={{
																					fontSize: "10px",
																					color: "#475569",
																					fontWeight: 600,
																				}}
																			>
																				PROGRESO
																			</span>
																			<span style={{ fontSize: "10px", color: "#64748b" }}>
																				{completedSubs} de {totalSubs}
																			</span>
																		</div>
																		<div
																			style={{
																				height: "4px",
																				background: "#0f172a",
																				borderRadius: "4px",
																				overflow: "hidden",
																			}}
																		>
																			<div
																				style={{
																					height: "100%",
																					width: `${totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0}%`,
																					background: "linear-gradient(90deg,#7c3aed,#34d399)",
																					borderRadius: "4px",
																					transition: "width 0.4s",
																				}}
																			/>
																		</div>
																	</div>
																)}
																{stState?.loading && (
																	<div
																		style={{
																			display: "flex",
																			alignItems: "center",
																			gap: "8px",
																			color: "#475569",
																			fontSize: "12px",
																			padding: "8px 0",
																		}}
																	>
																		<Loader2 size={13} className="spinner" />
																		<span>Cargando subtareas...</span>
																	</div>
																)}
																{!stState?.loading && subtasks.length === 0 && (
																	<p
																		style={{
																			fontSize: "12px",
																			color: "#334155",
																			padding: "8px 0",
																			margin: 0,
																		}}
																	>
																		Sin subtareas registradas.
																	</p>
																)}
																{!stState?.loading && subtasks.length > 0 && (
																	<div
																		style={{ display: "flex", flexDirection: "column", gap: "2px" }}
																	>
																		{subtasks.map((sub) => {
																			const sCols: Record<string, string> = {
																				pending: "#fbbf24",
																				in_progress: "#60a5fa",
																				completed: "#34d399",
																			};
																			const sLbls: Record<string, string> = {
																				pending: "Pendiente",
																				in_progress: "En progreso",
																				completed: "Completada",
																			};
																			const subDiff = daysUntil(sub.target_date);
																			let sdColor = "#7dd3fc",
																				sdBg = "rgba(125,211,252,0.08)";
																			if (sub.status !== "completed") {
																				if (subDiff < 0) {
																					sdColor = "#f87171";
																					sdBg = "rgba(248,113,113,0.1)";
																				} else if (subDiff === 0) {
																					sdColor = "#fbbf24";
																					sdBg = "rgba(251,191,36,0.1)";
																				} else if (subDiff === 1) {
																					sdColor = "#fb923c";
																					sdBg = "rgba(251,146,60,0.1)";
																				}
																			}
																			return (
																				<div
																					key={sub.id}
																					style={{
																						display: "flex",
																						alignItems: "center",
																						gap: "10px",
																						padding: "7px 10px",
																						borderRadius: "8px",
																						background:
																							sub.status === "completed"
																								? "transparent"
																								: "rgba(14,24,42,0.7)",
																						border:
																							sub.status === "completed"
																								? "none"
																								: "1px solid #0f1e33",
																						transition: "background 0.15s",
																					}}
																				>
																					{sub.status === "completed" ? (
																						<CheckCircle2
																							size={14}
																							color="#34d399"
																							style={{ flexShrink: 0 }}
																						/>
																					) : (
																						<Circle
																							size={14}
																							color="#2d4a6a"
																							style={{ flexShrink: 0 }}
																						/>
																					)}
																					<span
																						style={{
																							flex: 1,
																							fontSize: "12px",
																							fontWeight: 500,
																							color:
																								sub.status === "completed" ? "#334155" : "#cbd5e1",
																							textDecoration:
																								sub.status === "completed"
																									? "line-through"
																									: "none",
																						}}
																					>
																						{sub.name}
																					</span>
																					{sub.target_date && (
																						<span
																							style={{
																								fontSize: "10px",
																								padding: "1px 7px",
																								borderRadius: "20px",
																								background: sdBg,
																								color: sdColor,
																								fontWeight: 600,
																								whiteSpace: "nowrap",
																							}}
																						>
																							{formatDate(sub.target_date)}
																						</span>
																					)}
																					{sub.estimated_hours > 0 && (
																						<span
																							style={{
																								fontSize: "10px",
																								padding: "1px 7px",
																								borderRadius: "20px",
																								background: "rgba(251,191,36,0.08)",
																								color: "#a07020",
																								fontWeight: 600,
																							}}
																						>
																							{sub.estimated_hours}h
																						</span>
																					)}
																					<span
																						style={{
																							fontSize: "10px",
																							padding: "1px 7px",
																							borderRadius: "20px",
																							background: `${sCols[sub.status] ?? "#64748b"}18`,
																							color: sCols[sub.status] ?? "#64748b",
																							fontWeight: 600,
																							whiteSpace: "nowrap",
																						}}
																					>
																						{sLbls[sub.status] ?? sub.status}
																					</span>
																				</div>
																			);
																		})}
																	</div>
																)}
																<button
																	style={{
																		marginTop: "8px",
																		background: "transparent",
																		border: "1px dashed #1e3050",
																		color: "#334155",
																		borderRadius: "6px",
																		padding: "5px 12px",
																		fontSize: "11px",
																		cursor: "pointer",
																		display: "flex",
																		alignItems: "center",
																		gap: "4px",
																		transition: "all 0.15s",
																	}}
																	onClick={() => setSubtaskModalActivity(act)}
																	onMouseOver={(e) => {
																		e.currentTarget.style.borderColor = "#c084fc";
																		e.currentTarget.style.color = "#c084fc";
																	}}
																	onMouseOut={(e) => {
																		e.currentTarget.style.borderColor = "#1e3050";
																		e.currentTarget.style.color = "#334155";
																	}}
																>
																	<Plus size={11} /> Agregar subtarea
																</button>
															</div>
														)}
													</div>
												);
											})}

											{/* Add activity to subject */}
											<button
												style={{
													background: "transparent",
													border: "1px dashed #334155",
													color: "#64748b",
													borderRadius: "8px",
													padding: "8px 14px",
													fontSize: "12px",
													cursor: "pointer",
													display: "flex",
													alignItems: "center",
													gap: "6px",
													transition: "all 0.2s",
												}}
												onClick={() => onOpenCreate(subject)}
												onMouseOver={(e) => {
													e.currentTarget.style.borderColor = "#c084fc";
													e.currentTarget.style.color = "#c084fc";
												}}
												onMouseOut={(e) => {
													e.currentTarget.style.borderColor = "#334155";
													e.currentTarget.style.color = "#64748b";
												}}
											>
												<Plus size={13} /> Agregar actividad a {subject}
											</button>
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Subtask manager modal */}
			{subtaskModalActivity && (
				<SubtaskManagerModal
					activityId={subtaskModalActivity.id}
					activityTitle={subtaskModalActivity.title}
					open={true}
					onClose={() => {
						const id = subtaskModalActivity.id;
						setSubtaskModalActivity(null);
						void loadSubtasks(id, true);
					}}
				/>
			)}

			{/* Subject name modal */}
			{orgSubjectModal &&
				createPortal(
					<div
						style={{
							position: "fixed",
							inset: 0,
							background: "rgba(4,3,12,0.72)",
							backdropFilter: "blur(14px) saturate(150%)",
							WebkitBackdropFilter: "blur(14px) saturate(150%)",
							zIndex: 9998,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						onClick={() => setOrgSubjectModal(null)}
					>
						<SubjectFormModal
							mode={orgSubjectModal.mode}
							current={orgSubjectModal.current}
							onClose={() => setOrgSubjectModal(null)}
							onConfirm={(name: string) => {
								if (orgSubjectModal.mode === "add") onAddSubject(name);
								else onRenameSubject(orgSubjectModal.current!, name);
								setOrgSubjectModal(null);
							}}
						/>
					</div>,
					document.body,
				)}

			{/* Confirm delete subject modal */}
			{orgConfirmDelete &&
				createPortal(
					<div
						style={{
							position: "fixed",
							inset: 0,
							background: "rgba(4,3,12,0.72)",
							backdropFilter: "blur(14px) saturate(150%)",
							WebkitBackdropFilter: "blur(14px) saturate(150%)",
							zIndex: 9998,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							animation: "fadeInBackdrop 0.18s ease",
						}}
						onClick={() => setOrgConfirmDelete(null)}
					>
						<div
							onClick={(e) => e.stopPropagation()}
							style={{
								fontFamily: "inherit",
								position: "relative",
								background: "linear-gradient(155deg,#1a0e0e 0%,#110909 55%,#090404 100%)",
								border: "1px solid rgba(248,113,113,0.2)",
								borderRadius: "16px",
								animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
								padding: "28px",
								width: "380px",
								display: "flex",
								flexDirection: "column",
								gap: "16px",
								boxShadow: "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(239,68,68,0.03)",
							}}
						>
							<div
								className="modal-glow-line"
								style={{
									background:
										"linear-gradient(90deg, transparent, rgba(239,68,68,0.5) 28%, rgba(248,113,113,0.3) 62%, transparent)",
								}}
							/>
							<div
								style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
									<div
										style={{
											background: "rgba(239,68,68,0.12)",
											borderRadius: "50%",
											padding: "10px",
											display: "flex",
										}}
									>
										<Trash2 size={20} color="#f87171" />
									</div>
									<div>
										<h3 style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "16px", margin: 0 }}>
											Eliminar materia
										</h3>
										<p style={{ color: "#64748b", fontSize: "12px", margin: "3px 0 0" }}>
											Las actividades asociadas no se borrarán.
										</p>
									</div>
								</div>
								<button
									onClick={() => setOrgConfirmDelete(null)}
									className="modal-close-x"
									aria-label="Cerrar"
								>
									<X size={15} />
								</button>
							</div>
							<p
								style={{
									color: "#cbd5e1",
									fontSize: "14px",
									background: "#0f172a",
									padding: "10px 14px",
									borderRadius: "8px",
									margin: 0,
								}}
							>
								¿Eliminar <strong style={{ color: "#f1f5f9" }}>{orgConfirmDelete}</strong> de la
								lista de materias?
							</p>
							<div style={{ display: "flex", gap: "8px" }}>
								<button
									onClick={() => {
										onRemoveSubject(orgConfirmDelete);
										setOrgConfirmDelete(null);
									}}
									className="modal-btn-danger"
									style={{
										flex: 1,
										padding: "11px 14px",
										borderRadius: "8px",
										border: "none",
										cursor: "pointer",
										fontSize: "13px",
										fontWeight: 700,
										background: "#ef4444",
										color: "#fff",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										gap: "7px",
									}}
								>
									<Trash2 size={13} /> Eliminar
								</button>
								<button
									onClick={() => setOrgConfirmDelete(null)}
									className="modal-btn-cancel"
									style={{
										padding: "11px 18px",
										borderRadius: "8px",
										border: "1px solid #334155",
										cursor: "pointer",
										fontSize: "13px",
										fontWeight: 600,
										background: "transparent",
										color: "#94a3b8",
									}}
								>
									Cancelar
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Edit activity modal */}
			{orgEditActivity &&
				createPortal(
					<div
						style={{
							position: "fixed",
							inset: 0,
							background: "rgba(4,3,12,0.72)",
							backdropFilter: "blur(14px) saturate(150%)",
							WebkitBackdropFilter: "blur(14px) saturate(150%)",
							zIndex: 9998,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							animation: "fadeInBackdrop 0.18s ease",
						}}
						onClick={() => setOrgEditActivity(null)}
					>
						<EditActivityForm
							activity={orgEditActivity}
							subjects={subjects}
							onClose={() => setOrgEditActivity(null)}
							onSave={async (id, payload) => {
								const updated = await updateActivity(id, payload);
								onActivityUpdate(updated);
								setOrgEditActivity(null);
								toast.success("Actividad actualizada");
							}}
						/>
					</div>,
					document.body,
				)}
		</>
	);
}

// re-export so Dashboard.tsx doesn't need updating
export { SubjectFormModal } from "./OrgModals";
