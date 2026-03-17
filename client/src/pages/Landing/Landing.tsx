import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, TrendingUp } from "lucide-react";
import "./Landing.css";
import "@/pages/LoginPage/Login.css";
import lumaLogoFull from "@/assets/luma.png";
import heroIllustration from "@/assets/login.png";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function Landing() {
	return (
		<div className="lp-scene">
			{/* ── Theme toggle ── */}
			<div className="lp-theme-toggle-btn">
				<ThemeToggle />
			</div>

			{/* ── Background ── */}
			<div className="lp-bg" aria-hidden="true">
				<div className="lp-orb lp-orb--purple" />
				<div className="lp-orb lp-orb--indigo" />
				<div className="lp-orb lp-orb--violet" />
				<div className="lp-orb lp-orb--pink" />
				<div className="lp-stars" />
				<div className="lp-ring lp-ring--1" />
				<div className="lp-ring lp-ring--2" />
				<img src={heroIllustration} className="lp-bg__illustration" alt="" draggable={false} />
				<div className="lp-bg__vignette" />
			</div>

			{/* ── Pills ── */}
			<div className="lp-pill lp-pill--tr" aria-hidden="true">
				<span className="lp-pill__dot" />
				Actividades organizadas
			</div>
			<div className="lp-pill lp-pill--br" aria-hidden="true">
				<span className="lp-pill__dot lp-pill__dot--green" />
				Progreso en tiempo real
			</div>
			<div className="lp-pill lp-pill--tl" aria-hidden="true">
				<span className="lp-pill__dot lp-pill__dot--blue" />
				Planificación inteligente
			</div>
			<div className="lp-pill lp-pill--bl" aria-hidden="true">
				<span className="lp-pill__dot lp-pill__dot--yellow" />
				Metas alcanzadas
			</div>

			{/* ── Feature cards ── */}
			<div className="lp-feat-card lp-feat-card--left" aria-hidden="true">
				<div className="lp-feat-card__icon">
					<CalendarDays size={18} strokeWidth={1.5} />
				</div>
				<div className="lp-feat-card__body">
					<strong>Organiza tu semana</strong>
					<span>Actividades con fechas y prioridades</span>
				</div>
			</div>
			<div className="lp-feat-card lp-feat-card--right" aria-hidden="true">
				<div className="lp-feat-card__icon lp-feat-card__icon--alt">
					<TrendingUp size={18} strokeWidth={1.5} />
				</div>
				<div className="lp-feat-card__body">
					<strong>Avanza con claridad</strong>
					<span>Seguimiento en tiempo real</span>
				</div>
			</div>

			{/* ── Hero ── */}
			<div className="landing-hero">
				<div className="landing-hero__shine" />
				<img src={lumaLogoFull} alt="Luma" className="lp-card__logo landing-hero__logo" />

				<h1 className="landing-hero__title">
					Organiza tu vida
					<br />
					académica
				</h1>
				<p className="landing-hero__subtitle">
					Planifica actividades, controla tus metas
					<br />y avanza con claridad.
				</p>

				<div className="landing-hero__actions">
					<Link to="/registro" className="lp-btn landing-btn landing-btn--primary">
						<span>Crear cuenta gratis</span>
						<ArrowRight size={15} aria-hidden="true" />
					</Link>
					<Link to="/login" className="landing-btn landing-btn--outline">
						Iniciar sesión
					</Link>
				</div>
			</div>
		</div>
	);
}
