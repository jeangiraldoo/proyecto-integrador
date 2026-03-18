import {
	Sparkles,
	BookOpen,
	Plus,
	SlidersHorizontal,
	X,
	ArrowUpDown,
	Tag,
	Clock,
	CalendarCheck,
	AlertTriangle,
	Search,
} from "lucide-react";
import CreateActivityModal from "@/components/modals/CreateActivityModal";
import { type NewActivityPayloadFromModal } from "@/pages/Dashboard/dashboardUtils";

interface LayoutHeaderProps {
	headerInfo: {
		title: string;
		tipText: string;
		TitleIcon: any;
	};
	activeNav: string;
	setSubjectModal: (modal: { mode: "add" | "rename"; current?: string } | null) => void;
	setPrefilledSubject: (subject: string) => void;
	setCreateOpen: (open: boolean) => void;
	createOpen: boolean;
	knownSubjects: string[];
	dateLoadMap: Record<string, number>;
	conflictDates: string[];
	capacityTotal: number;
	handleCreateActivity: (payload: NewActivityPayloadFromModal) => Promise<void>;
	filterRef: React.RefObject<HTMLDivElement | null>;
	filtersOpen: boolean;
	setFiltersOpen: (open: boolean) => void;
	activeFilters: string[];
	toggleFilter: (id: string) => void;
	setActiveFilters: (filters: string[]) => void;
	searchOpen: boolean;
	setSearchOpen: (open: boolean) => void;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
}

export default function LayoutHeader({
	headerInfo,
	activeNav,
	setSubjectModal,
	setPrefilledSubject,
	setCreateOpen,
	createOpen,
	knownSubjects,
	dateLoadMap,
	conflictDates,
	capacityTotal,
	handleCreateActivity,
	filterRef,
	filtersOpen,
	setFiltersOpen,
	activeFilters,
	toggleFilter,
	setActiveFilters,
	searchOpen,
	setSearchOpen,
	searchInputRef,
	searchQuery,
	setSearchQuery,
}: LayoutHeaderProps) {
	return (
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

				<CreateActivityModal
					open={createOpen}
					onClose={() => setCreateOpen(false)}
					initialSubject={""}
					knownSubjects={knownSubjects}
					dateLoadMap={dateLoadMap}
					conflictDates={conflictDates}
					maxDailyHours={capacityTotal}
					onCreate={handleCreateActivity}
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
		</>
	);
}
