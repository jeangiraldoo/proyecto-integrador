import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
	CalendarCheck,
	CalendarClock,
	AlertTriangle,
	Plus,
	SlidersHorizontal,
	Search,
	ChevronDown,
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
	Inbox,
	Trash2,
	Layers, // Icono para las subtareas
} from "lucide-react";
import lumaLogo from "../assets/luma.png";
import {
	fetchMe,
	fetchActivities,
	createActivity,
	deleteActivity,
	type User,
	type Activity,
} from "../api/dashboard";
import { toast } from "sonner";
import "./Dashboard.css";
import CreateActivityModal from "./CreateActivityModal";
import SubtaskManagerModal from "./SubtaskManagerModal";

// Local type matching the modal's payload (keeps Dashboard free of `any` casts)
type NewActivityPayloadFromModal = {
	subject: string;
	title: string;
	description?: string;
	due_date: string;
	total_estimated_hours?: number;
	subtasks: { title: string; target_date: string; estimated_hours: number | string }[];
};

/* ============ MOCK DATA (fallback) ============ */
const MOCK_USER: User = {
	id: 1,
	username: "juanr",
	email: "juanr@luma.com",
	name: "Juan Rodríguez",
	max_daily_hours: 8,
	date_joined: new Date().toISOString(),
};

const MOCK_ACTIVITIES: Activity[] = [
	{
		id: 1,
		user: 1,
		title: "Revisión de diseño",
		course_name: "Diseño",
		description: "Revisar pantallas Figma y comentarios",
		due_date: "2026-02-25",
		status: "pending",
		subtask_count: 3,
		total_estimated_hours: 2,
	},
	{
		id: 2,
		user: 1,
		title: "Implementar autenticación",
		course_name: "Backend",
		description: "Agregar login con JWT y refresco de token",
		due_date: "2026-02-27",
		status: "in_progress",
		subtask_count: 5,
		total_estimated_hours: 4,
	},
	{
		id: 3,
		user: 1,
		title: "Testing E2E",
		course_name: "QA",
		description: "Escribir pruebas Cypress para flujo de login",
		due_date: "2026-02-27",
		status: "pending",
		subtask_count: 2,
		total_estimated_hours: 1,
	},
	{
		id: 4,
		user: 1,
		title: "Deploy a staging",
		course_name: "DevOps",
		description: "Actualizar imagen Docker y desplegar a staging",
		due_date: "2026-03-02",
		status: "pending",
		subtask_count: 1,
		total_estimated_hours: 2,
	},
	{
		id: 5,
		user: 1,
		title: "Documentación API",
		course_name: "Docs",
		description: "Añadir ejemplos de endpoints y respuestas",
		due_date: "2026-03-05",
		status: "pending",
		subtask_count: 4,
		total_estimated_hours: 3,
	},
];

/* ============ HELPERS ============ */
function formatDate(iso: string): string {
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}

function formatHours(h?: number): string {
	if (h === undefined || h === null || Number.isNaN(h)) return "0H";
	return h === 1 ? "1H" : `${h}H`;
}

type SectionVariant = "overdue" | "today" | "upcoming";

function classifyActivity(dueDateIso: string): SectionVariant {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const due = new Date(dueDateIso + "T00:00:00");
	if (due < today) return "overdue";
	if (due.getTime() === today.getTime()) return "today";
	return "upcoming";
}

/* ============ COMPONENT ============ */
interface DashboardProps {
	onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
	const [activeNav, setActiveNav] = useState("today");
	const [searchOpen, setSearchOpen] = useState(false);
	const [showWave, setShowWave] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [activeFilters, setActiveFilters] = useState<string[]>(["urgency"]);
	const filterRef = useRef<HTMLDivElement>(null);

