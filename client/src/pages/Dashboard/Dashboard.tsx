import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
	CalendarCheck,
	AlertTriangle,
	Plus,
	SlidersHorizontal,
	Search,
	Sunrise,
	CloudSun,
	MoonStar,
	User2,
	BarChart3,
	Users,
	LogOut,
	MoreVertical,
	Sparkles,
	Hand,
	X,
	Clock,
	Tag,
	Check,
	ArrowUpDown,
	Loader2,
	Trash2,
	Folder,
	BookOpen,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { getAccessToken } from "@/api/auth";
import lumaLogo from "@/assets/luma.png";
import {
	fetchMe,
	updateMe,
	fetchActivities,
	fetchTodayView,
	fetchConflicts,
	createActivity,
	deleteActivity,
	updateSubtask,
	fetchSubjects,
	createSubject,
	updateSubject,
	deleteSubject,
	type User,
	type Activity,
	type Conflict,
	type Subtask,
	type Subject,
} from "@/api/dashboard";
import { toast } from "sonner";
import "@/pages/Dashboard/Dashboard.css";
import CreateActivityModal from "@/components/modals/Activities/CreateActivityModal";
import {
	checkDailyConflicts,
	type KanbanGroup,
	type KanbanState,
	type NewActivityPayloadFromModal,
} from "@/pages/Dashboard/utils/dashboardUtils";
import OrganizationView from "@/components/views/OrganizationView";
import TodayKanban from "@/components/views/TodayView";
import ConflictModal, {
	type ConflictInfo,
	type ConflictModalItem,
	type ConflictModalSubtask,
} from "@/components/modals/Activities/ConflictModal";
import { SubjectFormModal } from "@/components/modals/Organizations/OrgModals";

/* ============ COMPONENT ============ */
interface DashboardProps {
	onLogout: () => void;
}

