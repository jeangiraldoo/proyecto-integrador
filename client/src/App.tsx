import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import Login from "@/pages/Auth/Login/Login";
import Register from "@/pages/Auth/Register/Register";
import Landing from "@/pages/Landing/Landing";
import Dashboard from "@/pages/Dashboard/Dashboard";
import client from "@/api/client";
import { isTokenValid, clearAuthStorage, getAccessToken } from "@/api/auth";
import ThemeProvider from "@/context/ThemeProvider";
import { useTheme } from "@/hooks/useTheme";
import "./App.css";

/** Ruta protegida: redirige a /login si el token no es válido o expiró. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const token = getAccessToken();
	if (!isTokenValid(token)) {
		// Limpiar almacenamiento antes de redirigir
		clearAuthStorage();
		return <Navigate to="/login" replace />;
	}
	return <>{children}</>;
}

/** Página de registro: redirige a /hoy si ya hay sesión válida. */
function RegisterPage() {
	const token = getAccessToken();
	if (isTokenValid(token)) {
		return <Navigate to="/hoy" replace />;
	}
	// Register component handles navigation internally after success
	return <Register />;
}

/** Página de login: redirige a /hoy si ya hay sesión válida. */
function LoginPage() {
	const navigate = useNavigate();
	const token = getAccessToken();
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
		<ThemeProvider>
			<AppRoutes />
		</ThemeProvider>
	);
}

function AppRoutes() {
	const { theme } = useTheme();
	return (
		<>
			<Toaster position="top-right" theme={theme} richColors />
			<Routes>
				{/* Landing */}
				<Route path="/" element={<Landing />} />

				<Route path="/login" element={<LoginPage />} />
				<Route path="/registro" element={<RegisterPage />} />

				<Route
					path="/hoy"
					element={
						<ProtectedRoute>
							<DashboardPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/organizacion"
					element={
						<ProtectedRoute>
							<DashboardPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/progreso"
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