	/* ---- Mock data state (will be replaced with real API) ---- */
	const [user, setUser] = useState<User>(MOCK_USER);
	const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);
	const [loading, setLoading] = useState<boolean>(() => {
		try {
			if (typeof window === "undefined") return false;
			return !!localStorage.getItem("access_token");
		} catch {
			return false;
		}
	});
	const [createOpen, setCreateOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			// Avoid firing API requests if there's no access token available yet
			const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
			if (!token) {
				return;
			}
			try {
				const [me, acts] = await Promise.all([fetchMe(), fetchActivities()]);
				if (!cancelled) {
					setUser(me);
					setActivities(acts);
				}
			} catch (err) {
				console.warn("Using mock data — failed to fetch real data:", err);
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

	const overdue = useMemo(
		() => activities.filter((a) => classifyActivity(a.due_date) === "overdue"),
		[activities],
	);
	const today = useMemo(
		() => activities.filter((a) => classifyActivity(a.due_date) === "today"),
		[activities],
	);
	const upcoming = useMemo(
		() => activities.filter((a) => classifyActivity(a.due_date) === "upcoming"),
		[activities],
	);

	// Controls to programmatically open/scroll a section after creation
	const [openSection, setOpenSection] = useState<{ name: SectionVariant | null; key: number }>({
		name: null,
		key: 0,
	});

	const capacityUsed = useMemo(
		() => today.reduce((sum, a) => sum + a.total_estimated_hours, 0),
		[today],
	);
	const capacityTotal = user.max_daily_hours;
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
			{confirmDelete && (
				<div
					className="ca-backdrop"
					role="dialog"
					aria-modal="true"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) setConfirmDelete(null);
					}}
				>
					<div className="ca-modal ca-modal-compact">
						<div className="ca-header">
							<div className="ca-header-left">
								<div className="ca-header-icon">
									<AlertTriangle size={20} />
								</div>
								<div className="ca-header-text">
									<h3>Confirmar eliminación</h3>
									<p className="ca-subtitle">Vas a eliminar: {confirmDelete.title}</p>
								</div>
							</div>
							<button
								className="ca-close"
								onClick={() => setConfirmDelete(null)}
								aria-label="Cerrar"
							>
								<X size={15} />
							</button>
						</div>
						<div className="ca-body">
							<p>
								¿Estás seguro que deseas eliminar esta actividad? Esta acción no se puede deshacer.
							</p>
							<div className="ca-actions">
								<button
									className="btn btn-ghost"
									onClick={() => setConfirmDelete(null)}
									disabled={deleting}
								>
									Cancelar
								</button>
								<button
									className="btn btn-primary"
									onClick={() => performDeleteActivity(confirmDelete.id)}
									disabled={deleting}
								>
									{deleting ? "Eliminando..." : "Eliminar"}
								</button>
							</div>
						</div>
					</div>
				</div>
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
									{user.name ? (
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
								<span className="profile-name">{user.name || user.username}</span>
								<span className="profile-role">{user.email}</span>
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
						onClick={() => setActiveNav("today")}
					>
						<CalendarCheck size={18} />
						<span>Hoy</span>
					</button>
					<button
						className={`nav-item ${activeNav === "progress" ? "active" : ""}`}
						onClick={() => setActiveNav("progress")}
					>
						<BarChart3 size={18} />
						<span>Mi progreso</span>
					</button>
					<button
						className={`nav-item ${activeNav === "org" ? "active" : ""}`}
						onClick={() => setActiveNav("org")}
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
							<p>
								Ordenamos por urgencia y luego por las actividades más cortas para que avances
								rápido.
							</p>
						</div>

						{/* Header toolbar */}
						<div className="content-header fade-in" style={{ animationDelay: "0.12s" }}>
							<div className="header-left">
								<h1 className="page-title">
									<CalendarCheck size={22} className="title-icon" />
									Actividades
								</h1>
								<button className="btn-add" onClick={() => setCreateOpen(true)}>
									<Plus size={16} />
									<span>Añadir actividad</span>
								</button>
							</div>

							{/* Create activity modal (top-level) */}
							<CreateActivityModal
								open={createOpen}
								onClose={() => setCreateOpen(false)}
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
										};

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

										const section = classifyActivity(created.due_date);
										setOpenSection((prev) => ({ name: section, key: prev.key + 1 }));

										setCreateOpen(false);
										toast.success("Actividad creada");
									} catch (err) {
										console.error("Failed to create activity:", err);
										toast.error("Error creando la actividad. Intenta de nuevo.");
									}
								}}
							/>
							<div className="header-right">
								<div className="filter-wrapper" ref={filterRef}>
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
											<span>Filtrar por</span>
											<button className="filter-close" onClick={() => setFiltersOpen(false)}>
												<X size={14} />
											</button>
										</div>

										<div className="filter-options">
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
										/>
									</div>
								</div>
							</div>
						</div>

						{/* Activity sections */}
						<div className="activity-sections fade-in" style={{ animationDelay: "0.2s" }}>
							<ActivitySection
								title="Vencidas"
								icon={<AlertTriangle size={18} />}
								count={overdue.length}
								activities={overdue}
								variant="overdue"
								openTrigger={openSection.name === "overdue" ? openSection.key : undefined}
								onDelete={requestDeleteActivity}
							/>

							<ActivitySection
								title="Para hoy"
								icon={<CalendarClock size={18} />}
								count={today.length}
								activities={today}
								variant="today"
								openTrigger={openSection.name === "today" ? openSection.key : undefined}
								onDelete={requestDeleteActivity}
							/>

							<ActivitySection
								title="Próximas"
								icon={<CalendarClock size={18} />}
								count={upcoming.length}
								activities={upcoming}
								variant="upcoming"
								openTrigger={openSection.name === "upcoming" ? openSection.key : undefined}
								onDelete={requestDeleteActivity}
							/>
						</div>
					</>
				)}
			</main>
		</div>
	);
}

