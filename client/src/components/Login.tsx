import React, { useState, useMemo } from "react";
import {
	User,
	Lock,
	Loader2,
	ArrowRight,
	Zap,
	GitBranch,
	BarChart3,
	Activity,
	Eye,
	EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import client from "../api/client";
import "./Login.css";
import lumaLogoFull from "../assets/luma.png"; // Usando el logo completo con texto
import lumaIcon from "../assets/luma_2.png"; // Usando solo el icono para el hero

interface LoginProps {
	onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	// Saludo dinámico según la hora
	const greeting = useMemo(() => {
		const hour = new Date().getHours();
		if (hour >= 5 && hour < 12) return { text: "Buenos d\u00edas", emoji: "\u2600\ufe0f" };
		if (hour >= 12 && hour < 19) return { text: "Buenas tardes", emoji: "\ud83c\udf24\ufe0f" };
		return { text: "Buenas noches", emoji: "\ud83c\udf19" };
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!username.trim() || !password.trim()) {
			toast.error("Por favor, completa todos los campos para continuar.");
			return;
		}

		setIsLoading(true);
		try {
			const response = await client.post("/api/token/", {
				username,
				password,
			});

			const { access, refresh } = response.data;
			localStorage.setItem("access_token", access);
			localStorage.setItem("refresh_token", refresh);

			toast.success("¡Bienvenido de nuevo!");

			client.defaults.headers.common["Authorization"] = `Bearer ${access}`;

			// Silently fetch user info
			client.get("/me/").catch(console.error);

			onLoginSuccess(access);
		} catch (error: unknown) {
			console.error("Login error:", error);
			if (
				typeof error === "object" &&
				error !== null &&
				"response" in error &&
				(error as { response: { status: number } }).response.status === 401
			) {
				toast.error("Usuario o contraseña incorrectos.");
			} else {
				toast.error("Error de conexión. Intenta más tarde.");
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="login-container">
			{/* Lado Izquierdo: Formulario */}
			<div className="login-left">
				<div className="brand-row">
					<img src={lumaLogoFull} alt="Luma" className="brand-logo-full" />
				</div>

				<div className="login-form-wrapper">
					<div className="login-header">
						<p className="greeting-line">
							<span className="greeting-emoji">{greeting.emoji}</span> {greeting.text}
						</p>
						<h1>Nos alegra verte de nuevo</h1>
						<p className="login-subtitle">Ingresa tus datos y retoma donde lo dejaste.</p>
					</div>

					<form onSubmit={handleSubmit} className="login-form">
						<div className="modern-input-group">
							<label htmlFor="username">Usuario</label>
							<div className="input-field-wrapper">
								<input
									id="username"
									type="text"
									className="modern-input"
									placeholder="tu@correo.com"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									disabled={isLoading}
									autoComplete="username"
								/>
								<User className="input-icon" strokeWidth={1.5} />
							</div>
						</div>

						<div className="modern-input-group">
							<label htmlFor="password">Contraseña</label>
							<div className="input-field-wrapper">
								<input
									id="password"
									type={showPassword ? "text" : "password"}
									className="modern-input modern-input--password"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={isLoading}
									autoComplete="current-password"
								/>
								<Lock className="input-icon" strokeWidth={1.5} />
								<button
									type="button"
									className={`password-toggle ${showPassword ? "is-visible" : ""}`}
									onClick={() => setShowPassword(!showPassword)}
									tabIndex={-1}
									aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
								>
									<Eye className="eye-icon eye-open" size={18} strokeWidth={1.5} />
									<EyeOff className="eye-icon eye-closed" size={18} strokeWidth={1.5} />
								</button>
							</div>
							<div style={{ textAlign: "right", marginTop: "0.4rem" }}>
								<a href="#" className="forgot-password">
									¿Olvidaste tu contraseña?
								</a>
							</div>
						</div>

						<button type="submit" className="btn-primary" disabled={isLoading}>
							{isLoading ? (
								<Loader2 className="spinner" size={18} />
							) : (
								<div className="btn-content">
									<span>Iniciar sesión</span>
									<ArrowRight size={16} />
								</div>
							)}
						</button>
					</form>

					<div className="form-footer">
						<span>¿Primera vez por aqui?</span>
						<a href="#" className="highlight-link">
							Crea una cuenta
						</a>
					</div>
				</div>
			</div>

			{/* Lado Derecho: Visual decorativo */}
			<div className="login-right">
				{/* Gradient orbs background */}
				<div className="right-bg">
					<div className="gradient-orb orb-1" />
					<div className="gradient-orb orb-2" />
					<div className="gradient-orb orb-3" />
				</div>

				{/* Floating stat pills */}
				<div className="floating-card card-1">
					<div className="floating-icon">
						<BarChart3 size={18} color="#c4b5fd" />
					</div>
					<div className="floating-text">
						<span>Progreso</span>
						<strong>En tiempo real</strong>
					</div>
				</div>

				<div className="floating-card card-2">
					<div className="floating-icon">
						<Activity size={18} color="#a78bfa" />
					</div>
					<div className="floating-text">
						<span>Actividades</span>
						<strong>Organizadas</strong>
					</div>
				</div>

				{/* Glass card */}
				<div className="glass-card">
					<img src={lumaIcon} alt="Luma" className="hero-main-logo" />
					<h2>
						Organiza tu <span className="text-gradient">agenda.</span>
					</h2>
					<p className="glass-subtitle">
						La plataforma inteligente para gestionar tu tiempo y alcanzar tus metas.
					</p>
					<div className="glass-features">
						<div className="glass-pill">
							<Zap size={14} /> Automático
						</div>
						<div className="glass-pill">
							<Zap size={14} /> Rápido
						</div>
						<div className="glass-pill">
							<GitBranch size={14} /> Trazabilidad
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
