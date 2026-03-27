import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/hooks/useTheme";
import {
	CalendarCheck,
	CalendarClock,
	AlertTriangle,
	Plus,
	ChevronDown,
	Sparkles,
	Clock,
	Loader2,
	CheckCircle2,
	ArrowUp,
	Zap,
	ArrowRight,
} from "lucide-react";
import {
	fetchTodayView,
	updateSubtask,
	deleteSubtask,
	type Activity,
	type Subtask,
} from "@/api/dashboard";
import { toast } from "sonner";
import { getAccessToken } from "@/api/auth";
import "@/pages/Dashboard/Dashboard.css";
import {
	checkDailyConflicts,
	daysUntil,
	type KanbanGroup,
	type KanbanState,
	EMPTY_KANBAN,
} from "@/pages/Dashboard/utils/dashboardUtils";
import { type ConflictInfo } from "@/components/modals/Activities/ConflictModal";
import { SubtaskDetailPanel } from "@/components/shared/SubtaskDetailPanel";
import { CreateSubtaskModal } from "@/components/modals/Subtasks/SubtaskModals";

/** Sorting rule ("Regla de Oro"):
 *  - Overdue  → chronological, oldest first (target_date ASC)
 *  - Today    → tie-break by shortest duration first (estimated_hours ASC)
 *  - Upcoming → chronological, nearest first (target_date ASC)
 */
function sortSubtasks(group: KanbanGroup, items: Subtask[]): Subtask[] {
	const copy = [...items];
	if (group === "overdue" || group === "upcoming") {
		copy.sort((a, b) => {
			const da = a.target_date ? new Date(a.target_date).getTime() : Infinity;
			const db = b.target_date ? new Date(b.target_date).getTime() : Infinity;
			return da - db;
		});
	} else {
		// today: shortest estimated_hours first
		copy.sort((a, b) => {
			const ha = Number(a.estimated_hours) || 0;
			const hb = Number(b.estimated_hours) || 0;
			return ha - hb;
		});
	}
	return copy;
}

function getKanbanGroupForDate(targetDate: string): KanbanGroup {
	const difference = daysUntil(targetDate);
	if (difference < 0) return "overdue";
	if (difference === 0) return "today";
	return "upcoming";
}

function upsertSubtaskAcrossKanban(
	state: KanbanState,
	subtaskId: number,
	nextSubtask: Subtask,
	fallbackGroup: KanbanGroup,
): { nextState: KanbanState; nextGroup: KanbanGroup } {
	const targetGroup = nextSubtask.target_date
		? getKanbanGroupForDate(nextSubtask.target_date)
		: fallbackGroup;

	const nextState: KanbanState = {
		overdue: state.overdue.filter((item) => item.id !== subtaskId),
		today: state.today.filter((item) => item.id !== subtaskId),
		upcoming: state.upcoming.filter((item) => item.id !== subtaskId),
	};

	nextState[targetGroup] = [...nextState[targetGroup], nextSubtask];

	return { nextState, nextGroup: targetGroup };
}