/* ============ SUB-COMPONENTS ============ */

interface ActivitySectionProps {
	title: string;
	icon: React.ReactNode;
	count: number;
	activities: Activity[];
	variant: SectionVariant;
	openTrigger?: number;
	onDelete?: (id: number) => void;
}

function ActivitySection({
	title,
	icon,
	count,
	activities,
	variant,
	openTrigger,
	onDelete,
}: ActivitySectionProps) {
	const [collapsed, setCollapsed] = useState(false);
	const sectionRef = useRef<HTMLElement | null>(null);
	const prevTrigger = useRef<number | undefined>(undefined);
	const isEmpty = activities.length === 0;

	// <--- 2. Estado local para controlar el modal de subtareas
	const [activeSubtaskManager, setActiveSubtaskManager] = useState<Activity | null>(null);

	useEffect(() => {
		if (openTrigger === undefined) return;
		if (prevTrigger.current === openTrigger) return;
		prevTrigger.current = openTrigger;

		let cancelled = false;
		Promise.resolve().then(() => {
			if (cancelled) return;
			setCollapsed(false);
			if (sectionRef.current) {
				sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		});

		return () => {
			cancelled = true;
		};
	}, [openTrigger]);

	return (
		<section
			ref={sectionRef}
			className={`activity-section section-${variant}`}
			id={`section-${variant}`}
		>
			<div className="section-header" onClick={() => setCollapsed(!collapsed)}>
				<div className="section-title-group">
					<ChevronDown size={16} className={`collapse-icon ${collapsed ? "collapsed" : ""}`} />
					<span className={`section-icon section-icon-${variant}`}>{icon}</span>
					<h2 className="section-title">{title}</h2>
				</div>
				<span className="section-count">{count} actividades</span>
			</div>

			<div className={`section-collapsible ${collapsed ? "collapsed" : ""}`}>
				<div className="section-collapsible-inner">
					{isEmpty ? (
						<div className="section-empty">
							<Inbox size={28} strokeWidth={1.5} />
							<p>Aún no hay nada por aquí</p>
						</div>
					) : (
						<>
							<div className="table-header">
								<span className="col-activity">Actividad</span>
								<span className="col-duration">Duración estimada</span>
								<span className="col-date">Fecha de finalización</span>
								<span className="col-subtasks"># de subtareas</span>
								<span className="col-action" />
							</div>
							<div className="table-body">
								{activities.map((activity) => (
									<div key={activity.id} className="table-row">
										<div className="col-activity">
											<span className={`activity-tag tag-${variant}`}>{activity.title}</span>
										</div>
										<div className="col-duration">
											<span className="badge badge-duration">
												{formatHours(activity.total_estimated_hours)}
											</span>
										</div>
										<div className="col-date">
											<span className={`badge badge-date badge-date-${variant}`}>
												{formatDate(activity.due_date)}
											</span>
										</div>
										<div className="col-subtasks">
											<span className="badge badge-subtask">{activity.subtask_count}</span>
										</div>
										<div className="col-action">
											{/* <--- 3. Botón para abrir el Modal de Subtareas */}
											<button
												className="btn-row-action"
												aria-label="Gestionar subtareas"
												onClick={() => setActiveSubtaskManager(activity)}
												title="Ver subtareas"
											>
												<Layers size={18} />
											</button>

											<button
												type="button"
												className="btn-row-action btn-row-delete"
												aria-label="Eliminar actividad"
												onClick={() => onDelete?.(activity.id)}
											>
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
						</>
					)}
				</div>
			</div>

			{/* <--- 4. Renderizado del Modal de Subtareas */}
			{activeSubtaskManager && (
				<SubtaskManagerModal
					activityId={activeSubtaskManager.id}
					activityTitle={activeSubtaskManager.title}
					open={true}
					onClose={() => setActiveSubtaskManager(null)}
				/>
			)}
		</section>
	);
}
