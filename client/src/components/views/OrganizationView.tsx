import { useState, useMemo, useEffect } from "react";
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
import { updateActivity, fetchSubtasks, type Activity, type Subtask } from "@/api/dashboard";
import { toast } from "sonner";
import "@/pages/Dashboard/Dashboard.css";
import { formatDate, daysUntil } from "@/pages/Dashboard/utils/dashboardUtils";
import { EditActivityForm, SubjectFormModal } from "@/components/modals/Organizations/OrgModals";
import SubtaskManagerModal from "@/components/modals/Subtasks/SubtaskManagerModal";
import { useTheme } from "@/hooks/useTheme";

interface OrgViewProps {
	activities: Activity[];
	subjects: string[];
	onDelete: (id: number, title: string) => void;
	onAddSubject: (name: string) => void;
	onRemoveSubject: (name: string) => Promise<void>;
	onRenameSubject: (oldName: string, newName: string) => Promise<void>;
	onActivityUpdate: (updated: Activity) => void;
	onSubtaskMutated?: () => void;
	dateLoadMap?: Record<string, number>;
	conflictDates?: string[];
	maxDailyHours?: number;
	onActivitySaved?: (updated: Activity, previous: Activity) => void;
	onOpenCreate: (subject?: string) => void;
	activeFilters: string[];
	searchQuery: string;
	expandSubject?: { subject: string } | null;
}

function toTestIdToken(value: string): string {
	return (
		value
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "item"
	);
}