export default function TodayKanban({
	initialData,
	onDataRefresh,
	activities,
	maxDailyHours = 0,
	conflictDates = [],
	onConflict,
	onSubtaskMutated,
	searchQuery = "",
}: {
	initialData: KanbanState | null;
	onDataRefresh: (data: KanbanState) => void;
	activities: Activity[];
	maxDailyHours?: number;
	conflictDates?: string[];
	onConflict?: (info: ConflictInfo) => void;
	onSubtaskMutated?: () => void;
	searchQuery?: string;
}) {
	const { isDark } = useTheme();
	// Theme-aware color palette (avoids CSS overriding inline styles)
	const tv = {
		pillBg: isDark ? "#0d1525" : "rgba(255,255,255,0.72)",
		pillBorder: isDark ? "#1e293b" : "rgba(124,92,255,0.2)",
		pillText: isDark ? "#94a3b8" : "#4a4568",
		pillStrong: isDark ? "#f1f5f9" : "#1e1a33",
		pillIdle: isDark ? "#475569" : "#7a62c9",
		chipBg: isDark ? "rgba(15,27,45,0.6)" : "rgba(124,92,255,0.06)",
		chipBorder: isDark ? "#1e293b" : "rgba(124,92,255,0.18)",
		chipColor: isDark ? "#64748b" : "#7a62c9",
		chipChkBdr: isDark ? "#334155" : "rgba(124,92,255,0.3)",
		tabBg: isDark ? "#0d1525" : "rgba(255,255,255,0.65)",
		tabShadow: isDark ? "inset 0 0 0 1px #1e293b" : "inset 0 0 0 1px rgba(124,92,255,0.18)",
		tabHoverBg: isDark ? "#111827" : "rgba(124,92,255,0.1)",
		tabHoverSh: isDark ? "inset 0 0 0 1px #334155" : "inset 0 0 0 1px rgba(124,92,255,0.28)",
		tabTagClr: isDark ? "#7d8fa3" : "#7a8aaa",
		tabCntBg: isDark ? "#1e293b" : "rgba(124,92,255,0.1)",
		tabCntClr: isDark ? "#475569" : "#6258a0",
		tabSubClr: isDark ? "#334155" : "#9b8eba",
		emptyBg: isDark ? "#0d1525" : "rgba(124,92,255,0.07)",
		emptyBdr: isDark ? "#1e293b" : "rgba(124,92,255,0.2)",
		emptyIcon: isDark ? "#1e3a5f" : "#c4b5fd",
		emptyTxt: isDark ? "#334155" : "#7a728f",
		cardBg: isDark ? "#0f1b2d" : "rgba(255,255,255,0.82)",
		cardBgDone: isDark ? "rgba(13,21,37,0.6)" : "rgba(124,92,255,0.04)",
		cardBgProg: isDark ? "rgba(96,165,250,0.04)" : "rgba(59,130,246,0.05)",
		cardBdrDone: isDark ? "#1a2336" : "rgba(124,92,255,0.1)",
		cardBdrProg: isDark ? "#1e3a5f" : "rgba(96,165,250,0.22)",
		cardBdr: isDark ? "#1e3050" : "rgba(124,92,255,0.18)",
		cardLBdrDone: isDark ? "#1e3050" : "rgba(124,92,255,0.15)",
		cardHoverBg: isDark ? "#132040" : "rgba(255,255,255,0.97)",
		cardHoverBgDone: isDark ? "rgba(13,21,37,0.85)" : "rgba(124,92,255,0.07)",
		cardHoverBdr: isDark ? "#2a4060" : "rgba(124,92,255,0.28)",
		cardHoverBdrDone: isDark ? "#243050" : "rgba(124,92,255,0.15)",
		titDone: isDark ? "#3d566e" : "#94a3b8",
		titProg: isDark ? "#93c5fd" : "#3b82f6",
		titNml: isDark ? "#e2e8f0" : "#1e1a33",
		actDone: isDark ? "#2a3d52" : "#b0bcc9",
		actNml: isDark ? "#5e798f" : "#5878a0",
		hrsDone: isDark ? "#2a3d52" : "#b0bcc9",
		hrsNml: isDark ? "#d4a017" : "#c48e00",
		statusDoneTxt: isDark ? "#2a4a3a" : "#3d9977",
		dropBg: isDark ? "#1e293b" : "rgba(255,255,255,0.97)",
		dropBdr: isDark ? "#334155" : "rgba(124,92,255,0.22)",
		dropSh: isDark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)",
		dropTxt: isDark ? "#94a3b8" : "#7a728f",
	} as const;

	const [kanban, setKanban] = useState<KanbanState>(initialData ?? EMPTY_KANBAN);
	const [kanbanLoading, setKanbanLoading] = useState(!initialData);
	const [selectedSubtask, setSelectedSubtask] = useState<{
		subtask: Subtask;
		group: KanbanGroup;
	} | null>(null);
	const [togglingId, setTogglingId] = useState<number | null>(null);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed">(
		"all",
	);
	const [courseFilter, setCourseFilter] = useState<string>("all");
	const [toolbarSelect, setToolbarSelect] = useState<{
		type: "status" | "course";
		top: number;
		left: number;
		width: number;
	} | null>(null);
	const [openSelect, setOpenSelect] = useState<{ id: number; top: number; left: number } | null>(
		null,
	);
	const [activeTab, setActiveTab] = useState<KanbanGroup>(() => {
		const d = initialData ?? EMPTY_KANBAN;
		if (d.overdue.length > 0) return "overdue";
		if (d.today.length > 0) return "today";
		return "upcoming";
	});

	useEffect(() => {
		if (initialData) {
			setKanban(initialData);
			setKanbanLoading(false);
			return;
		}
		let cancelled = false;
		const token = typeof window !== "undefined" ? getAccessToken() : null;
		if (!token) {
			setKanbanLoading(false);
			return;
		}
		setKanbanLoading(true);
		fetchTodayView()
			.then((data) => {
				if (!cancelled) {
					const k: KanbanState = {
						overdue: data.overdue,
						today: data.today,
						upcoming: data.upcoming,
					};
					setKanban(k);
					onDataRefresh(k);
				}
			})
			.catch((err) => {
				console.warn("Today view fallback:", err);
			})
			.finally(() => {
				if (!cancelled) setKanbanLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

	// Keep the side panel in sync even when a task moves to another kanban bucket.
	useEffect(() => {
		if (!selectedSubtask) return;

		const { subtask, group } = selectedSubtask;
		let liveGroup: KanbanGroup = group;
		let liveSubtask = kanban[group].find((item) => item.id === subtask.id);

		if (!liveSubtask) {
			for (const candidate of ["overdue", "today", "upcoming"] as const) {
				const match = kanban[candidate].find((item) => item.id === subtask.id);
				if (match) {
					liveGroup = candidate;
					liveSubtask = match;
					break;
				}
			}
		}

		if (!liveSubtask) {
			setSelectedSubtask(null);
			return;
		}

		if (liveGroup !== group || liveSubtask !== subtask) {
			setSelectedSubtask({ subtask: liveSubtask, group: liveGroup });
		}
	}, [kanban]); // eslint-disable-line react-hooks/exhaustive-deps

	function resolveActivityId(subtask: Subtask): number | undefined {
		if (subtask.activity?.id) return subtask.activity.id;
		// Fallback: scan the activities list for the one that owns this subtask
		return activities.find((a) => a.subtasks?.some((s) => s.id === subtask.id))?.id;
	}

	async function handleToggle(
		subtask: Subtask,
		group: KanbanGroup,
		targetStatus?: Subtask["status"],
	) {
		const activityId = resolveActivityId(subtask);
		if (!activityId) {
			toast.error("No se puede actualizar: actividad no encontrada.");
			return;
		}
		const nextStatus = targetStatus ?? "pending";
		const nextLabels: Record<string, string> = {
			in_progress: "En progreso",
			completed: "Completada",
			pending: "Pendiente",
		};
		setTogglingId(subtask.id);
		try {
			await updateSubtask(activityId, subtask.id, { status: nextStatus });
			setKanban((prev) => {
				const nextKanban = {
					...prev,
					[group]: prev[group].map((s) => (s.id === subtask.id ? { ...s, status: nextStatus } : s)),
				};
				onDataRefresh(nextKanban);
				return nextKanban;
			});
			setSelectedSubtask((prev) =>
				prev?.subtask.id === subtask.id
					? { group, subtask: { ...prev.subtask, status: nextStatus } }
					: prev,
			);
			onSubtaskMutated?.();
			toast.success(nextLabels[nextStatus] ?? nextStatus);
		} catch {
			toast.error("No se pudo actualizar la tarea.");
		} finally {
			setTogglingId(null);
		}
	}

	async function handleEdit(
		subtask: Subtask,
		group: KanbanGroup,
		fields: Partial<Pick<Subtask, "name" | "estimated_hours" | "target_date" | "status">>,
	) {
		const activityId = resolveActivityId(subtask);
		if (!activityId) {
			toast.error("Actividad no encontrada.");
			throw new Error("no activityId");
		}
		const updated = await updateSubtask(activityId, subtask.id, fields);
		const merged: Subtask = { ...subtask, ...updated };

		let nextKanbanSnapshot: KanbanState | null = null;
		let nextGroup: KanbanGroup = group;

		setKanban((prev) => {
			const { nextState, nextGroup: resolvedGroup } = upsertSubtaskAcrossKanban(
				prev,
				subtask.id,
				merged,
				group,
			);
			nextKanbanSnapshot = nextState;
			nextGroup = resolvedGroup;
			onDataRefresh(nextState);
			return nextState;
		});

		setSelectedSubtask((prev) =>
			prev?.subtask.id === subtask.id ? { group: nextGroup, subtask: merged } : prev,
		);

		const conflictSource = nextKanbanSnapshot ?? kanban;
		if (
			onConflict &&
			maxDailyHours > 0 &&
			(fields.estimated_hours !== undefined || fields.target_date !== undefined)
		) {
			const conflict = checkDailyConflicts(
				[...conflictSource.overdue, ...conflictSource.today, ...conflictSource.upcoming],
				maxDailyHours,
			);
			if (conflict) {
				onConflict({
					activityTitle:
						merged.activity?.title ?? subtask.activity?.title ?? "Tu planificación del día",
					date: conflict.date,
					totalHours: conflict.totalHours,
					maxHours: maxDailyHours,
				});
			}
		}
		onSubtaskMutated?.();
		toast.success("Tarea actualizada");
	}

	async function handleDelete(subtask: Subtask, group: KanbanGroup) {
		const activityId = resolveActivityId(subtask);
		if (!activityId) {
			toast.error("Actividad no encontrada.");
			return;
		}
		await deleteSubtask(activityId, subtask.id);
		setKanban((prev) => {
			const nextKanban = {
				...prev,
				[group]: prev[group].filter((s) => s.id !== subtask.id),
			};
			onDataRefresh(nextKanban);
			return nextKanban;
		});
		setSelectedSubtask(null);
		onSubtaskMutated?.();
		toast.success("Tarea eliminada");
	}

	const allItems = useMemo(
		() => [...kanban.overdue, ...kanban.today, ...kanban.upcoming],
		[kanban.overdue, kanban.today, kanban.upcoming],
	);
	const availableCourseNames = useMemo(() => {
		const names = new Set<string>();
		for (const subtask of allItems) {
			const resolvedName =
				subtask.course_name ??
				activities.find((a) => a.id === subtask.activity?.id)?.course_name ??
				"Sin materia";
			names.add(resolvedName);
		}
		return Array.from(names).sort((a, b) => a.localeCompare(b));
	}, [allItems, activities]);

	const calendarDateLoadMap = useMemo(() => {
		const next: Record<string, number> = {};
		for (const activity of activities) {
			for (const subtask of activity.subtasks ?? []) {
				if (subtask.status === "completed") continue;
				if (!subtask.target_date) continue;
				next[subtask.target_date] =
					(next[subtask.target_date] ?? 0) + (Number(subtask.estimated_hours) || 0);
			}
		}
		return next;
	}, [activities]);

	if (kanbanLoading) {
		return (
			<div
				className="fade-in"
				data-testid="today-loading-state"
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					padding: "4rem",
					color: "#64748b",
					gap: "10px",
				}}
			>
				<Loader2 size={20} className="spinner" />
				<span style={{ fontSize: "14px" }}>Cargando tareas...</span>
			</div>
		);
	}

	const pendingCount = allItems.filter((s) => s.status !== "completed").length;
	const hasOverdueOpen = kanban.overdue.some((s) => s.status !== "completed");
	const statusFilterLabel: Record<"all" | "pending" | "in_progress" | "completed", string> = {
		all: "Todos",
		pending: "Pendiente",
		in_progress: "En progreso",
		completed: "Completada",
	};

	const columns: {
		group: KanbanGroup;
		label: string;
		items: Subtask[];
		accent: string;
		icon: React.JSX.Element;
		sortHint: { icon: React.JSX.Element; text: string };
	}[] = [
		{
			group: "overdue" as KanbanGroup,
			label: "Vencidas",
			items: sortSubtasks("overdue", kanban.overdue),
			accent: "#f87171",
			icon: <AlertTriangle size={13} />,
			sortHint: { icon: <ArrowUp size={12} />, text: "más antiguas primero" },
		},
		{
			group: "today" as KanbanGroup,
			label: "Para hoy",
			items: sortSubtasks("today", kanban.today),
			accent: "#c084fc",
			icon: <CalendarCheck size={13} />,
			sortHint: { icon: <Zap size={12} />, text: "más rápidas primero" },
		},
		{
			group: "upcoming" as KanbanGroup,
			label: "Próximas",
			items: sortSubtasks("upcoming", kanban.upcoming),
			accent: "#60a5fa",
			icon: <CalendarClock size={13} />,
			sortHint: { icon: <ArrowRight size={12} />, text: "más cercanas primero" },
		},
	];

	return (
		<>
			{/* ─────────────────── Toolbar ─────────────────── */}
			<div
				className="fade-in"
				data-testid="today-toolbar"
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "16px",
					animationDelay: "0.1s",
				}}
			>
				{/* Summary pill */}
				<div
					data-testid="today-summary-pill"
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						gap: "8px",
						background: tv.pillBg,
						border: `1px solid ${tv.pillBorder}`,
						borderRadius: "10px",
						padding: "9px 14px",
						fontSize: "13px",
						color: tv.pillText,
						minWidth: 0,
					}}
				>
					<Sparkles size={13} color="#c084fc" style={{ flexShrink: 0 }} />
					<span
						style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
					>
						{allItems.length > 0 ? (
							<>
								Tienes <strong style={{ color: tv.pillStrong }}>{pendingCount}</strong> tarea
								{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""}.
								{hasOverdueOpen && (
									<span style={{ marginLeft: "10px", color: "#f87171", fontWeight: 600 }}>
										⚠ Vencidas sin completar
									</span>
								)}
							</>
						) : (
							<span style={{ color: tv.pillIdle }}>Sin tareas urgentes — ¡todo bajo control!</span>
						)}
					</span>
				</div>

				{/* Nueva subtarea CTA */}
				<button
					onClick={() => setCreateModalOpen(true)}
					data-testid="today-new-subtask-btn"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "6px",
						padding: "8px 14px",
						borderRadius: "8px",
						border: "1px solid rgba(124,58,237,0.5)",
						background: "linear-gradient(135deg,rgba(124,58,237,0.9),rgba(109,40,217,0.9))",
						color: "#f3e8ff",
						fontSize: "12px",
						fontWeight: 600,
						letterSpacing: "0.01em",
						cursor: "pointer",
						flexShrink: 0,
						boxShadow: "0 2px 10px rgba(124,58,237,0.25)",
						transition: "all 0.15s",
						whiteSpace: "nowrap",
						fontFamily: "inherit",
					}}
					onMouseOver={(e) => {
						e.currentTarget.style.opacity = "0.88";
						e.currentTarget.style.transform = "translateY(-1px)";
					}}
					onMouseOut={(e) => {
						e.currentTarget.style.opacity = "1";
						e.currentTarget.style.transform = "translateY(0)";
					}}
				>
					<Plus size={13} /> Nueva tarea
				</button>

				<div
					style={{
						display: "flex",
						gap: "8px",
						alignItems: "center",
						flexShrink: 0,
						flexWrap: "wrap",
						justifyContent: "flex-end",
					}}
				>
					<button
						type="button"
						onClick={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							setToolbarSelect((prev) =>
								prev?.type === "status"
									? null
									: { type: "status", top: rect.bottom + 6, left: rect.left, width: rect.width },
							);
						}}
						data-testid="today-status-filter-btn"
						style={{
							height: "34px",
							borderRadius: "8px",
							padding: "0 12px",
							border: `1px solid ${tv.dropBdr}`,
							background: tv.dropBg,
							color: tv.dropTxt,
							fontSize: "12px",
							fontFamily: "inherit",
							minWidth: "160px",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "8px",
							cursor: "pointer",
						}}
					>
						<span>Estado: {statusFilterLabel[statusFilter]}</span>
						<ChevronDown size={12} />
					</button>

					<button
						type="button"
						onClick={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							setToolbarSelect((prev) =>
								prev?.type === "course"
									? null
									: { type: "course", top: rect.bottom + 6, left: rect.left, width: rect.width },
							);
						}}
						data-testid="today-course-filter-btn"
						style={{
							height: "34px",
							borderRadius: "8px",
							padding: "0 12px",
							border: `1px solid ${tv.dropBdr}`,
							background: tv.dropBg,
							color: tv.dropTxt,
							fontSize: "12px",
							fontFamily: "inherit",
							minWidth: "170px",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "8px",
							cursor: "pointer",
						}}
					>
						<span>Curso: {courseFilter === "all" ? "Todos" : courseFilter}</span>
						<ChevronDown size={12} />
					</button>

					<button
						type="button"
						onClick={() => {
							setStatusFilter("all");
							setCourseFilter("all");
							setToolbarSelect(null);
						}}
						data-testid="today-clear-filters-btn"
						style={{
							height: "34px",
							borderRadius: "8px",
							padding: "0 12px",
							border: `1px solid ${tv.dropBdr}`,
							background: "transparent",
							color: tv.dropTxt,
							fontSize: "12px",
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						Limpiar
					</button>

					{toolbarSelect &&
						createPortal(
							<>
								<div
									data-testid="today-toolbar-select-overlay"
									style={{ position: "fixed", inset: 0, zIndex: 9998 }}
									onClick={() => setToolbarSelect(null)}
								/>
								<div
									data-testid="today-toolbar-select-dropdown"
									style={{
										position: "fixed",
										top: toolbarSelect.top,
										left: toolbarSelect.left,
										minWidth: toolbarSelect.width,
										maxWidth: "280px",
										zIndex: 9999,
										background: tv.dropBg,
										border: `1px solid ${tv.dropBdr}`,
										borderRadius: "10px",
										overflow: "hidden",
										boxShadow: tv.dropSh,
										animation: "dropdownOpen 0.15s cubic-bezier(0.16,1,0.3,1)",
									}}
								>
									{toolbarSelect.type === "status"
										? (
												[
													["all", "Todos"],
													["pending", "Pendiente"],
													["in_progress", "En progreso"],
													["completed", "Completada"],
												] as const
											).map(([value, label]) => (
												<button
													key={value}
													onClick={() => {
														setStatusFilter(value);
														setToolbarSelect(null);
													}}
													data-testid={`today-status-filter-option-${value}`}
													style={{
														width: "100%",
														padding: "9px 12px",
														border: "none",
														textAlign: "left",
														fontSize: "12px",
														fontFamily: "inherit",
														cursor: "pointer",
														background:
															statusFilter === value ? "rgba(124,92,255,0.18)" : "transparent",
														color:
															statusFilter === value
																? isDark
																	? "#e9d5ff"
																	: "#5b21b6"
																: tv.dropTxt,
													}}
												>
													Estado: {label}
												</button>
											))
										: [
												{ value: "all", label: "Todos" },
												...availableCourseNames.map((name) => ({ value: name, label: name })),
											].map((item) => (
												<button
													key={item.value}
													onClick={() => {
														setCourseFilter(item.value);
														setToolbarSelect(null);
													}}
													data-testid={`today-course-filter-option-${item.value === "all" ? "all" : item.value.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}`}
													style={{
														width: "100%",
														padding: "9px 12px",
														border: "none",
														textAlign: "left",
														fontSize: "12px",
														fontFamily: "inherit",
														cursor: "pointer",
														background:
															courseFilter === item.value ? "rgba(124,92,255,0.18)" : "transparent",
														color:
															courseFilter === item.value
																? isDark
																	? "#e9d5ff"
																	: "#5b21b6"
																: tv.dropTxt,
														maxWidth: "280px",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
													title={item.value === "all" ? "Todos" : item.value}
												>
													Curso: {item.label}
												</button>
											))}
								</div>
							</>,
							document.body,
						)}
				</div>
			</div>

			{/* ─────────────────── Tab strip ─────────────────── */}
			<div
				className="fade-in"
				data-testid="today-tabs"
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr 1fr",
					gap: "7px",
					marginBottom: "14px",
					animationDelay: "0.18s",
				}}
			>
				{columns.map(({ group, label, items, accent, icon }) => {
					const active = activeTab === group;
					const openCount = items.filter((s) => s.status !== "completed").length;
					return (
						<button
							key={group}
							onClick={() => setActiveTab(group)}
							data-testid={`today-tab-${group}`}
							style={{
								position: "relative",
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								gap: "6px",
								padding: "11px 14px 10px",
								borderRadius: "11px",
								border: "none",
								cursor: "pointer",
								textAlign: "left",
								overflow: "hidden",
								background: active ? `${accent}14` : tv.tabBg,
								boxShadow: active ? `inset 0 0 0 1.5px ${accent}50` : tv.tabShadow,
								transition: "all 0.18s",
							}}
							onMouseOver={(e) => {
								if (!active) {
									e.currentTarget.style.background = tv.tabHoverBg;
									e.currentTarget.style.boxShadow = tv.tabHoverSh;
								}
							}}
							onMouseOut={(e) => {
								if (!active) {
									e.currentTarget.style.background = tv.tabBg;
									e.currentTarget.style.boxShadow = tv.tabShadow;
								}
							}}
						>
							{/* Top accent bar */}
							{active && (
								<span
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										right: 0,
										height: "2px",
										background: `linear-gradient(90deg, ${accent}, ${accent}80)`,
										borderRadius: "11px 11px 0 0",
									}}
								/>
							)}
							{/* Label row */}
							<div
								style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
							>
								<span
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										fontSize: "12px",
										fontWeight: 700,
										color: active ? accent : tv.tabTagClr,
									}}
								>
									<span style={{ display: "flex" }}>{icon}</span>
									{label}
								</span>
								<span
									style={{
										fontSize: "11px",
										fontWeight: 800,
										padding: "1px 8px",
										borderRadius: "20px",
										background: active ? `${accent}25` : tv.tabCntBg,
										color: active ? accent : tv.tabCntClr,
										transition: "all 0.18s",
									}}
								>
									{items.length}
								</span>
							</div>
							{/* Sub-caption */}
							<span
								style={{
									fontSize: "10px",
									color: active ? `${accent}99` : tv.tabSubClr,
									fontWeight: 500,
									lineHeight: 1,
								}}
							>
								{openCount > 0 ? `${openCount} sin completar` : "todo completado"}
							</span>
						</button>
					);
				})}
			</div>
			{/* ─────────────────── Sort context bar ─────────────────── */}
			{(() => {
				const active = columns.find((c) => c.group === activeTab)!;
				return (
					<div
						data-testid="today-sort-hint"
						style={{
							display: "flex",
							alignItems: "center",
							gap: "7px",
							marginBottom: "10px",
							padding: "7px 12px",
							borderRadius: "8px",
							background: `${active.accent}0f`,
							border: `1px solid ${active.accent}28`,
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: `${active.accent}80`,
								flexShrink: 0,
								letterSpacing: "0.03em",
								textTransform: "uppercase",
								fontWeight: 600,
							}}
						>
							Orden
						</span>
						<span
							style={{
								width: "1px",
								height: "12px",
								background: `${active.accent}30`,
								flexShrink: 0,
							}}
						/>
						<span
							style={{
								display: "flex",
								alignItems: "center",
								gap: "5px",
								fontSize: "12px",
								fontWeight: 600,
								color: active.accent,
							}}
						>
							{active.sortHint.icon}
							{active.sortHint.text}
						</span>
					</div>
				);
			})()}

			{/* ─────────────────── Card list ─────────────────── */}
			{columns
				.filter((c) => c.group === activeTab)
				.map(({ group, items, accent }) => (
					<div
						key={group}
						className="fade-in"
						data-testid={`today-column-${group}`}
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "6px",
							animationDelay: "0.05s",
						}}
					>
						{items.length === 0 ? (
							<div
								data-testid={`today-empty-state-${group}`}
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									padding: "4rem 0",
									gap: "12px",
								}}
							>
								<div
									style={{
										width: 48,
										height: 48,
										borderRadius: "50%",
										background: tv.emptyBg,
										border: `1px solid ${tv.emptyBdr}`,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<CheckCircle2 size={22} color={tv.emptyIcon} />
								</div>
								<p style={{ fontSize: "13px", margin: 0, color: tv.emptyTxt, fontWeight: 500 }}>
									Nada por aquí — ¡todo libre! 🎉
								</p>
							</div>
						) : (
							items
								.filter((s) => statusFilter === "all" || s.status === statusFilter)
								.filter(
									(s) =>
										courseFilter === "all" ||
										(s.course_name ??
											activities.find((a) => a.id === s.activity?.id)?.course_name ??
											"Sin materia") === courseFilter,
								)
								.filter(
									(s) =>
										!searchQuery.trim() ||
										s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
								)
								.map((subtask) => {
									const isCompleted = subtask.status === "completed";
									const isToggling = togglingId === subtask.id;
									const isSelected = selectedSubtask?.subtask.id === subtask.id;
									const sColor: Record<string, string> = {
										pending: "#fbbf24",
										in_progress: "#60a5fa",
										completed: "#34d399",
									};
									const sLabel: Record<string, string> = {
										pending: "Pendiente",
										in_progress: "En progreso",
										completed: "Completada",
									};
									const diff = daysUntil(subtask.target_date);
									let dayText = "",
										dayColor = "#7dd3fc",
										dayBg = "rgba(125,211,252,0.1)";
									if (!isCompleted) {
										if (diff < 0) {
											dayText = `hace ${Math.abs(diff)}d`;
											dayColor = "#f87171";
											dayBg = "rgba(248,113,113,0.12)";
										} else if (diff === 0) {
											dayText = "Hoy";
											dayColor = "#fbbf24";
											dayBg = "rgba(251,191,36,0.14)";
										} else if (diff === 1) {
											dayText = "Mañana";
											dayColor = "#fb923c";
											dayBg = "rgba(251,146,60,0.13)";
										} else {
											dayText = `${diff}d`; /* blue defaults above */
										}
									}
									const borderColor = isSelected
										? "#c084fc"
										: isCompleted
											? tv.cardLBdrDone
											: (sColor[subtask.status] ?? accent);
									return (
										<div
											key={subtask.id}
											role="button"
											tabIndex={0}
											aria-pressed={isSelected}
											data-testid={`today-subtask-card-${subtask.id}`}
											onClick={() =>
												setSelectedSubtask(
													isSelected
														? null
														: {
																subtask: kanban[group].find((s) => s.id === subtask.id) ?? subtask,
																group,
															},
												)
											}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ")
													setSelectedSubtask(isSelected ? null : { subtask, group });
											}}
											style={{
												display: "flex",
												alignItems: "center",
												gap: "14px",
												background: isSelected
													? "rgba(192,132,252,0.08)"
													: isCompleted
														? tv.cardBgDone
														: subtask.status === "in_progress"
															? tv.cardBgProg
															: tv.cardBg,
												border: `1px solid ${isSelected ? "rgba(192,132,252,0.4)" : isCompleted ? tv.cardBdrDone : subtask.status === "in_progress" ? tv.cardBdrProg : tv.cardBdr}`,
												borderLeft: `3px solid ${isCompleted ? tv.cardLBdrDone : borderColor}`,
												borderRadius: "10px",
												padding: "13px 16px 13px 14px",
												cursor: "pointer",
												transition: "all 0.15s",
												outline: "none",
												animation: "fadeInCard 0.17s ease both",
											}}
											onMouseOver={(e) => {
												if (!isSelected) {
													e.currentTarget.style.background = isCompleted
														? tv.cardHoverBgDone
														: tv.cardHoverBg;
													e.currentTarget.style.borderColor = isCompleted
														? tv.cardHoverBdrDone
														: tv.cardHoverBdr;
												}
											}}
											onMouseOut={(e) => {
												if (!isSelected) {
													e.currentTarget.style.background = isCompleted
														? tv.cardBgDone
														: tv.cardBg;
													e.currentTarget.style.borderColor = isCompleted
														? tv.cardBdrDone
														: tv.cardBdr;
												}
											}}
										>
											{/* Status select – custom dropdown via portal */}
											{(() => {
												const sc =
													subtask.status === "completed"
														? "#34d399"
														: subtask.status === "in_progress"
															? "#60a5fa"
															: "#64748b";
												const statusLabel =
													subtask.status === "completed"
														? "Completada"
														: subtask.status === "in_progress"
															? "En progreso"
															: "Pendiente";
												const isOpen = openSelect?.id === subtask.id;
												return (
													<div style={{ position: "relative", flexShrink: 0 }}>
														<button
															disabled={isToggling}
															onClick={(e) => {
																e.stopPropagation();
																if (isOpen) {
																	setOpenSelect(null);
																	return;
																}
																const rect = e.currentTarget.getBoundingClientRect();
																setOpenSelect({
																	id: subtask.id,
																	top: rect.bottom + 4,
																	left: rect.left,
																});
															}}
															data-testid={`today-subtask-status-btn-${subtask.id}`}
															style={{
																display: "inline-flex",
																alignItems: "center",
																gap: "4px",
																background: `${sc}14`,
																border: `1px solid ${sc}44`,
																color: sc,
																borderRadius: "20px",
																padding: "3px 8px 3px 9px",
																fontSize: "11px",
																fontWeight: 600,
																letterSpacing: "0.01em",
																cursor: isToggling ? "wait" : "pointer",
																outline: "none",
																opacity: isToggling ? 0.5 : 1,
																transition: "all 0.15s",
																fontFamily: "inherit",
																whiteSpace: "nowrap",
															}}
														>
															{isToggling ? <Loader2 size={10} className="spinner" /> : statusLabel}
															<ChevronDown size={10} strokeWidth={2.5} style={{ opacity: 0.7 }} />
														</button>
														{isOpen &&
															createPortal(
																<>
																	<div
																		data-testid={`today-subtask-status-overlay-${subtask.id}`}
																		style={{ position: "fixed", inset: 0, zIndex: 9998 }}
																		onClick={(e) => {
																			e.stopPropagation();
																			setOpenSelect(null);
																		}}
																	/>
																	<div
																		data-testid={`today-subtask-status-dropdown-${subtask.id}`}
																		style={{
																			position: "fixed",
																			top: openSelect!.top,
																			left: openSelect!.left,
																			zIndex: 9999,
																			background: tv.dropBg,
																			border: `1px solid ${tv.dropBdr}`,
																			borderRadius: "10px",
																			overflow: "hidden",
																			minWidth: "130px",
																			boxShadow: tv.dropSh,
																			animation: "dropdownOpen 0.15s cubic-bezier(0.16,1,0.3,1)",
																			transformOrigin: "top left",
																		}}
																		onClick={(e) => e.stopPropagation()}
																	>
																		{(
																			[
																				["pending", "Pendiente", "#64748b"],
																				["in_progress", "En progreso", "#60a5fa"],
																				["completed", "Completada", "#34d399"],
																			] as const
																		).map(([val, label, color]) => (
																			<button
																				key={val}
																				onClick={() => {
																					setOpenSelect(null);
																					void handleToggle(subtask, group, val);
																				}}
																				data-testid={`today-subtask-status-option-${subtask.id}-${val}`}
																				style={{
																					display: "flex",
																					alignItems: "center",
																					gap: "8px",
																					width: "100%",
																					padding: "8px 12px",
																					background:
																						subtask.status === val ? `${color}20` : "transparent",
																					border: "none",
																					color: subtask.status === val ? color : tv.dropTxt,
																					fontSize: "12px",
																					fontWeight: subtask.status === val ? 600 : 400,
																					cursor: "pointer",
																					fontFamily: "inherit",
																					textAlign: "left",
																				}}
																				onMouseEnter={(e) => {
																					e.currentTarget.style.background = `${color}20`;
																					e.currentTarget.style.color = color;
																				}}
																				onMouseLeave={(e) => {
																					e.currentTarget.style.background =
																						subtask.status === val ? `${color}20` : "transparent";
																					e.currentTarget.style.color =
																						subtask.status === val ? color : tv.dropTxt;
																				}}
																			>
																				<span
																					style={{
																						width: 7,
																						height: 7,
																						borderRadius: "50%",
																						background: color,
																						flexShrink: 0,
																						display: "inline-block",
																					}}
																				/>
																				{label}
																			</button>
																		))}
																	</div>
																</>,
																document.body,
															)}
													</div>
												);
											})()}

											{/* Text content */}
											<div style={{ flex: 1, minWidth: 0 }}>
												<p
													data-testid={`today-subtask-title-${subtask.id}`}
													style={{
														fontSize: "14px",
														fontWeight: 600,
														color: isCompleted
															? tv.titDone
															: subtask.status === "in_progress"
																? tv.titProg
																: tv.titNml,
														textDecoration: isCompleted ? "line-through" : "none",
														margin: "0 0 6px",
														lineHeight: 1.35,
														wordBreak: "break-word",
													}}
												>
													{subtask.name}
												</p>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "7px",
														flexWrap: "wrap",
													}}
												>
													{subtask.course_name && (
														<span
															data-testid={`today-subtask-course-${subtask.id}`}
															style={{
																fontSize: "10px",
																background: "rgba(192,132,252,0.14)",
																color: "#c084fc",
																padding: "2px 8px",
																borderRadius: "20px",
																fontWeight: 700,
																flexShrink: 0,
																maxWidth: "130px",
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
															}}
														>
															{subtask.course_name}
														</span>
													)}
													{subtask.activity && (
														<span
															data-testid={`today-subtask-activity-${subtask.id}`}
															style={{
																fontSize: "11px",
																color: isCompleted ? tv.actDone : tv.actNml,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
																maxWidth: "200px",
															}}
														>
															{subtask.activity.title}
														</span>
													)}
												</div>
											</div>

											{/* Right meta */}
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													alignItems: "flex-end",
													gap: "6px",
													flexShrink: 0,
												}}
											>
												{dayText && (
													<span
														style={{
															fontSize: "11px",
															padding: "2px 9px",
															borderRadius: "20px",
															background: dayBg,
															color: dayColor,
															fontWeight: 700,
															whiteSpace: "nowrap",
														}}
													>
														{dayText}
													</span>
												)}
												<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
													{subtask.estimated_hours > 0 && (
														<span
															data-testid={`today-subtask-hours-${subtask.id}`}
															style={{
																fontSize: "11px",
																color: isCompleted ? tv.hrsDone : tv.hrsNml,
																display: "flex",
																alignItems: "center",
																gap: "3px",
																fontWeight: 600,
															}}
														>
															<Clock size={10} />
															{subtask.estimated_hours}h
														</span>
													)}
													<span
														data-testid={`today-subtask-status-pill-${subtask.id}`}
														style={{
															fontSize: "10px",
															padding: "2px 8px",
															borderRadius: "20px",
															background: isCompleted
																? "rgba(52,211,153,0.06)"
																: `${sColor[subtask.status]}1a`,
															color: isCompleted ? tv.statusDoneTxt : sColor[subtask.status],
															fontWeight: 700,
															display: "flex",
															alignItems: "center",
															gap: "4px",
															whiteSpace: "nowrap",
														}}
													>
														<span
															style={{
																width: 5,
																height: 5,
																borderRadius: "50%",
																background: isCompleted ? tv.statusDoneTxt : sColor[subtask.status],
																flexShrink: 0,
															}}
														/>
														{sLabel[subtask.status]}
													</span>
												</div>
											</div>
										</div>
									);
								})
						)}
					</div>
				))}

			{selectedSubtask && (
				<SubtaskDetailPanel
					subtask={selectedSubtask.subtask}
					group={selectedSubtask.group}
					dateLoadMap={calendarDateLoadMap}
					conflictDates={conflictDates}
					maxDailyHours={maxDailyHours}
					onClose={() => setSelectedSubtask(null)}
					onToggle={() =>
						void handleToggle(
							selectedSubtask.subtask,
							selectedSubtask.group,
							selectedSubtask.subtask.status === "completed" ? "pending" : "completed",
						)
					}
					toggling={togglingId === selectedSubtask.subtask.id}
					onEdit={(fields) => handleEdit(selectedSubtask.subtask, selectedSubtask.group, fields)}
					onDelete={() => handleDelete(selectedSubtask.subtask, selectedSubtask.group)}
				/>
			)}
			{createModalOpen && (
				<CreateSubtaskModal
					activities={activities}
					dateLoadMap={calendarDateLoadMap}
					conflictDates={conflictDates}
					maxDailyHours={maxDailyHours}
					onClose={() => setCreateModalOpen(false)}
					onCreated={(k) => {
						setKanban(k);
						onDataRefresh(k);
						onSubtaskMutated?.();
					}}
				/>
			)}
		</>
	);
}

/* ============ SUBTASK DETAIL PANEL ============ */
