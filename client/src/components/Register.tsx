import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	User,
	Lock,
	Mail,
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

export default function Register() {
	const navigate = useNavigate();
	const [form, setForm] = useState({
		username: "",
		email: "",
		password: "",
		passwordConfirm: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [cardState, setCardState] = useState<"idle" | "success" | "error">("idle");
	const [entryAnimationClass, setEntryAnimationClass] = useState("lp-card--enter-soft");
	const [switchingToLogin, setSwitchingToLogin] = useState(false);
	const switchTimerRef = useRef<number | null>(null);
	const formDisabled = isLoading || switchingToLogin;

	const greeting = useMemo(() => {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return { text: "Buenos días", Icon: Sun };
		if (hour >= 12 && hour < 19) return { text: "Buenas tardes", Icon: CloudSun };
		return { text: "Buenas noches", Icon: Moon };
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => setEntryAnimationClass(""), 220);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		return () => {
			if (switchTimerRef.current !== null) {
				window.clearTimeout(switchTimerRef.current);
			}
		};
	}, []);

	const handleSwitchToLogin = () => {
		if (formDisabled) return;
		setSwitchingToLogin(true);
		switchTimerRef.current = window.setTimeout(() => {
			navigate("/login");
		}, 240);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (
			!form.username.trim() ||
			!form.email.trim() ||
			!form.password.trim() ||
			!form.passwordConfirm.trim()
		) {
			toast.error("Por favor, completa todos los campos obligatorios.");
			return;
		}
		if (form.password !== form.passwordConfirm) {
			toast.error("Las contraseñas no coinciden.");
			setCardState("error");
			return;
		}

		setIsLoading(true);
		try {
			await client.post("/register/", {
				username: form.username,
				email: form.email.trim(),
				password: form.password,
				password_confirm: form.passwordConfirm,
			});

			// Auto-login after successful registration
			const tokenRes = await client.post("/api/token/", {
				username: form.username,
				password: form.password,
			});
			const { access, refresh } = tokenRes.data as { access: string; refresh: string };
			setAuthTokens(access, refresh);
			client.defaults.headers.common["Authorization"] = `Bearer ${access}`;

			setCardState("success");
			setIsLoading(false);
			toast.success("¡Cuenta creada! Ahora inicia sesión.");
			setTimeout(() => navigate("/login"), 700);
		} catch (error: unknown) {
			const errResponse =
				typeof error === "object" && error !== null && "response" in error
					? (error as { response?: { data?: unknown; status?: number } }).response
					: undefined;

			const data = errResponse?.data;
			if (data && typeof data === "object") {
				const messages = Object.values(data as Record<string, unknown>)
					.flat()
					.join(" ");
				toast.error(messages || "No se pudo crear la cuenta.");
			} else {
				toast.error("Error de conexión. Intenta más tarde.");
			}
			setCardState("error");
			setIsLoading(false);
		}
	};

	const cardClasses = [
		"lp-card",
		cardState !== "idle" ? `lp-card--${cardState}` : "",
		entryAnimationClass,
	]
		.filter(Boolean)
		.join(" ");
	const { Icon: GreetingIcon } = greeting;

	return (
		<div className="lp-scene" data-testid="register-page">
			{/* ── Theme toggle ── */}
			<div className="lp-theme-toggle-btn" data-testid="register-theme-toggle-wrap">
				<ThemeToggle qaId="register-theme-toggle-btn" />
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

			{/* ── Register card ── */}
			<div
				className={cardClasses}
				onAnimationEnd={() => {
					if (cardState === "error") setCardState("idle");
				}}
				role="main"
				data-testid="register-card"
				data-qa-state={cardState}
			>
				<div className="lp-card__shine" />
				<img src={lumaLogoFull} alt="Luma" className="lp-card__logo" />

				<nav
					className={`lp-auth-switch lp-auth-switch--register${switchingToLogin ? " lp-auth-switch--to-login" : ""}`}
					aria-label="Cambiar formulario"
					data-testid="register-auth-switch"
				>
					<span className="lp-auth-switch__thumb" aria-hidden="true" />
					<button
						type="button"
						className="lp-auth-switch__option"
						onClick={handleSwitchToLogin}
						disabled={formDisabled}
						data-testid="register-go-login-btn"
					>
						Iniciar sesion
					</button>
					<button
						type="button"
						className="lp-auth-switch__option lp-auth-switch__option--active"
						disabled
						aria-current="page"
						data-testid="register-current-tab-btn"
					>
						Crear cuenta
					</button>
				</nav>

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
						Crea tu cuenta
						<br />
						hoy mismo
					</h1>
					<p className="lp-card__subtitle">Empieza a planificar en segundos.</p>
				</header>

				<form onSubmit={handleSubmit} className="lp-form" noValidate data-testid="register-form">
					<div className="lp-field">
						<label className="lp-field__label" htmlFor="reg-username">
							Usuario *
						</label>
						<div className="lp-field__wrap">
							<User className="lp-field__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
							<input
								id="reg-username"
								name="username"
								type="text"
								className="lp-field__input"
								placeholder="Tu usuario"
								value={form.username}
								onChange={handleChange}
								disabled={formDisabled}
								autoComplete="username"
								data-testid="register-username-input"
							/>
						</div>
					</div>

					<div className="lp-field">
						<label className="lp-field__label" htmlFor="reg-email">
							Email *
						</label>
						<div className="lp-field__wrap">
							<Mail className="lp-field__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
							<input
								id="reg-email"
								name="email"
								type="email"
								className="lp-field__input"
								placeholder="tu@email.com"
								value={form.email}
								onChange={handleChange}
								disabled={formDisabled}
								required
								autoComplete="email"
								data-testid="register-email-input"
							/>
						</div>
					</div>

					<div className="lp-field">
						<label className="lp-field__label" htmlFor="reg-password">
							Contraseña *
						</label>
						<div className="lp-field__wrap">
							<Lock className="lp-field__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
							<input
								id="reg-password"
								name="password"
								type={showPassword ? "text" : "password"}
								className="lp-field__input lp-field__input--pw"
								placeholder="Mínimo 8 caracteres"
								value={form.password}
								onChange={handleChange}
								disabled={formDisabled}
								autoComplete="new-password"
								data-testid="register-password-input"
							/>
							<button
								type="button"
								className="lp-pw-toggle"
								onClick={() => setShowPassword((v) => !v)}
								tabIndex={-1}
								aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
								disabled={formDisabled}
								data-testid="register-password-toggle-btn"
							>
								{showPassword ? (
									<EyeOff size={16} strokeWidth={1.5} />
								) : (
									<Eye size={16} strokeWidth={1.5} />
								)}
							</button>
						</div>
					</div>

					<div className="lp-field">
						<label className="lp-field__label" htmlFor="reg-confirm">
							Confirmar contraseña *
						</label>
						<div className="lp-field__wrap">
							<Lock className="lp-field__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
							<input
								id="reg-confirm"
								name="passwordConfirm"
								type={showConfirm ? "text" : "password"}
								className="lp-field__input lp-field__input--pw"
								placeholder="Repite tu contraseña"
								value={form.passwordConfirm}
								onChange={handleChange}
								disabled={formDisabled}
								autoComplete="new-password"
								data-testid="register-confirm-password-input"
							/>
							<button
								type="button"
								className="lp-pw-toggle"
								onClick={() => setShowConfirm((v) => !v)}
								tabIndex={-1}
								aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
								disabled={formDisabled}
								data-testid="register-confirm-password-toggle-btn"
							>
								{showConfirm ? (
									<EyeOff size={16} strokeWidth={1.5} />
								) : (
									<Eye size={16} strokeWidth={1.5} />
								)}
							</button>
						</div>
					</div>

					<button
						type="submit"
						className="lp-btn"
						disabled={formDisabled}
						data-testid="register-submit-btn"
					>
						{isLoading ? (
							<Loader2
								className="lp-btn__spinner"
								size={18}
								aria-label="Cargando"
								data-testid="register-submit-spinner"
							/>
						) : (
							<>
								<span>Crear cuenta</span>
								<ArrowRight size={15} aria-hidden="true" />
							</>
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
