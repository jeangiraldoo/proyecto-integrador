import React, { useState } from "react";
import { User, Lock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import client from "../api/client";
import "./Login.css";

interface LoginProps {
	onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!username.trim() || !password.trim()) {
			toast.error("Por favor, completa todos los campos");
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

			toast.success("¡Inicio de sesión exitoso!");

			// Configurar el token para la siguiente petición
			client.defaults.headers.common["Authorization"] = `Bearer ${access}`;

			// Obtener información del usuario
			try {
				const meResponse = await client.get("/me/");
				console.group("🔐 Usuario Logueado");
				console.log("User Info:", meResponse.data);
				console.log("JWT Token:", access);
				console.groupEnd();
			} catch (err) {
				console.error("Error al obtener datos del usuario:", err);
			}

			onLoginSuccess(access);
		} catch (error: unknown) {
			console.error("Login error:", error);
			if (
				typeof error === "object" &&
				error !== null &&
				"response" in error &&
				(error as { response: { status: number } }).response.status === 401
			) {
				toast.error("Credenciales incorrectas. Intenta de nuevo.");
			} else {
				toast.error("Ocurrió un error al intentar iniciar sesión.");
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="login-container">
			<div className="login-card">
				<div className="login-header">
					<div className="logo-container">
						<img
							src="/luma.png"
							alt="Luma Logo"
							className="login-logo"
							onError={(e) => {
								e.currentTarget.style.display = "none";
							}}
						/>
					</div>
					<h2>Bienvenido a Luma</h2>
					<p>Inicia sesión para organizar tu día</p>
				</div>

				<form onSubmit={handleSubmit} className="login-form" noValidate>
					<div className="input-group">
						<label htmlFor="username">Usuario</label>
						<div className="input-wrapper">
							<User className="input-icon" size={18} />
							<input
								id="username"
								type="text"
								placeholder="Ingresa tu usuario"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								disabled={isLoading}
								autoComplete="username"
							/>
						</div>
					</div>

					<div className="input-group">
						<label htmlFor="password">Contraseña</label>
						<div className="input-wrapper">
							<Lock className="input-icon" size={18} />
							<input
								id="password"
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="current-password"
							/>
						</div>
					</div>

					<button
						type="submit"
						className={`login-button ${isLoading ? "loading" : ""}`}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="spinner" size={20} />
								<span>Iniciando...</span>
							</>
						) : (
							<>
								<span>Iniciar Sesión</span>
								<ArrowRight size={20} />
							</>
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
