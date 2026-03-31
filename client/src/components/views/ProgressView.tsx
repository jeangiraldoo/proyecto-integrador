import { useMemo, useState } from "react";
import { type Activity } from "@/api/dashboard";
import { useTheme } from "@/hooks/useTheme";
import Pagination from "@/components/ui/Pagination";

interface ProgressViewProps {
	activities: Activity[];
}

export default function ProgressView({ activities }: ProgressViewProps) {
	const { isDark } = useTheme();
	const [page, setPage] = useState(1);
	const LIMIT = 10;

	const stats = useMemo(() => {
		let totalCompletedSubs = 0;
		let totalSubsAll = 0;
		let totallyCompletedActs = 0;

		for (const act of activities) {
			const actTotal = act.total_subtasks_count ?? act.subtask_count ?? 0;
			const actCompleted = act.completed_subtasks_count ?? 0;
			totalSubsAll += actTotal;
			totalCompletedSubs += actCompleted;
			
			// A an activity is completed if all subtasks are done, or if it explicitly says completed
			if (actTotal > 0 && actCompleted >= actTotal) {
				totallyCompletedActs += 1;
			} else if (act.status === "completed" && actTotal === 0) {
				totallyCompletedActs += 1;
			}
		}

		const percentSubs = totalSubsAll > 0 ? Math.round((totalCompletedSubs / totalSubsAll) * 100) : 0;
		return {
			totalCompletedSubs,
			totalSubsAll,
			totallyCompletedActs,
			totalActs: activities.length,
			percentSubs,
		};
	}, [activities]);

	// Theme colors
	const txtClr = isDark ? "#e2e8f0" : "#1e293b";
	const subClr = isDark ? "#94a3b8" : "#64748b";
	const cardBg = isDark ? "#1e293b" : "#ffffff";
	const cardBdr = isDark ? "#334155" : "#e2e8f0";
	const donutColor = isDark ? "#ffffff" : "#4b5563";
	const donutBg = isDark ? "#334155" : "#d1d5db";
	const barBg = isDark ? "#334155" : "#e2e8f0";

	return (
		<div
			className="fade-in"
			data-testid="dashboard-progress-view"
			style={{
				padding: "1rem 2rem",
				color: txtClr,
				maxWidth: "900px",
				margin: "0 auto",
				fontFamily: "Inter, sans-serif"
			}}
		>
			<h2 style={{ fontSize: "24px", fontWeight: 600, textAlign: "center", marginBottom: "2rem" }}>
				Tu progreso
			</h2>

			<div style={{ display: "flex", justifyContent: "center", marginBottom: "3rem" }}>
				{/* CSS Donut Chart */}
				<div
					style={{
						position: "relative",
						width: "180px",
						height: "180px",
						borderRadius: "50%",
						background: `conic-gradient(${donutColor} ${stats.percentSubs * 3.6}deg, ${donutBg} 0deg)`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						style={{
							width: "135px",
							height: "135px",
							backgroundColor: isDark ? "#0f172a" : "#f8fafc",
							borderRadius: "50%",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							textAlign: "center",
						}}
					>
						<span style={{ fontSize: "28px", fontWeight: 700 }}>{stats.percentSubs}%</span>
						<span style={{ fontSize: "11px", color: subClr, padding: "0 10px", lineHeight: 1.2 }}>
							de subtareas completadas
						</span>
					</div>
				</div>
			</div>

			<div
				style={{
					background: cardBg,
					border: `1px solid ${cardBdr}`,
					borderRadius: "12px",
					padding: "1.5rem 2rem",
					boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.05)",
				}}
			>
				{/* Top metrics */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: "2rem",
						paddingBottom: "1.5rem",
						borderBottom: `1px solid ${cardBdr}`,
						marginBottom: "1.5rem",
					}}
				>
					<div style={{ textAlign: "center" }}>
						<p style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 10px 0" }}>Actividades completadas</p>
						<div
							style={{
								height: "14px",
								background: barBg,
								margin: "0 auto 10px auto",
								width: "70%",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${stats.totalActs > 0 ? (stats.totallyCompletedActs / stats.totalActs) * 100 : 0}%`,
									background: donutColor,
									transition: "width 0.5s ease",
								}}
							/>
						</div>
						<p style={{ margin: 0, fontSize: "14px" }}>{stats.totallyCompletedActs} de {stats.totalActs}</p>
					</div>

					<div style={{ textAlign: "center" }}>
						<p style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 10px 0" }}>Subtareas completadas</p>
						<div
							style={{
								height: "14px",
								background: barBg,
								margin: "0 auto 10px auto",
								width: "70%",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${stats.totalSubsAll > 0 ? (stats.totalCompletedSubs / stats.totalSubsAll) * 100 : 0}%`,
									background: donutColor,
									transition: "width 0.5s ease",
								}}
							/>
						</div>
						<p style={{ margin: 0, fontSize: "14px" }}>{stats.totalCompletedSubs} de {stats.totalSubsAll}</p>
					</div>
				</div>

				<h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 1rem 0" }}>Mis actividades</h3>

				<div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
					{activities.length === 0 && (
						<p style={{ color: subClr, fontSize: "14px", textAlign: "center" }}>
							No hay actividades registradas.
						</p>
					)}
					{activities.slice((page - 1) * LIMIT, page * LIMIT).map((act) => {
						const totalSubs = act.total_subtasks_count ?? act.subtask_count ?? 0;
						const completedSubs = act.completed_subtasks_count ?? 0;
						const pct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
						
						return (
							<div
								key={act.id}
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 140px 180px 40px",
									alignItems: "center",
									gap: "1rem",
									paddingBottom: "1.2rem",
									borderBottom: `1px solid ${cardBdr}`,
								}}
							>
								<span style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
									{act.title}
								</span>
								<span style={{ fontSize: "12px", color: subClr }}>
									{completedSubs} subtareas de {totalSubs}
								</span>
								<div
									style={{
										height: "12px",
										background: barBg,
										borderRadius: "0",
										width: "100%",
									}}
								>
									<div
										style={{
											height: "100%",
											width: `${pct}%`,
											background: "#8b5cf6",
											transition: "width 0.4s ease-out",
										}}
									/>
								</div>
								<span style={{ fontSize: "12px", textAlign: "right", fontWeight: 500 }}>{pct}%</span>
							</div>
						);
					})}
				</div>

				{activities.length > LIMIT && (
					<Pagination
						currentPage={page}
						totalPages={Math.ceil(activities.length / LIMIT)}
						onPageChange={setPage}
					/>
				)}
			</div>
		</div>
	);
}
