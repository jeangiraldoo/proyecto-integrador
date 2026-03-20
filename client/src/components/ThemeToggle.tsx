import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import "./ThemeToggle.css";

interface ThemeToggleProps {
	className?: string;
	qaId?: string;
}

export default function ThemeToggle({
	className = "",
	qaId = "theme-toggle-btn",
}: ThemeToggleProps) {
	const { isDark, toggle } = useTheme();

	return (
		<button
			className={`tt ${isDark ? "tt--dark" : "tt--light"} ${className}`}
			onClick={toggle}
			aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
			title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
			data-testid={qaId}
		>
			<span className="tt__track" aria-hidden="true">
				{/* Stars — visible in dark mode */}
				<span className="tt__stars">
					<span className="tt__star" />
					<span className="tt__star" />
					<span className="tt__star" />
				</span>
				{/* Clouds — visible in light mode */}
				<span className="tt__clouds">
					<span className="tt__cloud" />
					<span className="tt__cloud" />
				</span>
			</span>
			<span className="tt__thumb" data-testid={`${qaId}--thumb`}>
				<span className="tt__icon tt__icon--moon" data-testid={`${qaId}--moon-icon`}>
					<Moon size={11} strokeWidth={2.5} />
				</span>
				<span className="tt__icon tt__icon--sun" data-testid={`${qaId}--sun-icon`}>
					<Sun size={12} strokeWidth={2} />
				</span>
			</span>
		</button>
	);
}
