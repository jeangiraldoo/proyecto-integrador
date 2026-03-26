import React from "react";
import { Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
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

// ─────────────────────────────────────────────
// Layout: rutas públicas (ya autenticado → /hoy)
// ─────────────────────────────────────────────
function AuthLayout() {
	const token = getAccessToken();
	if (isTokenValid(token)) return <Navigate to="/hoy" replace />;
	return <Outlet />;
}

// ─────────────────────────────────────────────
// Layout: rutas protegidas (sin sesión → /login)
// ─────────────────────────────────────────────
function DashboardLayout() {
	const navigate = useNavigate();
	const token = getAccessToken();

	if (!isTokenValid(token)) {
		clearAuthStorage();
		return <Navigate to="/login" replace />;
	}

	const handleLogout = () => {
		clearAuthStorage();
		delete client.defaults.headers.common["Authorization"];
		toast.success("Sesión cerrada correctamente");
		navigate("/login");
	};

	// El Dashboard ya usa useLocation() internamente para saber qué vista mostrar.
	// Este layout simplemente lo envuelve con la lógica de autenticación.
	return <Dashboard onLogout={handleLogout} />;
}

// ─────────────────────────────────────────────
// Login page (dentro del AuthLayout)
// ─────────────────────────────────────────────
function LoginPage() {
	const navigate = useNavigate();
	const handleLoginSuccess = (accessToken: string) => {
		client.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
		navigate("/hoy");
	};
	return <Login onLoginSuccess={handleLoginSuccess} />;
}

// ─────────────────────────────────────────────
// App root
// ─────────────────────────────────────────────
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
				{/* ── Página de inicio ── */}
				<Route path="/" element={<Landing />} />

				{/* ── Rutas de autenticación (redirigen si ya hay sesión) ── */}
				<Route element={<AuthLayout />}>
					<Route path="/login" element={<LoginPage />} />
					<Route path="/registro" element={<Register />} />
				</Route>

				{/* ── Rutas protegidas del dashboard ── */}
				<Route element={<DashboardLayout />}>
					<Route path="/hoy" element={null} />
					<Route path="/organizacion" element={null} />
					<Route path="/progreso" element={null} />
				</Route>

				{/* ── Fallback ── */}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</>
	);
}

export default App;
