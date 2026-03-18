import { useRef, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { fetchActivities, type Activity } from "@/api/dashboard";
import "@/pages/Dashboard/Dashboard.css";

// Hooks
import { useLayout } from "./hooks/useLayout";

// Subcomponents
import LayoutSidebar from "./subcomponents/LayoutSidebar";
import LayoutHeader from "./subcomponents/LayoutHeader";
import LayoutModals from "./subcomponents/LayoutModals";

export interface LayoutProps {
	onLogout: () => void;
}

export type LayoutContextType = {
	todayProps: any;
	orgProps: any;
};

export default function Layout({ onLogout }: LayoutProps) {
	const { isDark } = useTheme();
	const layout = useLayout();

	const filterRef = useRef<HTMLDivElement>(null);
	const capacityEditorButtonRef = useRef<HTMLButtonElement>(null);
	const capacityPopoverRef = useRef<HTMLDivElement>(null);
	const dailyLimitInputRef = useRef<HTMLInputElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Close filter panel on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
				layout.setFiltersOpen(false);
			}
		}
		if (layout.filtersOpen) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [layout.filtersOpen, layout]);

	useEffect(() => {
		if (!layout.capacityEditorOpen) return;

		function handleOutsideClick(event: MouseEvent) {
			const target = event.target as Node;
			if (capacityPopoverRef.current?.contains(target)) return;
			if (capacityEditorButtonRef.current?.contains(target)) return;
			layout.setCapacityEditorOpen(false);
		}

		function handleEscape(event: KeyboardEvent) {
			if (event.key === "Escape" && !layout.dailyLimitSaving) {
				layout.setCapacityEditorOpen(false);
			}
		}

		function handleViewportChange() {
			layout.updateCapacityPopoverPosition(capacityEditorButtonRef.current);
		}

		layout.updateCapacityPopoverPosition(capacityEditorButtonRef.current);
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
	}, [layout]);

	useEffect(() => {
		if (!layout.capacityEditorOpen) return;
		const frame = window.requestAnimationFrame(() => {
			layout.updateCapacityPopoverPosition(capacityEditorButtonRef.current);
			dailyLimitInputRef.current?.focus();
			dailyLimitInputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [layout]);

	return (
		<div className="dashboard">
			<LayoutModals
				isDark={isDark}
				confirmDelete={layout.confirmDelete}
				setConfirmDelete={layout.setConfirmDelete}
				performDeleteActivity={layout.performDeleteActivity}
				deleting={layout.deleting}
				capacityEditorOpen={layout.capacityEditorOpen}
				capacityPopoverRef={capacityPopoverRef}
				capacityPopoverPosition={layout.capacityPopoverPosition}
				dailyLimitDraft={layout.dailyLimitDraft}
				setDailyLimitDraft={layout.setDailyLimitDraft}
				dailyLimitSaving={layout.dailyLimitSaving}
				dailyLimitInputRef={dailyLimitInputRef}
				handleCapacityLimitSave={layout.handleCapacityLimitSaveAction}
				closeCapacityEditor={() => layout.setCapacityEditorOpen(false)}
				conflictsOpen={layout.conflictsOpen}
				conflictModalItems={layout.conflictModalItems}
				dateLoadMap={layout.dateLoadMap}
				maxDailyHours={layout.capacityTotal}
				setConflictsOpen={layout.setConflictsOpen}
				handleConflictDateResolve={layout.handleConflictDateResolve}
				handleConflictHoursResolve={layout.handleConflictHoursResolve}
				subjectModal={layout.subjectModal}
				setSubjectModal={layout.setSubjectModal}
				addCustomSubject={layout.addCustomSubject}
			/>

			<LayoutSidebar
				loading={layout.loading}
				user={layout.user}
				showWave={layout.showWave}
				greeting={layout.greeting}
				GreetingIcon={layout.GreetingIcon}
				activeNav={layout.activeNav}
				capacityUsed={layout.capacityUsed}
				capacityTotal={layout.capacityTotal}
				capacityPercent={layout.capacityPercent}
				capacityOverloaded={layout.capacityOverloaded}
				sidebarCapacityLoading={layout.loading || !layout.user}
				capacityEditorOpen={layout.capacityEditorOpen}
				toggleCapacityEditor={() => {
					if (!layout.user || layout.dailyLimitSaving) return;
					layout.setCapacityEditorOpen((prev) => {
						if (!prev) layout.setDailyLimitDraft(String(layout.user!.max_daily_hours));
						return !prev;
					});
				}}
				capacityEditorButtonRef={capacityEditorButtonRef}
				sidebarConflictsLoading={layout.loading || layout.conflictsLoading}
				conflictCount={layout.conflictCount}
				onLogout={onLogout}
				refreshConflicts={layout.refreshConflicts}
				setConflictsOpen={layout.setConflictsOpen}
			/>

			<main className="main-content">
				{layout.loading ? (
					<div className="loading-state">
						<Loader2 size={32} className="spinner" />
						<p>Cargando actividades...</p>
					</div>
				) : (
					<>
						<LayoutHeader
							headerInfo={layout.headerInfo}
							activeNav={layout.activeNav}
							setSubjectModal={layout.setSubjectModal}
							setPrefilledSubject={layout.setPrefilledSubject}
							setCreateOpen={layout.setCreateOpen}
							createOpen={layout.createOpen}
							knownSubjects={layout.knownSubjects}
							dateLoadMap={layout.dateLoadMap}
							conflictDates={layout.conflictDates}
							capacityTotal={layout.capacityTotal}
							handleCreateActivity={layout.handleCreateActivity}
							filterRef={filterRef}
							filtersOpen={layout.filtersOpen}
							setFiltersOpen={layout.setFiltersOpen}
							activeFilters={layout.activeFilters}
							toggleFilter={layout.toggleFilter}
							setActiveFilters={layout.setActiveFilters}
							searchOpen={layout.searchOpen}
							setSearchOpen={layout.setSearchOpen}
							searchInputRef={searchInputRef}
							searchQuery={layout.searchQuery}
							setSearchQuery={layout.setSearchQuery}
						/>

						<Outlet
							context={{
								todayProps: {
									initialData: layout.todayData,
									onDataRefresh: layout.setTodayData,
									activities: layout.activities,
									maxDailyHours: layout.capacityTotal,
									conflictDates: layout.conflictDates,
									onConflict: () => layout.refreshConflicts(),
									onSubtaskMutated: () => {
										void layout.refreshConflicts();
										void fetchActivities().then((acts) =>
											layout.setActivities(Array.isArray(acts) ? acts : []),
										);
									},
									searchQuery: layout.searchQuery,
								},
								orgProps: {
									activities: layout.activities,
									subjects: layout.subjects,
									onDelete: (id: number, title?: string) =>
										layout.setConfirmDelete({ id, title: title ?? "(sin título)" }),
									onAddSubject: layout.addCustomSubject,
									onRemoveSubject: layout.removeCustomSubject,
									onRenameSubject: layout.renameCustomSubject,
									onActivityUpdate: (updated: Activity) =>
										layout.setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a))),
									onSubtaskMutated: () => {
										void layout.refreshConflicts();
										void fetchActivities().then((acts) =>
											layout.setActivities(Array.isArray(acts) ? acts : []),
										);
									},
									dateLoadMap: layout.dateLoadMap,
									conflictDates: layout.conflictDates,
									maxDailyHours: layout.capacityTotal,
									onActivitySaved: (updated: Activity) => {
										const dueInToday = updated.due_date === layout.todayDateKey;
										if (!dueInToday) return;
										const currentTodayHours = layout.dateLoadMap[layout.todayDateKey] ?? 0;
										const hasTodayConflict =
											layout.conflicts.some((c) => c.affected_date === layout.todayDateKey) ||
											(layout.capacityTotal > 0 && currentTodayHours > layout.capacityTotal);
										if (hasTodayConflict) layout.warnTodayConflictAfterScheduling("editar");
									},
									activeFilters: layout.activeFilters,
									searchQuery: layout.searchQuery,
									expandSubject: layout.pendingExpandSubject,
									onOpenCreate: (subject?: string) => {
										layout.setPrefilledSubject(subject ?? "");
										layout.setCreateOpen(true);
									},
								},
							}}
						/>
					</>
				)}
			</main>
		</div>
	);
}
