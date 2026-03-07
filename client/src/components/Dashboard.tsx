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
	ArrowUpDown,
	Loader2,
	Trash2,
	Folder,
	BookOpen,
} from "lucide-react";
import lumaLogo from "../assets/luma.png";
import {
	fetchMe,
	fetchActivities,
	fetchTodayView,
	createActivity,
	deleteActivity,
	fetchSubjects,
	createSubject,
	updateSubject,
	deleteSubject,
	type User,
	type Activity,
	type Subtask,
	type Subject,
} from "../api/dashboard";
import { toast } from "sonner";
import "./Dashboard.css";
import CreateActivityModal from "./CreateActivityModal";
import { classifyActivity, type NewActivityPayloadFromModal } from "./dashboardUtils";
import OrganizationView from "./OrganizationView";
import TodayKanban from "./TodayView";
import { SubjectFormModal } from "./OrganizationView";

/* ============ COMPONENT ============ */
interface DashboardProps {
	onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
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
			return !!localStorage.getItem("access_token");
		} catch {
			return false;
		}
	});
	const [todayData, setTodayData] = useState<{
		overdue: Subtask[];
		today: Subtask[];
		upcoming: Subtask[];
	} | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [prefilledSubject, setPrefilledSubject] = useState("");
	const [pendingExpandSubject, setPendingExpandSubject] = useState<string | null>(null);
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
						"Tus subtareas más urgentes, ordenadas para que puedas avanzar rápido. Marca cada una al terminar.",
				};
		}
	}, [activeNav]);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

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
	}, []);

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

	const toggleFilter = useCallback((id: string) => {
		setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
	}, []);

	const today = useMemo(
		() => (activities || []).filter((a) => classifyActivity(a.due_date) === "today"),
		[activities],
	);

	const capacityUsed = useMemo(
		() => today.reduce((sum, a) => sum + a.total_estimated_hours, 0),
		[today],
	);

	const knownSubjects = useMemo(
		() => [...new Set(activities.map((a) => a.course_name).filter(Boolean))].sort(),
		[activities],
	);
	const capacityTotal = user?.max_daily_hours ?? 0;
	const capacityPercent =
		capacityTotal > 0 ? Math.min((capacityUsed / capacityTotal) * 100, 100) : 0;

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
		<div className="dashboard">
			{/* Confirm delete modal */}
			{confirmDelete &&
				createPortal(
					<>
						<div
							onClick={() => setConfirmDelete(null)}
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
								style={{
									position: "relative",
									background: "linear-gradient(155deg,#1a0e0e 0%,#110909 55%,#090404 100%)",
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
									style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 700, color: "#f1f5f9" }}
								>
									Confirmar eliminación
								</p>
								<p
									style={{
										margin: "0 0 24px",
										fontSize: "13px",
										color: "#94a3b8",
										lineHeight: 1.6,
									}}
								>
									Se eliminará permanentemente{" "}
									<strong style={{ color: "#e2e8f0" }}>"{confirmDelete.title}"</strong>. Esta acción
									no se puede deshacer.
								</p>
								<div style={{ display: "flex", gap: "10px" }}>
									<button
										onClick={() => performDeleteActivity(confirmDelete.id)}
										disabled={deleting}
										className="modal-btn-danger"
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
										style={{
											flex: 1,
											padding: "11px 14px",
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
						</div>
					</>,
					document.body,
				)}
			{/* ======= SIDEBAR ======= */}
			<aside className="sidebar">
				{/* User profile */}
				<div className="sidebar-profile">
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
							<button className="profile-menu-btn" aria-label="Menu">
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
				<nav className="sidebar-nav">
					<button
						className={`nav-item ${activeNav === "today" ? "active" : ""}`}
						onClick={() => navigate("/hoy")}
					>
						<CalendarCheck size={18} />
						<span>Hoy</span>
					</button>
					<button
						className={`nav-item ${activeNav === "progress" ? "active" : ""}`}
						onClick={() => navigate("/progreso")}
					>
						<BarChart3 size={18} />
						<span>Mi progreso</span>
					</button>
					<button
						className={`nav-item ${activeNav === "org" ? "active" : ""}`}
						onClick={() => navigate("/organizacion")}
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
						<span className="capacity-numbers">
							<span className="capacity-used">{capacityUsed}h</span>
							<span className="capacity-sep">/</span>
							<span className="capacity-total">{capacityTotal}h</span>
						</span>
					</div>
					<div className="capacity-bar">
						<div className="capacity-fill" style={{ width: `${capacityPercent}%` }} />
					</div>
				</div>

				{/* Logout */}
				<button className="logout-btn" onClick={onLogout}>
					<LogOut size={16} />
					<span>Cerrar sesión</span>
				</button>

				{/* Branding */}
				<div className="sidebar-brand">
					<img src={lumaLogo} alt="Luma" className="sidebar-logo" />
				</div>
			</aside>

			{/* ======= MAIN CONTENT ======= */}
			<main className="main-content">
				{loading ? (
					<div className="loading-state">
						<Loader2 size={32} className="spinner" />
						<p>Cargando actividades...</p>
					</div>
				) : (
					<>
						{/* Tip banner */}
						<div className="tip-banner fade-in" style={{ animationDelay: "0.05s" }}>
							<Sparkles size={18} className="tip-icon" />
							<p>{headerInfo.tipText}</p>
						</div>

						{/* Header toolbar */}
						<div className="content-header fade-in" style={{ animationDelay: "0.12s" }}>
							<div className="header-left">
								<h1 className="page-title">
									<headerInfo.TitleIcon size={22} className="title-icon" />
									{headerInfo.title}
								</h1>
								{activeNav === "org" && (
									<>
										<button
											className="btn-add"
											style={{ background: "#334155", border: "1px solid #475569" }}
											onClick={() => setSubjectModal({ mode: "add" })}
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
											if (subjectName) setPendingExpandSubject(subjectName);
										}
										setCreateOpen(false);
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
								>
									<button
										className={`btn-filter ${filtersOpen ? "active" : ""}`}
										onClick={() => setFiltersOpen(!filtersOpen)}
									>
										<SlidersHorizontal size={15} />
										<span>Filtros</span>
										{activeFilters.length > 0 && (
											<span className="filter-badge">{activeFilters.length}</span>
										)}
									</button>

									{/* Filter panel */}
									<div className={`filter-panel ${filtersOpen ? "open" : ""}`}>
										<div className="filter-panel-header">
											<span>{activeNav === "org" ? "Ordenar materias" : "Filtrar por"}</span>
											<button className="filter-close" onClick={() => setFiltersOpen(false)}>
												<X size={14} />
											</button>
										</div>

										<div className="filter-options">
											{activeNav === "org" ? (
												<>
													<button
														className={`filter-chip ${activeFilters.includes("org-az") ? "on" : ""}`}
														onClick={() => toggleFilter("org-az")}
													>
														<ArrowUpDown size={13} />A → Z
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("org-za") ? "on" : ""}`}
														onClick={() => toggleFilter("org-za")}
													>
														<ArrowUpDown size={13} />Z → A
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("org-count") ? "on" : ""}`}
														onClick={() => toggleFilter("org-count")}
													>
														<Tag size={13} />
														Más actividades
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("org-hours") ? "on" : ""}`}
														onClick={() => toggleFilter("org-hours")}
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
													>
														<AlertTriangle size={13} />
														Urgencia
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("duration") ? "on" : ""}`}
														onClick={() => toggleFilter("duration")}
													>
														<Clock size={13} />
														Duración
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("date") ? "on" : ""}`}
														onClick={() => toggleFilter("date")}
													>
														<CalendarCheck size={13} />
														Fecha límite
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("category") ? "on" : ""}`}
														onClick={() => toggleFilter("category")}
													>
														<Tag size={13} />
														Categoría
													</button>
													<button
														className={`filter-chip ${activeFilters.includes("alphabetical") ? "on" : ""}`}
														onClick={() => toggleFilter("alphabetical")}
													>
														<ArrowUpDown size={13} />
														Alfabético
													</button>
												</>
											)}
										</div>
										{activeFilters.length > 0 && (
											<button className="filter-clear" onClick={() => setActiveFilters([])}>
												Limpiar filtros
											</button>
										)}
									</div>
								</div>

								<div className={`search-wrapper ${searchOpen ? "open" : ""}`}>
									<button className="btn-search" onClick={() => setSearchOpen(!searchOpen)}>
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
