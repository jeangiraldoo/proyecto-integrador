import {
	User2,
	MoreVertical,
	Hand,
	CalendarCheck,
	BarChart3,
	Users,
	Loader2,
	AlertTriangle,
	LogOut,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import lumaLogo from "@/assets/luma.png";
import { type User, type Conflict } from "@/api/dashboard";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LayoutSidebarProps {
	loading: boolean;
	user: User | null;
	showWave: boolean;
	greeting: string;
	GreetingIcon: any;
	activeNav: string;
	capacityUsed: number;
	capacityTotal: number;
	capacityPercent: number;
	capacityOverloaded: boolean;
	sidebarCapacityLoading: boolean;
	capacityEditorOpen: boolean;
	toggleCapacityEditor: () => void;
	capacityEditorButtonRef: React.RefObject<HTMLButtonElement | null>;
	sidebarConflictsLoading: boolean;
	conflictCount: number;
	onLogout: () => void;
	refreshConflicts: () => Promise<Conflict[]>;
	setConflictsOpen: (open: boolean) => void;
}

export default function LayoutSidebar({
	loading,
	user,
	showWave,
	greeting,
	GreetingIcon,
	activeNav,
	capacityUsed,
	capacityTotal,
	capacityPercent,
	capacityOverloaded,
	sidebarCapacityLoading,
	capacityEditorOpen,
	toggleCapacityEditor,
	capacityEditorButtonRef,
	sidebarConflictsLoading,
	conflictCount,
	onLogout,
	refreshConflicts,
	setConflictsOpen,
}: LayoutSidebarProps) {
	const navigate = useNavigate();

	return (
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
				>
					{sidebarCapacityLoading ? "Cargando capacidad..." : "Editar limite diario"}
				</button>
			</div>

			<button
				className="sidebar-conflicts-btn"
				disabled={sidebarConflictsLoading}
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
				>
					{sidebarConflictsLoading ? <Loader2 size={12} className="spinner" /> : conflictCount}
				</span>
			</button>

			{/* Logout */}
			<button className="logout-btn" onClick={onLogout}>
				<LogOut size={16} />
				<span>Cerrar sesión</span>
			</button>

			{/* Branding */}
			<div className="sidebar-brand">
				<img src={lumaLogo} alt="Luma" className="sidebar-logo" />
				<ThemeToggle className="sidebar-brand-toggle" />
			</div>
		</aside>
	);
}