function getLocalDateKey(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function getKanbanGroupForDate(targetDate: string, todayDateKey: string): KanbanGroup {
	if (targetDate < todayDateKey) return "overdue";
	if (targetDate === todayDateKey) return "today";
	return "upcoming";
}

export default function Dashboard({ onLogout }: DashboardProps) {
	const { isDark } = useTheme();
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const activeNav =
		pathname === "/organizacion" ? "org" : pathname === "/progreso" ? "progress" : "today";
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [showWave, setShowWave] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [activeFilters, setActiveFilters] = useState<string[]>([]);
	const filterRef = useRef<HTMLDivElement>(null);

	const [user, setUser] = useState<User | null>(null);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [loading, setLoading] = useState<boolean>(() => {
		try {
			if (typeof window === "undefined") return false;
			return !!getAccessToken();
		} catch {
			return false;
		}
	});
	const [todayData, setTodayData] = useState<KanbanState | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [prefilledSubject, setPrefilledSubject] = useState("");
	const [pendingExpandSubject, setPendingExpandSubject] = useState<{ subject: string } | null>(
		null,
	);
	const [subjectModal, setSubjectModal] = useState<{
		mode: "add" | "rename";
		current?: string;
	} | null>(null);
	const [customSubjects, setCustomSubjects] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("luma_subjects") ?? "[]") as string[];
		} catch {
			return [];
		}
	});
	const [apiSubjects, setApiSubjects] = useState<Subject[]>([]);
	const [conflicts, setConflicts] = useState<Conflict[]>([]);
	const [conflictsOpen, setConflictsOpen] = useState(false);
	const [conflictCount, setConflictCount] = useState(0);
	const [conflictsLoading, setConflictsLoading] = useState(false);
	const [capacityEditorOpen, setCapacityEditorOpen] = useState(false);
	const [dailyLimitDraft, setDailyLimitDraft] = useState("");
	const [dailyLimitSaving, setDailyLimitSaving] = useState(false);
	const [capacityPopoverPosition, setCapacityPopoverPosition] = useState<{
		top: number;
		left: number;
		side: "right" | "left";
	}>({ top: 0, left: 0, side: "right" });
	const capacityEditorButtonRef = useRef<HTMLButtonElement>(null);
	const capacityPopoverRef = useRef<HTMLDivElement>(null);
	const dailyLimitInputRef = useRef<HTMLInputElement>(null);

	const subjects = useMemo<string[]>(() => {
		const fromActivities = activities.map((a) => a.course_name).filter(Boolean);
		const fromApi = apiSubjects.map((s) => s.name);
		return Array.from(new Set([...fromActivities, ...fromApi, ...customSubjects])).sort();
	}, [activities, customSubjects, apiSubjects]);

	function addCustomSubject(name: string) {
		const trimmed = name.trim();
		if (!trimmed) return;
		// Try to create via API; fall back to localStorage if API unavailable
		createSubject(trimmed)
			.then((created) => {
				setApiSubjects((prev) =>
					prev.some((s) => s.name === created.name) ? prev : [...prev, created],
				);
			})
			.catch(() => {
				// Fallback: localStorage only
				setCustomSubjects((prev) => {
					if (prev.includes(trimmed)) return prev;
					const next = [...prev, trimmed];
					try {
						localStorage.setItem("luma_subjects", JSON.stringify(next));
					} catch {
						/* ignore */
					}
					return next;
				});
			});
	}

	async function removeCustomSubject(name: string): Promise<void> {
		const subject = apiSubjects.find((s) => s.name === name);
		if (subject) {
			await deleteSubject(subject.id);
			// Reload activities (cascade-deleted), subjects and today view
			const [acts, subs, today] = await Promise.all([
				fetchActivities(),
				fetchSubjects(),
				fetchTodayView(),
			]);
			setActivities(Array.isArray(acts) ? acts : []);
			setApiSubjects(Array.isArray(subs) ? subs : []);
			if (today)
				setTodayData({ overdue: today.overdue, today: today.today, upcoming: today.upcoming });
			void refreshConflicts();
		} else {
			// Fallback: localStorage only
			setCustomSubjects((prev) => {
				const next = prev.filter((s) => s !== name);
				try {
					localStorage.setItem("luma_subjects", JSON.stringify(next));
				} catch {
					/* ignore */
				}
				return next;
			});
		}
	}

	async function renameCustomSubject(oldName: string, newName: string): Promise<void> {
		const trimmed = newName.trim();
		if (!trimmed || trimmed === oldName) return;
		const subject = apiSubjects.find((s) => s.name === oldName);
		if (subject) {
			await updateSubject(subject.id, trimmed);
			// Reload activities (course_name bulk-updated), subjects and today view
			const [acts, subs, today] = await Promise.all([
				fetchActivities(),
				fetchSubjects(),
				fetchTodayView(),
			]);
			setActivities(Array.isArray(acts) ? acts : []);
			setApiSubjects(Array.isArray(subs) ? subs : []);
			if (today)
				setTodayData({ overdue: today.overdue, today: today.today, upcoming: today.upcoming });
			void refreshConflicts();
		} else {
			// Fallback: localStorage only
			setCustomSubjects((prev) => {
				const next = prev.includes(oldName)
					? prev.map((s) => (s === oldName ? trimmed : s))
					: [...prev, trimmed];
				try {
					localStorage.setItem("luma_subjects", JSON.stringify(next));
				} catch {
					/* ignore */
				}
				return next;
			});
		}
	}

	const headerInfo = useMemo(() => {
		switch (activeNav) {
			case "org":
				return {
					title: "Organización",
					TitleIcon: Folder,
					tipText: "Organiza tus actividades por materia y controla tu carga de trabajo.",
				};
			case "progress":
				return {
					title: "Mi progreso",
					TitleIcon: BarChart3,
					tipText: "Analiza tu desempeño, el tiempo invertido y tus estadísticas generales.",
				};
			default:
				return {
					title: "Hoy",
					TitleIcon: CalendarCheck,
					tipText:
						"Tus tareas más urgentes, ordenadas para que puedas avanzar rápido. Marca cada una al terminar.",
				};
		}
	}, [activeNav]);

	const refreshConflicts = useCallback(async () => {
		setConflictsLoading(true);
		try {
			const conflicts = await fetchConflicts();
			setConflicts(Array.isArray(conflicts) ? conflicts : []);
			setConflictCount(Array.isArray(conflicts) ? conflicts.length : 0);
			return Array.isArray(conflicts) ? conflicts : [];
		} catch (err) {
			console.warn("No se pudo cargar el conteo de conflictos:", err);
			setConflicts([]);
			return [] as Conflict[];
		} finally {
			setConflictsLoading(false);
		}
	}, []);

	const handleConflictDetected = useCallback(
		(_info: ConflictInfo) => {
			void _info;
			void refreshConflicts();
		},
		[refreshConflicts],
	);

	const conflictModalItems = useMemo<ConflictModalItem[]>(() => {
		const subtaskPool = activities.flatMap((activity) =>
			(activity.subtasks ?? [])
				.filter((subtask) => subtask.status !== "completed")
				.map((subtask) => ({
					id: subtask.id,
					activityId: activity.id,
					name: subtask.name,
					activityTitle: activity.title,
					estimatedHours: Number(subtask.estimated_hours) || 0,
					targetDate: subtask.target_date,
					courseName: activity.course_name,
				})),
		);

		return conflicts.map((conflict) => {
			const subtasks = subtaskPool
				.filter((subtask) => subtask.targetDate === conflict.affected_date)
				.sort((left, right) => right.estimatedHours - left.estimatedHours)
				.map((subtask) => ({ ...subtask }));

			const title = "Subtareas en conflicto";
			const subtitle =
				subtasks.length > 1
					? `${subtasks.length} subtareas afectadas en esta fecha`
					: (subtasks[0]?.name ?? "Sobrecarga reportada por el backend");

			return {
				id: conflict.id,
				date: conflict.affected_date,
				plannedHours: conflict.planned_hours,
				maxHours: conflict.max_allowed_hours,
				title,
				subtitle,
				subtasks,
			};
		});
	}, [activities, conflicts]);

	const dateLoadMap = useMemo<Record<string, number>>(() => {
		const next: Record<string, number> = {};
		for (const activity of activities) {
			for (const subtask of activity.subtasks ?? []) {
				if (subtask.status === "completed") continue;
				const key = subtask.target_date;
				if (!key) continue;
				next[key] = (next[key] ?? 0) + (Number(subtask.estimated_hours) || 0);
			}
		}
		return next;
	}, [activities]);

	const resolveActivityIdForConflictSubtask = useCallback(
		(subtask: ConflictModalSubtask) => {
			if (subtask.activityId) return subtask.activityId;
			return activities.find((activity) =>
				activity.subtasks?.some((item) => item.id === subtask.id),
			)?.id;
		},
		[activities],
	);

	const refreshPlannerAfterConflictUpdate = useCallback(async () => {
		const [acts, today] = await Promise.all([fetchActivities(), fetchTodayView()]);
		setActivities(Array.isArray(acts) ? acts : []);
		setTodayData({ overdue: today.overdue, today: today.today, upcoming: today.upcoming });
	}, []);

	const refreshTodayFromOrganizationMutation = useCallback(async () => {
		try {
			const todayView = await fetchTodayView();
			setTodayData({
				overdue: todayView.overdue,
				today: todayView.today,
				upcoming: todayView.upcoming,
			});
		} catch (err) {
			console.warn("No se pudo refrescar la vista de hoy tras mutar subtareas:", err);
		} finally {
			void refreshConflicts();
		}
	}, [refreshConflicts]);

	const applySubtaskPatchLocally = useCallback(
		(subtaskId: number, patch: Partial<Pick<Subtask, "estimated_hours" | "target_date">>) => {
			setActivities((prev) =>
				prev.map((activity) => {
					if (!activity.subtasks?.some((subtask) => subtask.id === subtaskId)) return activity;

					const nextSubtasks = activity.subtasks.map((subtask) =>
						subtask.id === subtaskId ? { ...subtask, ...patch } : subtask,
					);

					const nextTotalEstimatedHours = nextSubtasks.reduce(
						(sum, subtask) => sum + (Number(subtask.estimated_hours) || 0),
						0,
					);

					return {
						...activity,
						subtasks: nextSubtasks,
						total_estimated_hours: nextTotalEstimatedHours,
					};
				}),
			);
		},
		[],
	);

	const applyTodayDataPatchLocally = useCallback(
		(subtaskId: number, patch: Partial<Pick<Subtask, "estimated_hours" | "target_date">>) => {
			setTodayData((prev) => {
				if (!prev) return prev;

				let currentGroup: KanbanGroup | null = null;
				let baseSubtask: Subtask | null = null;

				for (const group of ["overdue", "today", "upcoming"] as const) {
					const found = prev[group].find((subtask) => subtask.id === subtaskId);
					if (found) {
						currentGroup = group;
						baseSubtask = found;
						break;
					}
				}

				if (!baseSubtask) {
					for (const activity of activities) {
						const found = activity.subtasks?.find((subtask) => subtask.id === subtaskId);
						if (!found) continue;

						baseSubtask = {
							...found,
							activity: found.activity ?? { id: activity.id, title: activity.title },
							course_name: found.course_name ?? activity.course_name,
						};
						break;
					}
				}

				if (!baseSubtask) return prev;

				const nextSubtask: Subtask = { ...baseSubtask, ...patch };
				const fallbackGroup = currentGroup ?? "upcoming";
				const targetGroup = nextSubtask.target_date
					? getKanbanGroupForDate(nextSubtask.target_date, getLocalDateKey())
					: fallbackGroup;

				const nextState: KanbanState = {
					overdue: prev.overdue.filter((subtask) => subtask.id !== subtaskId),
					today: prev.today.filter((subtask) => subtask.id !== subtaskId),
					upcoming: prev.upcoming.filter((subtask) => subtask.id !== subtaskId),
				};

				nextState[targetGroup] = [...nextState[targetGroup], nextSubtask];
				return nextState;
			});
		},
		[activities],
	);

	const handleConflictDateResolve = useCallback(
		async ({ subtask, nextDate }: { subtask: ConflictModalSubtask; nextDate: string }) => {
			const activityId = resolveActivityIdForConflictSubtask(subtask);
			if (!activityId) {
				toast.error("No se pudo identificar la actividad de la subtarea.");
				throw new Error("Activity not found for subtask");
			}

			try {
				await updateSubtask(activityId, subtask.id, { target_date: nextDate });
				applySubtaskPatchLocally(subtask.id, { target_date: nextDate });
				applyTodayDataPatchLocally(subtask.id, { target_date: nextDate });
				await refreshConflicts();
				void refreshPlannerAfterConflictUpdate();
				toast.success("Fecha actualizada. Carga recalculada.");
			} catch (error) {
				toast.error("No pudimos cambiar la fecha. Intenta de nuevo.");
				throw error;
			}
		},
		[
			applySubtaskPatchLocally,
			applyTodayDataPatchLocally,
			refreshConflicts,
			refreshPlannerAfterConflictUpdate,
			resolveActivityIdForConflictSubtask,
		],
	);

	const handleConflictHoursResolve = useCallback(
		async ({ subtask, nextHours }: { subtask: ConflictModalSubtask; nextHours: number }) => {
			const activityId = resolveActivityIdForConflictSubtask(subtask);
			if (!activityId) {
				toast.error("No se pudo identificar la actividad de la subtarea.");
				throw new Error("Activity not found for subtask");
			}

			try {
				await updateSubtask(activityId, subtask.id, { estimated_hours: nextHours });
				applySubtaskPatchLocally(subtask.id, { estimated_hours: nextHours });
				applyTodayDataPatchLocally(subtask.id, { estimated_hours: nextHours });
				await refreshConflicts();
				void refreshPlannerAfterConflictUpdate();
				toast.success("Horas actualizadas. Carga recalculada.");
			} catch (error) {
				toast.error("No pudimos ajustar las horas. Intenta de nuevo.");
				throw error;
			}
		},
		[
			applySubtaskPatchLocally,
			applyTodayDataPatchLocally,
			refreshConflicts,
			refreshPlannerAfterConflictUpdate,
			resolveActivityIdForConflictSubtask,
		],
	);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			const token = typeof window !== "undefined" ? getAccessToken() : null;

			if (!token) {
				if (!cancelled) setLoading(false);
				return;
			}

			try {
				const [me, acts, todayView, subs] = await Promise.all([
					fetchMe(),
					fetchActivities(),
					fetchTodayView(),
					fetchSubjects(),
				]);
				if (!cancelled) {
					setUser(me ?? null);
					setActivities(Array.isArray(acts) ? acts : []);
					setTodayData({
						overdue: todayView.overdue,
						today: todayView.today,
						upcoming: todayView.upcoming,
					});
					setApiSubjects(Array.isArray(subs) ? subs : []);
					void refreshConflicts();
				}
			} catch (err) {
				console.error("Error cargando datos:", err);
				if (!cancelled) {
					setActivities([]);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [refreshConflicts]);

	const { greeting, GreetingIcon } = useMemo(() => {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return { greeting: "Buenos días", GreetingIcon: Sunrise };
		if (hour >= 12 && hour < 19) return { greeting: "Buenas tardes", GreetingIcon: CloudSun };
		return { greeting: "Buenas noches", GreetingIcon: MoonStar };
	}, []);

	const searchInputRef = useRef<HTMLInputElement>(null);

	// Wave animation — triggers after data loads
	useEffect(() => {
		if (!loading) {
			const start = setTimeout(() => setShowWave(true), 0);
			const stop = setTimeout(() => setShowWave(false), 2200);
			return () => {
				clearTimeout(start);
				clearTimeout(stop);
			};
		}
	}, [loading]);

	useEffect(() => {
		if (searchOpen && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [searchOpen]);

	// Close filter panel on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
				setFiltersOpen(false);
			}
		}
		if (filtersOpen) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [filtersOpen]);

	const updateCapacityPopoverPosition = useCallback(() => {
		const trigger = capacityEditorButtonRef.current;
		if (!trigger) return;

		const rect = trigger.getBoundingClientRect();
		const popoverWidth = Math.min(318, Math.max(272, window.innerWidth - 24));
		const popoverHeight = 88;
		const gap = -2;

		const canOpenRight = rect.right + gap + popoverWidth <= window.innerWidth - 8;
		const side: "right" | "left" = canOpenRight ? "right" : "left";

		const left =
			side === "right"
				? Math.min(rect.right + gap, window.innerWidth - popoverWidth - 8)
				: Math.max(8, rect.left - popoverWidth - gap);

		const centeredTop = rect.top + rect.height / 2 - popoverHeight / 2;
		const top = Math.max(8, Math.min(centeredTop, window.innerHeight - popoverHeight - 8));

		setCapacityPopoverPosition({ top, left, side });
	}, []);

	useEffect(() => {
		if (!capacityEditorOpen) return;

		function handleOutsideClick(event: MouseEvent) {
			const target = event.target as Node;
			if (capacityPopoverRef.current?.contains(target)) return;
			if (capacityEditorButtonRef.current?.contains(target)) return;
			setCapacityEditorOpen(false);
		}

		function handleEscape(event: KeyboardEvent) {
			if (event.key === "Escape" && !dailyLimitSaving) {
				setCapacityEditorOpen(false);
			}
		}

		function handleViewportChange() {
			updateCapacityPopoverPosition();
		}

		updateCapacityPopoverPosition();
		document.addEventListener("mousedown", handleOutsideClick);
		document.addEventListener("keydown", handleEscape);
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, true);
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
			document.removeEventListener("keydown", handleEscape);
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange, true);
		};
	}, [capacityEditorOpen, dailyLimitSaving, updateCapacityPopoverPosition]);

	useEffect(() => {
		if (!capacityEditorOpen) return;

		const frame = window.requestAnimationFrame(() => {
			updateCapacityPopoverPosition();
			dailyLimitInputRef.current?.focus();
			dailyLimitInputRef.current?.select();
		});

		return () => window.cancelAnimationFrame(frame);
	}, [capacityEditorOpen, updateCapacityPopoverPosition]);

	const toggleFilter = useCallback((id: string) => {
		setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
	}, []);

	const todayDateKey = getLocalDateKey();

	const capacityUsed = useMemo(() => {
		if (!todayData) return dateLoadMap[todayDateKey] ?? 0;
		return todayData.today.reduce((sum, subtask) => {
			if (subtask.status === "completed") return sum;
			return sum + (Number(subtask.estimated_hours) || 0);
		}, 0);
	}, [dateLoadMap, todayData, todayDateKey]);

	const knownSubjects = useMemo(
		() => [...new Set(activities.map((a) => a.course_name).filter(Boolean))].sort(),
		[activities],
	);
	const capacityTotal = user?.max_daily_hours ?? 0;
	const capacityOverloaded = capacityTotal > 0 && capacityUsed > capacityTotal;
	const todayPendingConflict = useMemo(
		() => conflicts.find((conflict) => conflict.affected_date === todayDateKey) ?? null,
		[conflicts, todayDateKey],
	);
	const conflictDates = useMemo(
		() => conflicts.map((conflict) => conflict.affected_date),
		[conflicts],
	);
	const capacityPercent =
		capacityTotal > 0 ? Math.min((capacityUsed / capacityTotal) * 100, 100) : 0;
	const sidebarCapacityLoading = loading || !user;
	const sidebarConflictsLoading = loading || conflictsLoading;

	const warnTodayConflictAfterScheduling = useCallback(
		(action: "crear" | "editar") => {
			toast.warning(
				action === "crear"
					? "Aviso: esta historia quedo para hoy y ya existe un conflicto de carga. Puedes resolverlo despues en Conflictos."
					: "Aviso: la historia quedo para hoy y ya existe un conflicto de carga. Puedes resolverlo despues en Conflictos.",
				{
					duration: 7000,
					action: {
						label: "Ver conflictos",
						onClick: () => {
							setConflictsOpen(true);
							if (activeNav !== "today") navigate("/hoy");
						},
					},
				},
			);
		},
		[activeNav, navigate],
	);

	function closeCapacityEditor() {
		if (dailyLimitSaving) return;
		setCapacityEditorOpen(false);
	}

	function toggleCapacityEditor() {
		if (!user || dailyLimitSaving) return;
		setCapacityEditorOpen((prev) => {
			if (!prev) setDailyLimitDraft(String(user.max_daily_hours));
			return !prev;
		});
	}

	async function handleCapacityLimitSave() {
		const parsedLimit = Number(dailyLimitDraft);
		if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
			toast.error("Ingresa un limite diario valido (1h o mas).");
			return;
		}

		setDailyLimitSaving(true);
		try {
			const updatedUser = await updateMe({ max_daily_hours: parsedLimit });
			await refreshConflicts();
			setCapacityEditorOpen(false);
			toast.success("Limite diario actualizado.");
			window.requestAnimationFrame(() => {
				setUser(updatedUser);
			});
		} catch (error) {
			const responseData =
				typeof error === "object" && error !== null
					? (error as { response?: { data?: Record<string, unknown> } }).response?.data
					: null;
			const rawLimitError = responseData?.max_daily_hours;
			const limitError =
				typeof rawLimitError === "string"
					? rawLimitError
					: Array.isArray(rawLimitError) && typeof rawLimitError[0] === "string"
						? rawLimitError[0]
						: null;

			toast.error(limitError ?? "No se pudo actualizar el limite diario.");
		} finally {
			setDailyLimitSaving(false);
		}
	}

	// Delete flow: request (opens modal) -> perform (calls API)
	const [confirmDelete, setConfirmDelete] = useState<{ id: number; title: string } | null>(null);
	const [deleting, setDeleting] = useState(false);

	function requestDeleteActivity(id: number, title?: string) {
		setConfirmDelete({ id, title: title ?? "(sin título)" });
	}

	async function performDeleteActivity(id: number) {
		setDeleting(true);
		try {
			await deleteActivity(id);
			setActivities((prev) => prev.filter((a) => a.id !== id));
			void refreshConflicts();
			toast.success("Actividad eliminada");
			setConfirmDelete(null);
		} catch (err) {
			console.error("Error deleting activity:", err);
			toast.error("No se pudo eliminar la actividad");
		} finally {
			setDeleting(false);
		}
	}

	return (
		<div className="dashboard" data-testid="dashboard-container">
			{/* Confirm delete modal */}
			{confirmDelete &&
				createPortal(
					<>
						<div
							onClick={() => setConfirmDelete(null)}
							data-testid="dashboard-confirm-delete-backdrop"
							style={{
								position: "fixed",
								inset: 0,
								background: "rgba(4,3,12,0.72)",
								backdropFilter: "blur(14px) saturate(150%)",
								WebkitBackdropFilter: "blur(14px) saturate(150%)",
								zIndex: 9999,
								animation: "fadeInBackdrop 0.18s ease",
							}}
						/>
						<div
							style={{
								position: "fixed",
								inset: 0,
								zIndex: 10000,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "20px",
							}}
						>
							<div
								onClick={(e) => e.stopPropagation()}
								data-testid="dashboard-confirm-delete-modal"
								style={{
									position: "relative",
									background: isDark
										? "linear-gradient(155deg,#1a0e0e 0%,#110909 55%,#090404 100%)"
										: "linear-gradient(155deg,#fff5f5 0%,#fff0f0 55%,#ffe8e8 100%)",
									border: "1px solid rgba(248,113,113,0.2)",
									borderRadius: "16px",
									width: "100%",
									maxWidth: "360px",
									boxShadow: isDark
										? "0 25px 60px rgba(0,0,0,0.65), inset 0 0 60px rgba(239,68,68,0.03)"
										: "0 25px 60px rgba(0,0,0,0.12), inset 0 0 30px rgba(239,68,68,0.02)",
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
								<p
									style={{
										margin: "0 0 8px",
										fontSize: "17px",
										fontWeight: 700,
										color: isDark ? "#f1f5f9" : "#1e1a33",
									}}
								>
									Confirmar eliminación
								</p>
								<p
									style={{
										margin: "0 0 24px",
										fontSize: "13px",
										color: isDark ? "#94a3b8" : "#6b52b5",
										lineHeight: 1.6,
									}}
								>
									Se eliminará permanentemente{" "}
									<strong style={{ color: isDark ? "#e2e8f0" : "#1e1a33" }}>
										"{confirmDelete.title}"
									</strong>
									. Esta acción no se puede deshacer.
								</p>
								<div style={{ display: "flex", gap: "10px" }}>
									<button
										onClick={() => performDeleteActivity(confirmDelete.id)}
										disabled={deleting}
										className="modal-btn-danger"
										data-testid="dashboard-confirm-delete-accept-btn"
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
										onClick={() => setConfirmDelete(null)}
										disabled={deleting}
										className="modal-btn-cancel"
										data-testid="dashboard-confirm-delete-cancel-btn"
										style={{
											flex: 1,
											padding: "11px 14px",
											borderRadius: "8px",
											border: isDark ? "1px solid #334155" : "1px solid rgba(239,68,68,0.3)",
											cursor: "pointer",
											fontSize: "13px",
											fontWeight: 600,
											background: "transparent",
											color: isDark ? "#94a3b8" : "#9a3a3a",
										}}
									>
										Cancelar
									</button>
								</div>
							</div>
						</div>
					</>,
					document.body,
				)}
			{capacityEditorOpen &&
				createPortal(
					<div
						className="capacity-popover-layer"
						role="presentation"
						data-testid="dashboard-capacity-popover-layer"
					>
						<div
							id="capacity-quick-editor"
							ref={capacityPopoverRef}
							className={`capacity-popover is-${capacityPopoverPosition.side}`}
							role="dialog"
							aria-modal="false"
							aria-label="Editor rapido de limite diario"
							data-testid="dashboard-capacity-popover"
							style={{
								top: `${capacityPopoverPosition.top}px`,
								left: `${capacityPopoverPosition.left}px`,
							}}
						>
							<form
								className="capacity-inline-form"
								data-testid="dashboard-capacity-form"
								onSubmit={(event) => {
									event.preventDefault();
									void handleCapacityLimitSave();
								}}
							>
								<label className="capacity-inline-prefix" htmlFor="daily-hours-input-floating">
									Limite
								</label>
								<div className="capacity-inline-input-wrap">
									<input
										id="daily-hours-input-floating"
										type="number"
										min={1}
										step={1}
										className="capacity-inline-input"
										value={dailyLimitDraft}
										onChange={(event) => setDailyLimitDraft(event.target.value)}
										disabled={dailyLimitSaving}
										ref={dailyLimitInputRef}
										aria-label="Horas por dia"
										data-testid="dashboard-capacity-input"
									/>
									<span className="capacity-inline-unit">h</span>
								</div>
								<button
									type="submit"
									className="capacity-inline-save"
									disabled={dailyLimitSaving}
									aria-label="Guardar limite"
									data-testid="dashboard-capacity-save-btn"
								>
									{dailyLimitSaving ? (
										<Loader2 size={14} className="spinner" />
									) : (
										<Check size={14} />
									)}
								</button>
								<button
									type="button"
									className="capacity-inline-cancel"
									onClick={closeCapacityEditor}
									disabled={dailyLimitSaving}
									aria-label="Cancelar"
									data-testid="dashboard-capacity-cancel-btn"
								>
									<X size={14} />
								</button>
							</form>
						</div>
					</div>,
					document.body,
				)}
			{conflictsOpen && conflictModalItems.length > 0 && (
				<ConflictModal
					conflicts={conflictModalItems}
					dateLoadMap={dateLoadMap}
					maxDailyHours={user?.max_daily_hours ?? 0}
					onClose={() => setConflictsOpen(false)}
					onChangeDate={({ subtask, nextDate }) => handleConflictDateResolve({ subtask, nextDate })}
					onReduceHours={({ subtask, nextHours }) =>
						handleConflictHoursResolve({ subtask, nextHours })
					}
				/>
			)}
			{/* ======= SIDEBAR ======= */}
			<aside className="sidebar" data-testid="dashboard-sidebar">
				{/* User profile */}
				<div className="sidebar-profile" data-testid="dashboard-user-profile">
					{loading ? (
						<div className="sidebar-profile-skeleton">
							<div className="skeleton-avatar" />
							<div className="skeleton-lines">
								<div className="skeleton-line skeleton-line-name" />
								<div className="skeleton-line skeleton-line-email" />
							</div>
						</div>
					) : (
						<>
							<div className="profile-avatar">
								<div className="avatar-placeholder">
									{user?.name ? (
										<span className="avatar-initials">
											{user.name
												.split(" ")
												.slice(0, 2)
												.map((w) => w[0])
												.join("")
												.toUpperCase()}
										</span>
									) : (
										<User2 size={22} />
									)}
								</div>
								<div className="avatar-status" />
							</div>
							<div className="profile-info">
								<span className="profile-name">{user?.name || user?.username}</span>
								<span className="profile-role">{user?.email}</span>
							</div>
							<button
								className="profile-menu-btn"
								aria-label="Menu"
								data-testid="dashboard-profile-menu-btn"
							>
								<MoreVertical size={18} />
							</button>
						</>
					)}
				</div>

				{/* Greeting */}
				{!loading && (
					<div className="sidebar-greeting-block fade-in" style={{ animationDelay: "0.1s" }}>
						<p className="sidebar-greeting">
							{showWave ? (
								<Hand size={22} className="wave-icon" />
							) : (
								<GreetingIcon size={20} className="greeting-icon" />
							)}
							{greeting}.
						</p>
						<p className="sidebar-subtitle">¿Qué haremos hoy?</p>
					</div>
				)}

				{/* Navigation */}
				<nav className="sidebar-nav" data-testid="dashboard-nav">
					<button
						className={`nav-item ${activeNav === "today" ? "active" : ""}`}
						onClick={() => navigate("/hoy")}
						data-testid="dashboard-nav-today"
					>
						<CalendarCheck size={18} />
						<span>Hoy</span>
					</button>
					<button
						className={`nav-item ${activeNav === "progress" ? "active" : ""}`}
						onClick={() => navigate("/progreso")}
						data-testid="dashboard-nav-progress"
					>
						<BarChart3 size={18} />
						<span>Mi progreso</span>
					</button>
					<button
						className={`nav-item ${activeNav === "org" ? "active" : ""}`}
						onClick={() => navigate("/organizacion")}
						data-testid="dashboard-nav-org"
					>
						<Users size={18} />
						<span>Organización</span>
					</button>
				</nav>

				{/* Spacer */}
				<div className="sidebar-spacer" />

				{/* Capacity */}
				<div className="sidebar-capacity">
					<div className="capacity-header">
						<span className="capacity-label">Capacidad</span>
						{sidebarCapacityLoading ? (
							<span className="capacity-loading-value">
								<Loader2 size={12} className="spinner" />
								Cargando...
							</span>
						) : (
							<span className="capacity-numbers">
								<span className="capacity-used">{capacityUsed}h</span>
								<span className="capacity-sep">/</span>
								<span className="capacity-total">{capacityTotal}h</span>
							</span>
						)}
					</div>
					<div className="capacity-bar">
						<div
							className={`capacity-fill ${capacityOverloaded ? "is-overloaded" : ""} ${sidebarCapacityLoading ? "is-loading" : ""}`}
							style={{ width: sidebarCapacityLoading ? "42%" : `${capacityPercent}%` }}
						/>
					</div>
					<button
						type="button"
						className={`capacity-edit-btn ${capacityEditorOpen ? "is-open" : ""}`}
						onClick={toggleCapacityEditor}
						ref={capacityEditorButtonRef}
						disabled={!user || sidebarCapacityLoading}
						aria-expanded={capacityEditorOpen}
						aria-controls="capacity-quick-editor"
						data-testid="dashboard-capacity-edit-btn"
					>
						{sidebarCapacityLoading ? "Cargando capacidad..." : "Editar limite diario"}
					</button>
				</div>

				<button
					className="sidebar-conflicts-btn"
					disabled={sidebarConflictsLoading}
					data-testid="dashboard-conflicts-btn"
					onClick={async () => {
						if (sidebarConflictsLoading) return;
						const conflicts = await refreshConflicts();
						if (!conflicts.length) {
							toast.success("No tienes conflictos pendientes.");
							return;
						}
						setConflictsOpen(true);
						if (activeNav !== "today") navigate("/hoy");
					}}
				>
					<span className="sidebar-conflicts-label">
						<AlertTriangle size={14} />
						Conflictos
					</span>
					<span
						className={`sidebar-conflicts-count ${sidebarConflictsLoading ? "ok is-loading" : conflictCount > 0 ? "danger" : "ok"}`}
						data-testid="dashboard-conflicts-count"
					>
						{sidebarConflictsLoading ? <Loader2 size={12} className="spinner" /> : conflictCount}
					</span>
				</button>

				{/* Logout */}
				<button className="logout-btn" onClick={onLogout} data-testid="dashboard-logout-btn">
					<LogOut size={16} />
					<span>Cerrar sesión</span>
				</button>

				{/* Branding */}
				<div className="sidebar-brand">
					<img src={lumaLogo} alt="Luma" className="sidebar-logo" />
					<ThemeToggle className="sidebar-brand-toggle" qaId="dashboard-theme-toggle-btn" />
				</div>
			</aside>

			{/* ======= MAIN CONTENT ======= */}
			<main className="main-content" data-testid="dashboard-main-content">
				{loading ? (
					<div className="loading-state" data-testid="dashboard-loading-state">
						<Loader2 size={32} className="spinner" />
						<p>Cargando actividades...</p>
					</div>
				) : (
					<>
						{/* Tip banner */}
						<div
							className="tip-banner fade-in"
							style={{ animationDelay: "0.05s" }}
							data-testid="dashboard-tip-banner"
						>
							<Sparkles size={18} className="tip-icon" />
							<p>{headerInfo.tipText}</p>
						</div>

						{/* Header toolbar */}
						<div
							className="content-header fade-in"
							style={{ animationDelay: "0.12s" }}
							data-testid="dashboard-toolbar"
						>
							<div className="header-left">
								<h1 className="page-title" data-testid="dashboard-page-title">
									<headerInfo.TitleIcon size={22} className="title-icon" />
									{headerInfo.title}
								</h1>
								{activeNav === "org" && (
									<>
										<button
											className="btn-add"
											style={{ background: "#334155", border: "1px solid #475569" }}
											onClick={() => setSubjectModal({ mode: "add" })}
											data-testid="dashboard-add-subject-btn"
										>
											<BookOpen size={16} />
											<span>Agregar materia</span>
										</button>
										<button
											className="btn-add"
											onClick={() => {
												setPrefilledSubject("");
												setCreateOpen(true);
											}}
											data-testid="dashboard-create-activity-btn"
										>
											<Plus size={16} />
											<span>Nueva actividad</span>
										</button>
									</>
								)}
							</div>

							{/* Create activity modal (rendered at top level to avoid z-index issues) */}
							<CreateActivityModal
								open={createOpen}
								onClose={() => setCreateOpen(false)}
								initialSubject={prefilledSubject}
								knownSubjects={knownSubjects}
								dateLoadMap={dateLoadMap}
								conflictDates={conflictDates}
								maxDailyHours={capacityTotal}
								onCreate={async (payload: NewActivityPayloadFromModal) => {
									try {
										const apiPayload = {
											course_name: payload.subject,
											title: payload.title,
											description: payload.description,
											due_date: payload.due_date,
											status: "pending" as const,
											total_estimated_hours:
												payload.total_estimated_hours ??
												(payload.subtasks
													? payload.subtasks.reduce(
															(acc, s) =>
																acc +
																(typeof s.estimated_hours === "number"
																	? s.estimated_hours
																	: Number(s.estimated_hours || 0)),
															0,
														)
													: 0),
											subtasks: payload.subtasks?.map((s) => ({
												name: s.title,
												target_date: s.target_date,
												estimated_hours: Number(s.estimated_hours || 0),
											})),
										};

										console.log("createActivity payload:", apiPayload);
										const resp = await createActivity(apiPayload);

										const totalHoursFromPayload =
											payload.total_estimated_hours ??
											(payload.subtasks
												? payload.subtasks.reduce(
														(acc, s) =>
															acc +
															(typeof s.estimated_hours === "number"
																? s.estimated_hours
																: Number(s.estimated_hours || 0)),
														0,
													)
												: 0);

										const created: Activity = {
											...resp,
											course_name: resp.course_name ?? apiPayload.course_name ?? payload.subject,
											subtask_count: payload.subtasks?.length ?? 0,
											total_estimated_hours: resp.total_estimated_hours ?? totalHoursFromPayload,
										};
										setActivities((prev) => [created, ...prev]);
										if (activeNav === "org") {
											const subjectName =
												resp.course_name ?? apiPayload.course_name ?? payload.subject;
											if (subjectName) setPendingExpandSubject({ subject: subjectName });
										}
										setCreateOpen(false);

										const newTodayHours =
											payload.subtasks
												?.filter((s) => s.target_date === todayDateKey)
												.reduce((sum, s) => sum + Number(s.estimated_hours || 0), 0) ?? 0;
										const projectedTodayHours = (dateLoadMap[todayDateKey] ?? 0) + newTodayHours;
										const hasProjectedTodayConflict =
											payload.due_date === todayDateKey &&
											(!!todayPendingConflict ||
												(capacityTotal > 0 && projectedTodayHours > capacityTotal));

										if (hasProjectedTodayConflict) {
											warnTodayConflictAfterScheduling("crear");
										}

										const createdConflict = checkDailyConflicts(
											payload.subtasks?.map((s) => ({
												target_date: s.target_date,
												estimated_hours: Number(s.estimated_hours || 0),
											})) ?? [],
											user?.max_daily_hours ?? 0,
										);
										if (createdConflict) {
											handleConflictDetected({
												activityTitle: payload.title,
												date: createdConflict.date,
												totalHours: createdConflict.totalHours,
												maxHours: user?.max_daily_hours ?? 0,
											});
										}
										void refreshConflicts();
										toast.success("Actividad creada");
									} catch (err) {
										console.error("Failed to create activity:", err);
										toast.error("Error creando la actividad. Intenta de nuevo.");
									}
								}}
							/>
							<div className="header-right">
								<div
									className="filter-wrapper"
									ref={filterRef}
									style={{ display: activeNav === "today" ? "none" : undefined }}
									data-testid="dashboard-filter-wrapper"
								>
									<button
										className={`btn-filter ${filtersOpen ? "active" : ""}`}
										onClick={() => setFiltersOpen(!filtersOpen)}
										data-testid="dashboard-filters-btn"
									>
										<SlidersHorizontal size={15} />
										<span>Filtros</span>
										{activeFilters.length > 0 && (
											<span className="filter-badge">{activeFilters.length}</span>
										)}
									</button>

									{/* Filter panel */}
									<div
										className={`filter-panel ${filtersOpen ? "open" : ""}`}
										data-testid="dashboard-filters-panel"
									>
										<div className="filter-panel-header">
											<span>{activeNav === "org" ? "Ordenar materias" : "Filtrar por"}</span>
											<button
												className="filter-close"
												onClick={() => setFiltersOpen(false)}
												data-testid="dashboard-filters-close-btn"
											>
												<X size={14} />
											</button>
										</div>

										<div className="filter-options">
											{activeNav === "org" ? (
												<>
													<button
														className={`filter-chip ${activeFilters.includes("org-az") ? "on" : ""}`}
														onClick={() => toggleFilter("org-az")}
														data-testid="dashboard-filter-chip-org-az"
													>
														<ArrowUpDown size={13} />A → Z
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("org-za") ? "on" : ""}`}
														onClick={() => toggleFilter("org-za")}
														data-testid="dashboard-filter-chip-org-za"
													>
														<ArrowUpDown size={13} />Z → A
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("org-count") ? "on" : ""}`}
														onClick={() => toggleFilter("org-count")}
														data-testid="dashboard-filter-chip-org-count"
													>
														<Tag size={13} />
														Más actividades
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("org-hours") ? "on" : ""}`}
														onClick={() => toggleFilter("org-hours")}
														data-testid="dashboard-filter-chip-org-hours"
													>
														<Clock size={13} />
														Más horas
													</button>
												</>
											) : (
												<>
													<button
														className={`filter-chip ${activeFilters.includes("urgency") ? "on" : ""}`}
														onClick={() => toggleFilter("urgency")}
														data-testid="dashboard-filter-chip-urgency"
													>
														<AlertTriangle size={13} />
														Urgencia
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("duration") ? "on" : ""}`}
														onClick={() => toggleFilter("duration")}
														data-testid="dashboard-filter-chip-duration"
													>
														<Clock size={13} />
														Duración
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("date") ? "on" : ""}`}
														onClick={() => toggleFilter("date")}
														data-testid="dashboard-filter-chip-date"
													>
														<CalendarCheck size={13} />
														Fecha límite
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("category") ? "on" : ""}`}
														onClick={() => toggleFilter("category")}
														data-testid="dashboard-filter-chip-category"
													>
														<Tag size={13} />
														Categoría
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("alphabetical") ? "on" : ""}`}
														onClick={() => toggleFilter("alphabetical")}
														data-testid="dashboard-filter-chip-alphabetical"
													>
														<ArrowUpDown size={13} />
														Alfabético
													</button>
												</>
											)}
										</div>
										{activeFilters.length > 0 && (
											<button
												className="filter-clear"
												onClick={() => setActiveFilters([])}
												data-testid="dashboard-filters-clear-btn"
											>
												Limpiar filtros
											</button>
										)}
									</div>
								</div>

								<div className={`search-wrapper ${searchOpen ? "open" : ""}`}>
									<button
										className="btn-search"
										onClick={() => setSearchOpen(!searchOpen)}
										data-testid="dashboard-search-btn"
									>
										<Search size={15} />
										<span>Buscar</span>
									</button>
									<div className="search-expand">
										<input
											ref={searchInputRef}
											type="text"
											placeholder="Buscar actividades..."
											className="search-input"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											data-testid="dashboard-search-input"
										/>
									</div>
								</div>
							</div>
						</div>

						{/* ===== TODAY VIEW ===== */}
						{activeNav === "today" && (
							<TodayKanban
								initialData={todayData}
								onDataRefresh={setTodayData}
								activities={activities}
								maxDailyHours={user?.max_daily_hours ?? 0}
								conflictDates={conflictDates}
								onConflict={handleConflictDetected}
								onSubtaskMutated={() => {
									void refreshConflicts();
									void fetchActivities().then((acts) =>
										setActivities(Array.isArray(acts) ? acts : []),
									);
								}}
								searchQuery={searchQuery}
							/>
						)}
						{/* ===== ORG VIEW ===== */}
						{activeNav === "org" && (
							<OrganizationView
								activities={activities}
								subjects={subjects}
								onDelete={requestDeleteActivity}
								onAddSubject={addCustomSubject}
								onRemoveSubject={removeCustomSubject}
								onRenameSubject={renameCustomSubject}
								onActivityUpdate={(updated) =>
									setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
								}
								onSubtaskMutated={() => {
									void refreshTodayFromOrganizationMutation();
								}}
								dateLoadMap={dateLoadMap}
								conflictDates={conflictDates}
								maxDailyHours={capacityTotal}
								onActivitySaved={(updated, previous) => {
									void previous;
									const dueInToday = updated.due_date === todayDateKey;
									if (!dueInToday) return;

									const currentTodayHours = dateLoadMap[todayDateKey] ?? 0;
									const hasTodayConflict =
										!!todayPendingConflict ||
										(capacityTotal > 0 && currentTodayHours > capacityTotal);

									if (hasTodayConflict) {
										warnTodayConflictAfterScheduling("editar");
									}
								}}
								activeFilters={activeFilters}
								searchQuery={searchQuery}
								expandSubject={pendingExpandSubject}
								onOpenCreate={(subject) => {
									setPrefilledSubject(subject ?? "");
									setCreateOpen(true);
								}}
							/>
						)}

						{/* ===== PROGRESS VIEW ===== */}
						{activeNav === "progress" && (
							<div
								className="fade-in"
								data-testid="dashboard-progress-view"
								style={{
									animationDelay: "0.2s",
									padding: "4rem 2rem",
									textAlign: "center",
									color: "#94a3b8",
								}}
							>
								<BarChart3
									size={48}
									style={{ opacity: 0.2, margin: "0 auto 1rem auto", display: "block" }}
								/>
								<p>Vista de progreso en construcción...</p>
							</div>
						)}
					</>
				)}
				{/* Subject name modal (from header button) */}
				{subjectModal &&
					createPortal(
						<div
							data-testid="dashboard-subject-form-layer"
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
							onClick={() => setSubjectModal(null)}
						>
							<SubjectFormModal
								mode={subjectModal.mode}
								current={subjectModal.current}
								onClose={() => setSubjectModal(null)}
								onConfirm={(name) => {
									addCustomSubject(name);
									setSubjectModal(null);
								}}
							/>
						</div>,
						document.body,
					)}
			</main>
		</div>
	);
}
