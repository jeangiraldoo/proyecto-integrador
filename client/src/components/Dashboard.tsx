import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
	CalendarCheck,
	CalendarClock,
	AlertTriangle,
	Plus,
	SlidersHorizontal,
	Search,
	ArrowRight,
	ChevronDown,
	Sunrise,
	CloudSun,
	MoonStar,
	SunDim,
	CloudMoon,
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
} from "lucide-react";
import lumaLogo from "../assets/luma.png";
import "./Dashboard.css";

/* ============ MOCK DATA ============ */
interface Subtask {
	id: number;
	name: string;
	done: boolean;
}

interface Activity {
	id: number;
	name: string;
	estimatedDuration: string;
	dueDate: string;
	subtaskCount: number;
	subtasks: Subtask[];
	status: "overdue" | "today" | "upcoming";
}

const MOCK_ACTIVITIES: Activity[] = [
	{
		id: 1,
		name: "Actividad No.1",
		estimatedDuration: "1H",
		dueDate: "17/09/2026",
		subtaskCount: 2,
		subtasks: [],
		status: "overdue",
	},
	{
		id: 2,
		name: "Actividad No.2",
		estimatedDuration: "1H",
		dueDate: "17/09/2026",
		subtaskCount: 3,
		subtasks: [],
		status: "overdue",
	},
	{
		id: 3,
		name: "Actividad No.3",
		estimatedDuration: "1H",
		dueDate: "17/09/2026",
		subtaskCount: 2,
		subtasks: [],
		status: "today",
	},
	{
		id: 4,
		name: "Actividad No.4",
		estimatedDuration: "1H",
		dueDate: "17/09/2026",
		subtaskCount: 3,
		subtasks: [],
		status: "today",
	},
	{
		id: 5,
		name: "Actividad No.5",
		estimatedDuration: "1H",
		dueDate: "17/09/2026",
		subtaskCount: 2,
		subtasks: [],
		status: "upcoming",
	},
	{
		id: 6,
		name: "Actividad No.6",
		estimatedDuration: "1H",
		dueDate: "17/09/2026",
		subtaskCount: 3,
		subtasks: [],
		status: "upcoming",
	},
];

/* ============ COMPONENT ============ */
interface DashboardProps {
	onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
	const [activeNav, setActiveNav] = useState("today");
	const [searchOpen, setSearchOpen] = useState(false);
	const [showWave, setShowWave] = useState(true);
	const [theme, setTheme] = useState<"dark" | "light">("dark");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [activeFilters, setActiveFilters] = useState<string[]>(["urgency"]);
	const filterRef = useRef<HTMLDivElement>(null);

	const { greeting, GreetingIcon } = useMemo(() => {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return { greeting: "Buenos días", GreetingIcon: Sunrise };
		if (hour >= 12 && hour < 19) return { greeting: "Buenas tardes", GreetingIcon: CloudSun };
		return { greeting: "Buenas noches", GreetingIcon: MoonStar };
	}, []);

	const searchInputRef = useRef<HTMLInputElement>(null);

	// Wave animation — only on first mount
	useEffect(() => {
		const timer = setTimeout(() => setShowWave(false), 2200);
		return () => clearTimeout(timer);
	}, []);

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

	const overdue = MOCK_ACTIVITIES.filter((a) => a.status === "overdue");
	const today = MOCK_ACTIVITIES.filter((a) => a.status === "today");
	const upcoming = MOCK_ACTIVITIES.filter((a) => a.status === "upcoming");

	const capacityUsed = 6;
	const capacityTotal = 12;
	const capacityPercent = (capacityUsed / capacityTotal) * 100;

	return (
		<div className={`dashboard ${theme}`}>
			{/* ======= SIDEBAR ======= */}
			<aside className="sidebar">
				{/* Theme toggle */}
				<div className="theme-toggle-wrap">
					<button
						className="theme-toggle"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
						aria-label="Cambiar tema"
					>
						<span className={`toggle-track ${theme}`}>
							<SunDim size={13} className="toggle-icon toggle-icon-sun" />
							<CloudMoon size={13} className="toggle-icon toggle-icon-moon" />
							<span className="toggle-thumb" />
						</span>
					</button>
				</div>

				{/* User profile */}
				<div className="sidebar-profile">
					<div className="profile-avatar">
						<div className="avatar-placeholder">
							<MoonStar size={24} />
						</div>
						<div className="avatar-status" />
					</div>
					<div className="profile-info">
						<span className="profile-name">Camila Cifuentes</span>
						<span className="profile-role">3er Semestre</span>
					</div>
					<button className="profile-menu-btn" aria-label="Menu">
						<MoreVertical size={18} />
					</button>
				</div>

				{/* Greeting */}
				<p className="sidebar-greeting">
					{showWave ? (
						<Hand size={22} className="wave-icon" />
					) : (
						<GreetingIcon size={20} className="greeting-icon" />
					)}
					{greeting}.
				</p>

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
				{/* Tip banner */}
				<div className="tip-banner">
					<Sparkles size={18} className="tip-icon" />
					<p>
						Ordenamos por urgencia y luego por las actividades más cortas para que avances rápido.
					</p>
				</div>

				{/* Header toolbar */}
				<div className="content-header">
					<div className="header-left">
						<h1 className="page-title">
							<CalendarCheck size={22} className="title-icon" />
							Actividades
						</h1>
						<button className="btn-add">
							<Plus size={16} />
							<span>Añadir actividad</span>
						</button>
					</div>
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
				<div className="activity-sections">
					{/* OVERDUE */}
					{overdue.length > 0 && (
						<ActivitySection
							title="Vencidas"
							icon={<AlertTriangle size={18} />}
							count={overdue.length}
							activities={overdue}
							variant="overdue"
						/>
					)}

					{/* TODAY */}
					{today.length > 0 && (
						<ActivitySection
							title="Para hoy"
							icon={<CalendarClock size={18} />}
							count={today.length}
							activities={today}
							variant="today"
						/>
					)}

					{/* UPCOMING */}
					{upcoming.length > 0 && (
						<ActivitySection
							title="Próximas"
							icon={<CalendarClock size={18} />}
							count={upcoming.length}
							activities={upcoming}
							variant="upcoming"
						/>
					)}
				</div>
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
	variant: "overdue" | "today" | "upcoming";
}

function ActivitySection({ title, icon, count, activities, variant }: ActivitySectionProps) {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<section className={`activity-section section-${variant}`}>
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
									<span className={`activity-tag tag-${variant}`}>{activity.name}</span>
								</div>
								<div className="col-duration">
									<span className="badge badge-duration">{activity.estimatedDuration}</span>
								</div>
								<div className="col-date">
									<span className={`badge badge-date badge-date-${variant}`}>
										{activity.dueDate}
									</span>
								</div>
								<div className="col-subtasks">
									<span className="badge badge-subtask">{activity.subtaskCount}</span>
								</div>
								<div className="col-action">
									<button className="btn-row-action" aria-label="Ver detalles">
										<ArrowRight size={18} />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
