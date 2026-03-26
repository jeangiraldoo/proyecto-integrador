import { useNavigate } from "react-router-dom";
import "./ComingSoon.css";

/* ── SVG icons (inline, zero deps) ── */
const IconWrench = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
	</svg>
);
const IconArrow = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M5 12h14M12 5l7 7-7 7" />
	</svg>
);
const IconStar = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
		<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
	</svg>
);
const IconLock = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</svg>
);
const IconSparkle = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 0L14.59 9.41 24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z" />
	</svg>
);

export default function ComingSoon() {
	const navigate = useNavigate();

	return (
		<div className="cs-scene" data-testid="coming-soon-page">
			{/* ── Atmospheric background ── */}
			<div className="cs-bg" aria-hidden="true">
				<div className="cs-orb cs-orb--purple" />
				<div className="cs-orb cs-orb--indigo" />
				<div className="cs-orb cs-orb--teal" />
				<div className="cs-grid" />
			</div>

			{/* ── Floating particles ── */}
			<div className="cs-particles" aria-hidden="true">
				{[...Array(18)].map((_, i) => (
					<span
						key={i}
						className={`cs-particle cs-particle--${i % 3 === 0 ? "a" : i % 3 === 1 ? "b" : "c"}`}
						style={{ "--i": i } as React.CSSProperties}
					/>
				))}
			</div>

			{/* ── Center content ── */}
			<main className="cs-content" data-testid="coming-soon-content">
				{/* Badge */}
				<div className="cs-badge">
					<span className="cs-badge__dot" />
					<IconWrench />
					<span>En construcción</span>
				</div>

				{/* Headline */}
				<h1 className="cs-title">
					Landing Page
					<br />
					<span className="cs-title__accent">Llegará pronto</span>
				</h1>

				{/* Subtitle */}
				<p className="cs-subtitle">
					Estamos construyendo una experiencia increíble para ti.
					<br className="cs-subtitle__br" />
					La plataforma estará lista muy pronto.
				</p>

				{/* ── Divider ── */}
				<div className="cs-divider" aria-hidden="true">
					<span className="cs-divider__line" />
					<span className="cs-divider__icon">
						<IconSparkle />
					</span>
					<span className="cs-divider__line" />
				</div>

				{/* ── CTA section ── */}
				<div className="cs-cta">
					<p className="cs-cta__hint">
						<IconLock />
						¿Ya tienes una cuenta?
					</p>
					<h2 className="cs-cta__heading">
						Accede
						<span className="cs-cta__heading-accent"> ahora mismo</span>
					</h2>
					<p className="cs-cta__desc">
						Tu dashboard y actividades y tu progreso te están esperando. Inicia sesión para
						continuar.
					</p>
					<button
						id="cs-login-btn"
						className="cs-btn"
						onClick={() => navigate("/login")}
						data-testid="coming-soon-login-btn"
					>
						<span className="cs-btn__text">Iniciar sesión</span>
						<span className="cs-btn__icon">
							<IconArrow />
						</span>
						<span className="cs-btn__shine" aria-hidden="true" />
					</button>
					<p className="cs-cta__note">
						<IconStar />
						Tu progreso siempre guardado y sincronizado
					</p>
				</div>
			</main>

			{/* ── Corner decorative pills ── */}
			<div className="cs-pill cs-pill--tl" aria-hidden="true">
				<span className="cs-pill__dot cs-pill__dot--green" />
				Sistemas activos
			</div>
			<div className="cs-pill cs-pill--br" aria-hidden="true">
				<span className="cs-pill__dot cs-pill__dot--yellow" />
				Lanzamiento próximo
			</div>
		</div>
	);
}