export default function OrganizationView({
	activities,
	subjects,
	onDelete,
	onAddSubject,
	onRemoveSubject,
	onRenameSubject,
	onActivityUpdate,
	onSubtaskMutated,
	dateLoadMap = {},
	conflictDates = [],
	maxDailyHours = 0,
	onActivitySaved,
	onOpenCreate,
	activeFilters,
	searchQuery,
	expandSubject,
}: OrgViewProps) {
	const { isDark } = useTheme();
	const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

	const [orgPage, setOrgPage] = useState(1);
	const ORG_LIMIT = 10;

	useEffect(() => {
		if (expandSubject?.subject) {
			setExpandedSubject(expandSubject.subject);
		}
	}, [expandSubject]);
	const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
	const [orgSubjectModal, setOrgSubjectModal] = useState<{
		mode: "add" | "rename";
		current?: string;
	} | null>(null);
	const [orgConfirmDelete, setOrgConfirmDelete] = useState<string | null>(null);
	const [subjectDeleteLoading, setSubjectDeleteLoading] = useState(false);
	const [subjectRenameLoading, setSubjectRenameLoading] = useState(false);
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

	async function loadSubtasks(
		activityId: number,
		force = false,
	): Promise<import("@/api/dashboard").Subtask[]> {
		if (!force && subtaskStateByActivity[activityId]?.items.length)
			return subtaskStateByActivity[activityId].items;
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
			return items;
		} catch {
			setSubtaskStateByActivity((prev) => ({
				...prev,
				[activityId]: { loading: false, items: [] },
			}));
			return [];
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

	const ov = {
		// Empty state
		emptyClr: isDark ? "#94a3b8" : "#7a62c9",
		// Subject cards
		subBg: isDark ? "#1e293b" : "rgba(255,255,255,0.85)",
		subBdr: isDark ? "#334155" : "rgba(124,92,255,0.2)",
		subBdrOpen: isDark ? "rgba(139,92,246,0.4)" : "rgba(124,92,255,0.5)",
		subHdBg: isDark ? "rgba(139,92,246,0.08)" : "rgba(124,92,255,0.06)",
		subTitle: isDark ? "#f1f5f9" : "#1e1a33",
		subMeta: isDark ? "#64748b" : "#9580c9",
		badgeBg: isDark ? "#0f172a" : "rgba(124,92,255,0.07)",
		badgeClr: isDark ? "#94a3b8" : "#6b52b5",
		subBodyBdr: isDark ? "#334155" : "rgba(124,92,255,0.15)",
		iconClr: isDark ? "#475569" : "#b8a8e0",
		// Empty-subject content
		emptySubClr: isDark ? "#64748b" : "#9580c9",
		emptyBtnBdr: isDark ? "#475569" : "rgba(124,92,255,0.3)",
		emptyBtnClr: isDark ? "#94a3b8" : "#7a62c9",
		// Activity cards
		actBg: isDark ? "#0c1628" : "rgba(255,255,255,0.8)",
		actBgOpen: isDark ? "rgba(10,18,35,0.95)" : "rgba(247,245,255,0.98)",
		actBgOvd: isDark ? "rgba(248,113,113,0.04)" : "rgba(248,113,113,0.04)",
		actBgOvdOpen: isDark ? "rgba(30,10,10,0.97)" : "rgba(255,240,240,0.98)",
		actBdr: isDark ? "#1e2d45" : "rgba(124,92,255,0.12)",
		actBdrOpen: isDark ? "rgba(139,92,246,0.4)" : "rgba(124,92,255,0.5)",
		actBdrOvd: isDark ? "rgba(248,113,113,0.2)" : "rgba(248,113,113,0.2)",
		actBdrOvdOpen: isDark ? "rgba(248,113,113,0.35)" : "rgba(248,113,113,0.35)",
		actTitle: isDark ? "#f1f5f9" : "#1e1a33",
		actTitleDone: isDark ? "#64748b" : "#9580c9",
		// Subtareas toggle button
		staBg: isDark ? "rgba(99,102,241,0.08)" : "rgba(124,92,255,0.06)",
		staBgOpen: isDark ? "rgba(139,92,246,0.2)" : "rgba(124,92,255,0.12)",
		staBdr: isDark ? "#1e3050" : "rgba(124,92,255,0.2)",
		staBdrOpen: isDark ? "rgba(192,132,252,0.5)" : "rgba(124,92,255,0.5)",
		staClr: isDark ? "#64748b" : "#9580c9",
		staClrOpen: isDark ? "#c084fc" : "#7c3aed",
		// Edit/Delete icon buttons (rest)
		actIconClr: isDark ? "#334155" : "#c4b5fd",
		// Expanded activity section
		actBodyBdr: isDark ? "#0f1e33" : "rgba(124,92,255,0.1)",
		progTrack: isDark ? "#0f172a" : "rgba(124,92,255,0.08)",
		progLabel: isDark ? "#475569" : "#9580c9",
		progCount: isDark ? "#64748b" : "#a89bd4",
		loadClr: isDark ? "#475569" : "#9580c9",
		noSubClr: isDark ? "#334155" : "#a89bd4",
		// Subtask rows
		subRowBg: isDark ? "rgba(14,24,42,0.7)" : "rgba(124,92,255,0.04)",
		subRowBdr: isDark ? "#0f1e33" : "rgba(124,92,255,0.1)",
		subCircle: isDark ? "#2d4a6a" : "#c4b5fd",
		subName: isDark ? "#cbd5e1" : "#3d3466",
		subNameDone: isDark ? "#334155" : "#a89bd4",
		subHrClr: isDark ? "#a07020" : "#8b6d20",
		// Add-subtask button
		addSubBdr: isDark ? "#1e3050" : "rgba(124,92,255,0.2)",
		addSubClr: isDark ? "#334155" : "#a89bd4",
		// Add-activity button
		addActBdr: isDark ? "#334155" : "rgba(124,92,255,0.2)",
		addActClr: isDark ? "#64748b" : "#9580c9",
		// Delete-subject modal
		delModalBg: isDark
			? "linear-gradient(155deg,#1a0e0e 0%,#110909 55%,#090404 100%)"
			: "linear-gradient(155deg,#fff5f5 0%,#fff0f0 55%,#ffe8e8 100%)",
		delTitle: isDark ? "#f1f5f9" : "#1e1a33",
		delDesc: isDark ? "#f1f5f9" : "#2d1a1a",
		delCancelBdr: isDark ? "#334155" : "rgba(239,68,68,0.3)",
		delCancelClr: isDark ? "#94a3b8" : "#9a3a3a",
		hrsBadgeBg: isDark ? "#0f172a" : "rgba(251,191,36,0.1)",
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

	const paginatedSubjectKeys = useMemo(() => {
		return allSubjectKeys.slice(0, orgPage * ORG_LIMIT);
	}, [allSubjectKeys, orgPage]);

	const hasMoreSubjects = paginatedSubjectKeys.length < allSubjectKeys.length;

	if (allSubjectKeys.length === 0) {
		return (
			<div
				className="fade-in"
				data-testid="org-empty-state"
				style={{
					padding: "4rem 2rem",
					textAlign: "center",
					color: ov.emptyClr,
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
					data-testid="org-empty-add-subject-btn"
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
				data-testid="org-view"
				style={{
					animationDelay: "0.2s",
					marginTop: "1.5rem",
					display: "flex",
					flexDirection: "column",
					gap: "1rem",
				}}
			>
				{paginatedSubjectKeys.map((subject) => {
					const acts = grouped[subject] ?? [];
					const isOpen = expandedSubject === subject;
					const subjectToken = toTestIdToken(subject);
					const totalHours = acts.reduce((s, a) => s + a.total_estimated_hours, 0);
					const completedCount = acts.filter((a) => a.status === "completed").length;

					return (
						<div
							key={subject}
							data-testid={`org-subject-card-${subjectToken}`}
							style={{
								background: ov.subBg,
								borderRadius: "12px",
								border: `1px solid ${isOpen ? ov.subBdrOpen : ov.subBdr}`,
								overflow: "hidden",
								transition: "border-color 0.2s",
							}}
						>
							{/* Subject header row */}
							<div
								data-testid={`org-subject-header-${subjectToken}`}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "12px",
									padding: "14px 20px",
									cursor: "pointer",
									background: isOpen ? ov.subHdBg : "transparent",
									transition: "background 0.2s",
								}}
								onClick={() => setExpandedSubject(isOpen ? null : subject)}
							>
								<BookOpen size={18} color="#c084fc" style={{ flexShrink: 0 }} />
								<span style={{ fontWeight: 700, fontSize: "15px", color: ov.subTitle, flex: 1 }}>
									{subject}
								</span>
								<span
									style={{
										fontSize: "12px",
										color: ov.subMeta,
										display: "flex",
										alignItems: "center",
										gap: "6px",
									}}
								>
									<span
										style={{
											background: ov.badgeBg,
											padding: "2px 8px",
											borderRadius: "20px",
											color: ov.badgeClr,
										}}
									>
										{acts.length} actividad{acts.length !== 1 ? "es" : ""}
									</span>
									{totalHours > 0 && (
										<span
											style={{
												background: ov.hrsBadgeBg,
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
									data-testid={`org-subject-actions-${subjectToken}`}
								>
									<button
										title="Renombrar materia"
										onClick={() => setOrgSubjectModal({ mode: "rename", current: subject })}
										data-testid={`org-subject-rename-btn-${subjectToken}`}
										style={{
											background: "none",
											border: "none",
											cursor: "pointer",
											padding: "4px 5px",
											color: ov.iconClr,
											borderRadius: "6px",
											display: "flex",
											alignItems: "center",
										}}
										onMouseEnter={(e) => (e.currentTarget.style.color = "#c084fc")}
										onMouseLeave={(e) => (e.currentTarget.style.color = ov.iconClr)}
									>
										<Pencil size={13} />
									</button>
									<button
										title="Eliminar materia"
										onClick={() => setOrgConfirmDelete(subject)}
										data-testid={`org-subject-delete-btn-${subjectToken}`}
										style={{
											background: "none",
											border: "none",
											cursor: "pointer",
											padding: "4px 5px",
											color: ov.iconClr,
											borderRadius: "6px",
											display: "flex",
											alignItems: "center",
										}}
										onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
										onMouseLeave={(e) => (e.currentTarget.style.color = ov.iconClr)}
									>
										<Trash2 size={13} />
									</button>
								</div>
								<ChevronDown
									size={16}
									color={ov.subMeta}
									style={{
										transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
										transition: "transform 0.2s",
										flexShrink: 0,
									}}
								/>
							</div>

							{/* Subject body */}
							{isOpen && (
								<div
									data-testid={`org-subject-body-${subjectToken}`}
									style={{
										borderTop: `1px solid ${ov.subBodyBdr}`,
										animation: "orgSlideDown 0.25s cubic-bezier(0.16,1,0.3,1)",
									}}
								>
									{acts.length === 0 ? (
										<div style={{ padding: "2rem", textAlign: "center", color: ov.emptySubClr }}>
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
													border: `1px dashed ${ov.emptyBtnBdr}`,
													color: ov.emptyBtnClr,
													borderRadius: "6px",
													padding: "6px 14px",
													fontSize: "12px",
													cursor: "pointer",
													display: "inline-flex",
													alignItems: "center",
													gap: "6px",
												}}
												onClick={() => onOpenCreate(subject)}
												data-testid={`org-subject-add-activity-empty-btn-${subjectToken}`}
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
												const completedSubs = act.completed_subtasks_count ?? subtasks.filter(
													(s) => s.status === "completed",
												).length;
												const totalSubs = act.total_subtasks_count ?? act.subtask_count ?? subtasks.length ?? 0;

												const isActOverdue =
													act.status !== "completed" && daysUntil(act.due_date) < 0;
												return (
													<div
														key={act.id}
														data-testid={`org-activity-card-${act.id}`}
														style={{
															borderRadius: "11px",
															border: isActOpen
																? isActOverdue
																	? `1px solid ${ov.actBdrOvdOpen}`
																	: `1px solid ${ov.actBdrOpen}`
																: isActOverdue
																	? `1px solid ${ov.actBdrOvd}`
																	: `1px solid ${ov.actBdr}`,
															borderLeft: isActOverdue
																? "4px solid #f87171"
																: `4px solid ${statusColors[act.status] ?? ov.actBdr}`,
															overflow: "hidden",
															transition: "border-color 0.2s, box-shadow 0.2s",
															background: isActOpen
																? isActOverdue
																	? ov.actBgOvdOpen
																	: ov.actBgOpen
																: isActOverdue
																	? ov.actBgOvd
																	: ov.actBg,
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
																			color:
																				act.status === "completed" ? ov.actTitleDone : ov.actTitle,
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
																		border: `1px solid ${isActOpen ? ov.staBdrOpen : ov.staBdr}`,
																		color: isActOpen ? ov.staClrOpen : ov.staClr,
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
																	data-testid={`org-activity-subtasks-toggle-${act.id}`}
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
																		color: ov.actIconClr,
																		cursor: "pointer",
																		padding: "5px",
																		borderRadius: "5px",
																		display: "flex",
																		transition: "color 0.15s",
																	}}
																	onClick={() => setOrgEditActivity(act)}
																	data-testid={`org-activity-edit-btn-${act.id}`}
																	onMouseOver={(e) => (e.currentTarget.style.color = "#c084fc")}
																	onMouseOut={(e) => (e.currentTarget.style.color = "#334155")}
																	title="Editar actividad"
																>
																	<Pencil />
																</button>
																<button
																	style={{
																		background: "transparent",
																		border: "none",
																		color: ov.actIconClr,
																		cursor: "pointer",
																		padding: "5px",
																		borderRadius: "5px",
																		display: "flex",
																		transition: "color 0.15s",
																	}}
																	onClick={() => onDelete(act.id, act.title)}
																	data-testid={`org-activity-delete-btn-${act.id}`}
																	onMouseOver={(e) => (e.currentTarget.style.color = "#f87171")}
																	onMouseOut={(e) => (e.currentTarget.style.color = "#334155")}
																	title="Eliminar actividad"
																>
																	<Trash2 />
																</button>
															</div>
														</div>
														<div
															style={{
																display: "grid",
																gridTemplateRows: isActOpen ? "1fr" : "0fr",
																transition: "grid-template-rows 0.22s cubic-bezier(0.16,1,0.3,1)",
															}}
														>
															<div style={{ overflow: "hidden" }}>
																<div
																	style={{
																		borderTop: `1px solid ${ov.actBodyBdr}`,
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
																						color: ov.progLabel,
																						fontWeight: 600,
																					}}
																				>
																					PROGRESO
																				</span>
																				<span style={{ fontSize: "10px", color: ov.progCount }}>
																					{completedSubs} de {totalSubs}
																				</span>
																			</div>
																			<div
																				style={{
																					height: "4px",
																					background: ov.progTrack,
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
																				color: ov.loadClr,
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
																				color: ov.noSubClr,
																				padding: "8px 0",
																				margin: 0,
																			}}
																		>
																			Sin subtareas registradas.
																		</p>
																	)}
																	{!stState?.loading && subtasks.length > 0 && (
																		<div
																			style={{
																				display: "flex",
																				flexDirection: "column",
																				gap: "2px",
																			}}
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
																						data-testid={`org-subtask-row-${sub.id}`}
																						style={{
																							display: "flex",
																							alignItems: "center",
																							gap: "10px",
																							padding: "7px 10px",
																							borderRadius: "8px",
																							background:
																								sub.status === "completed"
																									? "transparent"
																									: ov.subRowBg,
																							border:
																								sub.status === "completed"
																									? "none"
																									: `1px solid ${ov.subRowBdr}`,
																							transition: "background 0.15s",
																						}}
																					>
																						{sub.status === "completed" ? (
																							<CheckCircle2
																								color="#34d399"
																								style={{ flexShrink: 0 }}
																							/>
																						) : (
																							<Circle
																								color={ov.subCircle}
																								style={{ flexShrink: 0 }}
																							/>
																						)}
																						<span
																							style={{
																								flex: 1,
																								fontSize: "12px",
																								fontWeight: 500,
																								color:
																									sub.status === "completed"
																										? ov.subNameDone
																										: ov.subName,
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
																									color: ov.subHrClr,
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
																			border: `1px dashed ${ov.addSubBdr}`,
																			color: ov.addSubClr,
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
																		data-testid={`org-activity-add-subtask-btn-${act.id}`}
																		onMouseOver={(e) => {
																			e.currentTarget.style.borderColor = "#c084fc";
																			e.currentTarget.style.color = "#c084fc";
																		}}
																		onMouseOut={(e) => {
																			e.currentTarget.style.borderColor = ov.addSubBdr;
																			e.currentTarget.style.color = ov.addSubClr;
																		}}
																	>
																		<Plus size={11} /> Agregar subtarea
																	</button>
																</div>
															</div>
														</div>
													</div>
												);
											})}

											{/* Add activity to subject */}
											<button
												style={{
													background: "transparent",
													border: `1px dashed ${ov.addActBdr}`,
													color: ov.addActClr,
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
												data-testid={`org-subject-add-activity-btn-${subjectToken}`}
												onMouseOver={(e) => {
													e.currentTarget.style.borderColor = "#c084fc";
													e.currentTarget.style.color = "#c084fc";
												}}
												onMouseOut={(e) => {
													e.currentTarget.style.borderColor = ov.addActBdr;
													e.currentTarget.style.color = ov.addActClr;
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
				{hasMoreSubjects && (
					<button
						onClick={() => setOrgPage((prev) => prev + 1)}
						style={{
							marginTop: "8px",
							padding: "10px",
							width: "100%",
							background: ov.subBg,
							border: `1px solid ${ov.subBdr}`,
							borderRadius: "12px",
							color: ov.iconClr,
							fontSize: "13px",
							fontWeight: 600,
							cursor: "pointer",
							transition: "all 0.15s",
						}}
						onMouseOver={(e) => {
							e.currentTarget.style.background = isDark ? "#132040" : "rgba(124,92,255,0.08)";
						}}
						onMouseOut={(e) => {
							e.currentTarget.style.background = ov.subBg;
						}}
					>
						Cargar Más Materias
					</button>
				)}
			</div>

			{/* Subtask manager modal */}
			{subtaskModalActivity && (
				<SubtaskManagerModal
					activityId={subtaskModalActivity.id}
					activityTitle={subtaskModalActivity.title}
					activityDueDate={subtaskModalActivity.due_date}
					dateLoadMap={dateLoadMap}
					conflictDates={conflictDates}
					maxDailyHours={maxDailyHours}
					qaPrefix="org-subtask-manager-modal"
					open={true}
					onSubtasksChange={(items) => {
						setSubtaskStateByActivity((prev) => ({
							...prev,
							[subtaskModalActivity.id]: { loading: false, items },
						}));
						onActivityUpdate({
							...subtaskModalActivity,
							subtask_count: items.length,
							total_estimated_hours: items.reduce(
								(s, x) => s + (Number(x.estimated_hours) || 0),
								0,
							),
						});
						onSubtaskMutated?.();
					}}
					onClose={async () => {
						const act = subtaskModalActivity;
						setSubtaskModalActivity(null);
						const items = await loadSubtasks(act.id, true);
						const newTotal = items.reduce((s, x) => s + (Number(x.estimated_hours) || 0), 0);
						onActivityUpdate({
							...act,
							total_estimated_hours: newTotal,
							subtask_count: items.length,
						});
					}}
				/>
			)}

			{/* Subject name modal */}
			{orgSubjectModal &&
				createPortal(
					<div
						data-testid="org-subject-form-layer"
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
							onConfirm={async (name: string) => {
								if (orgSubjectModal.mode === "add") {
									onAddSubject(name);
									setOrgSubjectModal(null);
									toast.success("Materia agregada");
								} else {
									setSubjectRenameLoading(true);
									try {
										await onRenameSubject(orgSubjectModal.current!, name);
										setOrgSubjectModal(null);
										toast.success("Materia renombrada");
									} catch {
										toast.error("No se pudo renombrar la materia.");
									} finally {
										setSubjectRenameLoading(false);
									}
								}
							}}
							isLoading={subjectRenameLoading}
						/>
					</div>,
					document.body,
				)}

			{/* Confirm delete subject modal */}
			{orgConfirmDelete &&
				createPortal(
					<div
						data-testid="org-subject-delete-layer"
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
							data-testid="org-subject-delete-modal"
							style={{
								fontFamily: "inherit",
								position: "relative",
								background: ov.delModalBg,
								border: `1px solid ${ov.actBdrOvd}`,
								borderRadius: "16px",
								animation: "fadeInScale 0.22s cubic-bezier(0.16,1,0.3,1)",
								padding: "28px",
								width: "420px",
								display: "flex",
								flexDirection: "column",
								gap: "16px",
								boxShadow: "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(239,68,68,0.03)",
								overflow: "hidden",
							}}
						>
							{/* Bloom */}
							<div
								style={{
									position: "absolute",
									top: "-20px",
									left: "-20px",
									right: "-20px",
									height: "160px",
									background:
										"radial-gradient(ellipse 85% 55% at 50% 0%, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 50%, transparent 100%)",
									pointerEvents: "none",
									zIndex: 1,
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
										<h3
											style={{ color: ov.delTitle, fontWeight: 700, fontSize: "16px", margin: 0 }}
										>
											Eliminar materia
										</h3>
										<p
											style={{
												color: "#f87171",
												fontSize: "12px",
												margin: "3px 0 0",
												fontWeight: 600,
											}}
										>
											Acción irreversible
										</p>
									</div>
								</div>
								<button
									onClick={() => setOrgConfirmDelete(null)}
									className="modal-close-x"
									aria-label="Cerrar"
									data-testid="org-subject-delete-close-btn"
								>
									<X size={15} />
								</button>
							</div>
							{/* Cascade explanation */}
							<div
								style={{
									background: "rgba(239,68,68,0.06)",
									border: "1px solid rgba(239,68,68,0.18)",
									borderRadius: "10px",
									padding: "12px 14px",
									display: "flex",
									flexDirection: "column",
									gap: "6px",
								}}
							>
								<p style={{ margin: 0, fontSize: "13px", color: ov.delDesc, fontWeight: 600 }}>
									Al eliminar <strong style={{ color: "#f87171" }}>{orgConfirmDelete}</strong> se
									borrarán en cascada:
								</p>
								<ul
									style={{
										margin: 0,
										padding: "0 0 0 16px",
										display: "flex",
										flexDirection: "column",
										gap: "4px",
									}}
								>
									<li style={{ fontSize: "12.5px", color: "#fca5a5" }}>
										Todas las actividades de esta materia
									</li>
									<li style={{ fontSize: "12.5px", color: "#fca5a5" }}>
										Todas las subtareas de esas actividades
									</li>
								</ul>
								<p
									style={{
										margin: "4px 0 0",
										fontSize: "11.5px",
										color: "#ef4444",
										fontWeight: 700,
									}}
								>
									Esta acción no se puede deshacer.
								</p>
							</div>
							<div style={{ display: "flex", gap: "8px" }}>
								<button
									onClick={async () => {
										setSubjectDeleteLoading(true);
										try {
											await onRemoveSubject(orgConfirmDelete!);
											setOrgConfirmDelete(null);
											toast.success("Materia eliminada");
										} catch {
											toast.error("No se pudo eliminar la materia.");
										} finally {
											setSubjectDeleteLoading(false);
										}
									}}
									disabled={subjectDeleteLoading}
									className="modal-btn-danger"
									data-testid="org-subject-delete-confirm-btn"
									style={{
										flex: 1,
										padding: "11px 14px",
										borderRadius: "8px",
										border: "none",
										cursor: subjectDeleteLoading ? "wait" : "pointer",
										fontSize: "13px",
										fontWeight: 700,
										background: "#ef4444",
										color: "#fff",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										gap: "7px",
										opacity: subjectDeleteLoading ? 0.7 : 1,
										fontFamily: "inherit",
									}}
								>
									{subjectDeleteLoading ? (
										<Loader2 size={13} className="spinner" />
									) : (
										<Trash2 size={13} />
									)}
									{subjectDeleteLoading ? "Eliminando..." : "Sí, eliminar todo"}
								</button>
								<button
									onClick={() => !subjectDeleteLoading && setOrgConfirmDelete(null)}
									disabled={subjectDeleteLoading}
									className="modal-btn-cancel"
									data-testid="org-subject-delete-cancel-btn"
									style={{
										padding: "11px 18px",
										borderRadius: "8px",
										border: `1px solid ${ov.delCancelBdr}`,
										cursor: subjectDeleteLoading ? "not-allowed" : "pointer",
										fontSize: "13px",
										fontWeight: 600,
										background: "transparent",
										color: ov.delCancelClr,
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
						data-testid="org-edit-activity-layer"
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
							dateLoadMap={dateLoadMap}
							conflictDates={conflictDates}
							maxDailyHours={maxDailyHours}
							onClose={() => setOrgEditActivity(null)}
							onSave={async (id, payload) => {
								const updated = await updateActivity(id, payload);
								onActivityUpdate(updated);
								onActivitySaved?.(updated, orgEditActivity);
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
