import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
	User,
	Lock,
	Loader2,
	ArrowRight,
	Eye,
	EyeOff,
	Sun,
	CloudSun,
	Moon,
	CalendarDays,
	TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import client from "../api/client";
import { setAuthTokens } from "../api/auth";
import "./Login.css";
import lumaLogoFull from "../assets/luma.png";
import heroIllustration from "../assets/login.png";
import ThemeToggle from "./ThemeToggle";

interface LoginProps {
	onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [cardState, setCardState] = useState<"idle" | "success" | "error">("idle");

	const greeting = useMemo(() => {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return { text: "Buenos días", Icon: Sun };
		if (hour >= 12 && hour < 19) return { text: "Buenas tardes", Icon: CloudSun };
		return { text: "Buenas noches", Icon: Moon };
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!username.trim() || !password.trim()) {
			toast.error("Por favor, completa todos los campos para continuar.");
			return;
		}

		setIsLoading(true);
		try {
			const response = await client.post("/api/token/", { username, password });
			const { access, refresh } = response.data as { access: string; refresh: string };

			setAuthTokens(access, refresh);
			client.defaults.headers.common["Authorization"] = `Bearer ${access}`;

			setCardState("success");
			setIsLoading(false);
			toast.success("Bienvenido de nuevo.");
			setTimeout(() => onLoginSuccess(access), 700);
		} catch (error: unknown) {
			const status =
				typeof error === "object" && error !== null && "response" in error
					? (error as { response?: { status?: number } }).response?.status
					: undefined;

			if (status === 401) {
				toast.error("Usuario o contraseña incorrectos.");
			} else {
				toast.error("Error de conexión. Intenta más tarde.");
			}
			setCardState("error");
			setIsLoading(false);
		}
	};

	const { Icon: GreetingIcon } = greeting;

	return (
		<div className="lp-scene">
			{/* ── Theme toggle — top-right corner ── */}
			<div className="lp-theme-toggle-btn">
				<ThemeToggle />
			</div>

			{/* ── Background atmospheric layer ── */}
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

			{/* ── Corner pills ── */}
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

			{/* ── Login card ── */}
			<div
				className={`lp-card${cardState !== "idle" ? ` lp-card--${cardState}` : ""}`}
				onAnimationEnd={() => {
					if (cardState === "error") setCardState("idle");
				}}
				role="main"
			>
				<div className="lp-card__shine" />
				<img src={lumaLogoFull} alt="Luma" className="lp-card__logo" />

				<header className="lp-card__header">
					<p className="lp-greeting">
						<GreetingIcon
							className="lp-greeting__icon"
							size={14}
							strokeWidth={1.5}
							aria-hidden="true"
						/>
						{greeting.text}
					</p>
					<h1 className="lp-card__title">
						Nos alegra verte
						<br />
						de nuevo
					</h1>
					<p className="lp-card__subtitle">Ingresa tus datos y retoma donde lo dejaste.</p>
				</header>

				<form onSubmit={handleSubmit} className="lp-form" noValidate>
					<div className="lp-field">
						<label className="lp-field__label" htmlFor="username">
							Usuario
						</label>
						<div className="lp-field__wrap">
							<User className="lp-field__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
							<input
								id="username"
								type="text"
								className="lp-field__input"
								placeholder="Tu usuario"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								disabled={isLoading}
								autoComplete="username"
							/>
						</div>
					</div>

					<div className="lp-field">
						<div className="lp-field__label-row">
							<label className="lp-field__label" htmlFor="password">
								Contraseña
							</label>
							<a href="#" className="lp-field__forgot">
								¿Olvidaste tu contraseña?
							</a>
						</div>
						<div className="lp-field__wrap">
							<Lock className="lp-field__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
							<input
								id="password"
								type={showPassword ? "text" : "password"}
								className="lp-field__input lp-field__input--pw"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="current-password"
							/>
							<button
								type="button"
								className="lp-pw-toggle"
								onClick={() => setShowPassword((v) => !v)}
								tabIndex={-1}
								aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
							>
								{showPassword ? (
									<EyeOff size={16} strokeWidth={1.5} />
								) : (
									<Eye size={16} strokeWidth={1.5} />
								)}
							</button>
						</div>
					</div>

					<button type="submit" className="lp-btn" disabled={isLoading}>
						{isLoading ? (
							<Loader2 className="lp-btn__spinner" size={18} aria-label="Cargando" />
						) : (
							<>
								<span>Iniciar sesión</span>
								<ArrowRight size={15} aria-hidden="true" />
							</>
						)}
					</button>
				</form>

				<footer className="lp-card__footer">
					¿Primera vez por aquí?{" "}
					<Link to="/registro" className="lp-card__signup">
						Crea una cuenta
					</Link>
				</footer>
			</div>
		</div>
	);
}
