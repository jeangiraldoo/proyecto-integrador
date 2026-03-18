import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
	fetchMe,
	updateMe,
	fetchActivities,
	fetchTodayView,
	fetchConflicts,
	fetchSubjects,
	createSubject,
	deleteSubject,
	updateSubject,
	updateSubtask,
	deleteActivity,
	createActivity,
	type User,
	type Activity,
	type Conflict,
	type Subtask,
	type Subject,
} from "@/api/dashboard";
import {
	Folder,
	BarChart3,
	CalendarCheck,
	Sunrise,
	CloudSun,
	MoonStar,
} from "lucide-react";
import {
	checkDailyConflicts,
	type KanbanGroup,
	type KanbanState,
	type NewActivityPayloadFromModal,
} from "@/pages/Dashboard/dashboardUtils";
import {
	type ConflictModalItem,
	type ConflictModalSubtask,
} from "@/components/modals/ConflictModal";

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

export function useLayout() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const activeNav =
		pathname === "/organizacion" ? "org" : pathname === "/progreso" ? "progress" : "today";

	const [user, setUser] = useState<User | null>(null);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [todayData, setTodayData] = useState<KanbanState | null>(null);
	const [apiSubjects, setApiSubjects] = useState<Subject[]>([]);
	const [conflicts, setConflicts] = useState<Conflict[]>([]);
	const [conflictsLoading, setConflictsLoading] = useState(false);
	const [customSubjects, setCustomSubjects] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("luma_subjects") ?? "[]") as string[];
		} catch {
			return [];
		}
	});

	const [createOpen, setCreateOpen] = useState(false);
	const [prefilledSubject, setPrefilledSubject] = useState("");
	const [pendingExpandSubject, setPendingExpandSubject] = useState<{ subject: string } | null>(
		null,
	);
	const [subjectModal, setSubjectModal] = useState<{
		mode: "add" | "rename";
		current?: string;
	} | null>(null);
	const [conflictsOpen, setConflictsOpen] = useState(false);
	const [conflictCount, setConflictCount] = useState(0);
	const [capacityEditorOpen, setCapacityEditorOpen] = useState(false);
	const [dailyLimitDraft, setDailyLimitDraft] = useState("");
	const [dailyLimitSaving, setDailyLimitSaving] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<{ id: number; title: string } | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [activeFilters, setActiveFilters] = useState<string[]>([]);
	const [showWave, setShowWave] = useState(false);

	const todayDateKey = useMemo(() => getLocalDateKey(), []);

	const [capacityPopoverPosition, setCapacityPopoverPosition] = useState<{
		top: number;
		left: number;
		side: "right" | "left";
	}>({ top: 0, left: 0, side: "right" });

	const updateCapacityPopoverPosition = useCallback((trigger: HTMLButtonElement | null) => {
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

	const subjects = useMemo<string[]>(() => {
		const fromActivities = activities.map((a) => a.course_name).filter(Boolean);
		const fromApi = apiSubjects.map((s) => s.name);
		return Array.from(new Set([...fromActivities, ...fromApi, ...customSubjects])).sort();
	}, [activities, customSubjects, apiSubjects]);

	const refreshConflicts = useCallback(async () => {
		setConflictsLoading(true);
		try {
			const conflictsResult = await fetchConflicts();
			const result = Array.isArray(conflictsResult) ? conflictsResult : [];
			setConflicts(result);
			setConflictCount(result.length);
			return result;
		} catch (err) {
			console.warn("No se pudo cargar el conteo de conflictos:", err);
			setConflicts([]);
			return [] as Conflict[];
		} finally {
			setConflictsLoading(false);
		}
	}, []);

	const loadData = useCallback(async () => {
		try {
			const [me, acts, todayView, subs] = await Promise.all([
				fetchMe(),
				fetchActivities(),
				fetchTodayView(),
				fetchSubjects(),
			]);
			setUser(me ?? null);
			setActivities(Array.isArray(acts) ? acts : []);
			setTodayData({
				overdue: todayView.overdue,
				today: todayView.today,
				upcoming: todayView.upcoming,
			});
			setApiSubjects(Array.isArray(subs) ? subs : []);
			void refreshConflicts();
		} catch (err) {
			console.error("Error cargando datos:", err);
			setActivities([]);
		} finally {
			setLoading(false);
		}
	}, [refreshConflicts]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// Wave animation
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

	const addCustomSubject = useCallback((name: string) => {
		const trimmed = name.trim();
		if (!trimmed) return;
		createSubject(trimmed)
			.then((created) => {
				setApiSubjects((prev) =>
					prev.some((s) => s.name === created.name) ? prev : [...prev, created],
				);
			})
			.catch(() => {
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
	}, []);

	const removeCustomSubject = useCallback(
		async (name: string): Promise<void> => {
			const subject = apiSubjects.find((s) => s.name === name);
			if (subject) {
				await deleteSubject(subject.id);
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
		},
		[apiSubjects, refreshConflicts],
	);

	const renameCustomSubject = useCallback(
		async (oldName: string, newName: string): Promise<void> => {
			const trimmed = newName.trim();
			if (!trimmed || trimmed === oldName) return;
			const subject = apiSubjects.find((s) => s.name === oldName);
			if (subject) {
				await updateSubject(subject.id, trimmed);
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
		},
		[apiSubjects, refreshConflicts],
	);

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
			const activityId =
				subtask.activityId ||
				activities.find((activity) => activity.subtasks?.some((item) => item.id === subtask.id))?.id;

			if (!activityId) {
				toast.error("No se pudo identificar la actividad de la subtarea.");
				throw new Error("Activity not found for subtask");
			}

			try {
				await updateSubtask(activityId, subtask.id, { target_date: nextDate });
				applySubtaskPatchLocally(subtask.id, { target_date: nextDate });
				applyTodayDataPatchLocally(subtask.id, { target_date: nextDate });
				await refreshConflicts();
				const [acts, today] = await Promise.all([fetchActivities(), fetchTodayView()]);
				setActivities(Array.isArray(acts) ? acts : []);
				setTodayData({ overdue: today.overdue, today: today.today, upcoming: today.upcoming });
				toast.success("Fecha actualizada. Carga recalculada.");
			} catch (error) {
				toast.error("No pudimos cambiar la fecha. Intenta de nuevo.");
				throw error;
			}
		},
		[activities, applySubtaskPatchLocally, applyTodayDataPatchLocally, refreshConflicts],
	);

	const handleConflictHoursResolve = useCallback(
		async ({ subtask, nextHours }: { subtask: ConflictModalSubtask; nextHours: number }) => {
			const activityId =
				subtask.activityId ||
				activities.find((activity) => activity.subtasks?.some((item) => item.id === subtask.id))?.id;

			if (!activityId) {
				toast.error("No se pudo identificar la actividad de la subtarea.");
				throw new Error("Activity not found for subtask");
			}

			try {
				await updateSubtask(activityId, subtask.id, { estimated_hours: nextHours });
				applySubtaskPatchLocally(subtask.id, { estimated_hours: nextHours });
				applyTodayDataPatchLocally(subtask.id, { estimated_hours: nextHours });
				await refreshConflicts();
				const [acts, today] = await Promise.all([fetchActivities(), fetchTodayView()]);
				setActivities(Array.isArray(acts) ? acts : []);
				setTodayData({ overdue: today.overdue, today: today.today, upcoming: today.upcoming });
				toast.success("Horas actualizadas. Carga recalculada.");
			} catch (error) {
				toast.error("No pudimos ajustar las horas. Intenta de nuevo.");
				throw error;
			}
		},
		[activities, applySubtaskPatchLocally, applyTodayDataPatchLocally, refreshConflicts],
	);

	const handleCapacityLimitSaveAction = useCallback(async () => {
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
			setUser(updatedUser);
		} catch (error: any) {
			const responseData = error?.response?.data;
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
	}, [dailyLimitDraft, refreshConflicts]);

	const performDeleteActivity = useCallback(
		async (id: number) => {
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
		},
		[refreshConflicts],
	);

	const toggleFilter = useCallback((id: string) => {
		setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
	}, []);

	const headerInfo = useMemo(() => {
		const config = {
			org: {
				title: "Organización",
				TitleIcon: Folder,
				tipText: "Organiza tus actividades por materia y controla tu carga de trabajo.",
			},
			progress: {
				title: "Mi progreso",
				TitleIcon: BarChart3,
				tipText: "Analiza tu desempeño, el tiempo invertido y tus estadísticas generales.",
			},
			today: {
				title: "Hoy",
				TitleIcon: CalendarCheck,
				tipText: "Tus tareas más urgentes, ordenadas para que puedas avanzar rápido. Marca cada una al terminar.",
			},
		};
		return config[activeNav as keyof typeof config] || config.today;
	}, [activeNav]);

	const { greeting, GreetingIcon } = useMemo(() => {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return { greeting: "Buenos días", GreetingIcon: Sunrise };
		if (hour >= 12 && hour < 19) return { greeting: "Buenas tardes", GreetingIcon: CloudSun };
		return { greeting: "Buenas noches", GreetingIcon: MoonStar };
	}, []);

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

	const capacityUsed = useMemo(() => {
		if (!todayData) return dateLoadMap[todayDateKey] ?? 0;
		return todayData.today.reduce((sum, subtask) => {
			if (subtask.status === "completed") return sum;
			return sum + (Number(subtask.estimated_hours) || 0);
		}, 0);
	}, [dateLoadMap, todayData, todayDateKey]);

	const capacityTotal = user?.max_daily_hours ?? 0;
	const capacityOverloaded = capacityTotal > 0 && capacityUsed > capacityTotal;
	const capacityPercent = capacityTotal > 0 ? Math.min((capacityUsed / capacityTotal) * 100, 100) : 0;

	const conflictDates = useMemo(() => conflicts.map((conflict) => conflict.affected_date), [conflicts]);

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
					target_date: subtask.target_date,
					courseName: activity.course_name,
				})),
		);

		return conflicts.map((conflict) => {
			const subtasks = subtaskPool
				.filter((subtask) => subtask.target_date === conflict.affected_date)
				.sort((left, right) => right.estimatedHours - left.estimatedHours)
				.map((subtask) => ({ ...subtask })) as ConflictModalSubtask[];

			return {
				id: conflict.id,
				date: conflict.affected_date,
				plannedHours: conflict.planned_hours,
				maxHours: conflict.max_allowed_hours,
				title: "Subtareas en conflicto",
				subtitle:
					subtasks.length > 1
						? `${subtasks.length} subtareas afectadas en esta fecha`
						: (subtasks[0]?.name ?? "Sobrecarga reportada por el backend"),
				subtasks,
			};
		});
	}, [activities, conflicts]);

	const knownSubjects = useMemo(
		() => [...new Set(activities.map((a) => a.course_name).filter(Boolean))].sort(),
		[activities],
	);

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

	const handleCreateActivity = useCallback(
		async (payload: NewActivityPayloadFromModal) => {
			try {
				const apiPayload = {
					course_name: payload.subject,
					title: payload.title,
					description: payload.description,
					due_date: payload.due_date,
					status: "pending" as const,
					total_estimated_hours:
						payload.total_estimated_hours ??
						(payload.subtasks?.reduce((acc, s) => acc + Number(s.estimated_hours || 0), 0) ?? 0),
					subtasks: payload.subtasks?.map((s) => ({
						name: s.title,
						target_date: s.target_date,
						estimated_hours: Number(s.estimated_hours || 0),
					})),
				};

				const resp = await createActivity(apiPayload);
				const created: Activity = {
					...resp,
					course_name: resp.course_name ?? payload.subject,
					subtask_count: payload.subtasks?.length ?? 0,
					total_estimated_hours: resp.total_estimated_hours ?? apiPayload.total_estimated_hours,
				};
				setActivities((prev) => [created, ...prev]);
				if (activeNav === "org" && created.course_name) {
					setPendingExpandSubject({ subject: created.course_name });
				}
				setCreateOpen(false);

				const todayPendingConflict = conflicts.find((c) => c.affected_date === todayDateKey);
				const newTodayHours =
					payload.subtasks
						?.filter((s) => s.target_date === todayDateKey)
						.reduce((sum, s) => sum + Number(s.estimated_hours || 0), 0) ?? 0;
				const projectedTodayHours = (dateLoadMap[todayDateKey] ?? 0) + newTodayHours;

				if (
					payload.due_date === todayDateKey &&
					(!!todayPendingConflict || (capacityTotal > 0 && projectedTodayHours > capacityTotal))
				) {
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
					void refreshConflicts();
				}
				toast.success("Actividad creada");
			} catch (err) {
				console.error("Failed to create activity:", err);
				toast.error("Error creando la actividad. Intenta de nuevo.");
			}
		},
		[
			activeNav,
			conflicts,
			dateLoadMap,
			capacityTotal,
			refreshConflicts,
			todayDateKey,
			user?.max_daily_hours,
			warnTodayConflictAfterScheduling,
		],
	);

	return {
		user,
		setUser,
		activities,
		setActivities,
		loading,
		todayData,
		setTodayData,
		apiSubjects,
		subjects,
		conflicts,
		conflictsLoading,
		conflictCount,
		customSubjects,
		createOpen,
		setCreateOpen,
		prefilledSubject,
		setPrefilledSubject,
		pendingExpandSubject,
		setPendingExpandSubject,
		subjectModal,
		setSubjectModal,
		conflictsOpen,
		setConflictsOpen,
		capacityEditorOpen,
		setCapacityEditorOpen,
		dailyLimitDraft,
		setDailyLimitDraft,
		dailyLimitSaving,
		confirmDelete,
		setConfirmDelete,
		deleting,
		searchOpen,
		setSearchOpen,
		searchQuery,
		setSearchQuery,
		filtersOpen,
		setFiltersOpen,
		activeFilters,
		setActiveFilters,
		showWave,
		activeNav,
		todayDateKey,
		headerInfo,
		greeting,
		GreetingIcon,
		dateLoadMap,
		capacityUsed,
		capacityTotal,
		capacityPercent,
		capacityOverloaded,
		conflictDates,
		conflictModalItems,
		knownSubjects,
		capacityPopoverPosition,
		updateCapacityPopoverPosition,
		refreshConflicts,
		addCustomSubject,
		removeCustomSubject,
		renameCustomSubject,
		handleConflictDateResolve,
		handleConflictHoursResolve,
		handleCapacityLimitSaveAction,
		performDeleteActivity,
		toggleFilter,
		loadData,
		handleCreateActivity,
		warnTodayConflictAfterScheduling,
	};
}
