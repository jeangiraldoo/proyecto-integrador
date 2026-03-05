import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import client from "./api/client";
import { isTokenValid, clearAuthStorage } from "./api/auth";
import "./App.css";

/** Ruta protegida: redirige a /login si el token no es válido o expiró. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const token = localStorage.getItem("access_token");
	if (!isTokenValid(token)) {
		// Limpiar almacenamiento antes de redirigir
		clearAuthStorage();
		return <Navigate to="/login" replace />;
	}
	return <>{children}</>;
}

/** Página de login: redirige a /hoy si ya hay sesión válida. */
function LoginPage() {
	const navigate = useNavigate();
	const token = localStorage.getItem("access_token");
	if (isTokenValid(token)) {
		return <Navigate to="/hoy" replace />;
	}
	const handleLoginSuccess = (accessToken: string) => {
		client.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
		navigate("/hoy");
	};
	return <Login onLoginSuccess={handleLoginSuccess} />;
}

/** Página del dashboard con manejo de logout. */
function DashboardPage() {
	const navigate = useNavigate();
	const handleLogout = () => {
		clearAuthStorage();
		delete client.defaults.headers.common["Authorization"];
		toast.success("Sesión cerrada correctamente");
		navigate("/login");
	};
	return <Dashboard onLogout={handleLogout} />;
}

function App() {
	return (
		<>
			<Toaster position="top-right" theme="dark" richColors />
			<Routes>
				{/* Landing – espacio reservado para la página principal */}
				<Route path="/" element={<div>Landing (próximamente)</div>} />

				<Route path="/login" element={<LoginPage />} />

				<Route
					path="/hoy"
					element={
						<ProtectedRoute>
							<DashboardPage />
						</ProtectedRoute>
					}
				/>

				{/* Cualquier ruta desconocida va a la landing */}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</>
	);
}

export default App;
