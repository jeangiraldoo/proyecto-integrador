import { BarChart3 } from "lucide-react";

export default function Progreso() {
	return (
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
	);
}
