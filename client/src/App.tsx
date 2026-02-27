import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import client from "./api/client";
import "./App.css";

function App() {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
		const token = localStorage.getItem("access_token");
		if (token) {
			client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
			return true;
		}
		return false;
	});

	// Efecto para sincronizar el header de axios si el estado cambia (por si acaso)
	useEffect(() => {
		const token = localStorage.getItem("access_token");
		if (isAuthenticated && token) {
			client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
		} else {
			delete client.defaults.headers.common["Authorization"];
		}
	}, [isAuthenticated]);

	const handleLoginSuccess = (token: string) => {
		client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
		setIsAuthenticated(true);
	};

	const handleLogout = () => {
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
		delete client.defaults.headers.common["Authorization"];
		setIsAuthenticated(false);
	};

	if (!isAuthenticated) {
		return (
			<>
				<Toaster position="top-right" theme="dark" richColors />
				<Login onLoginSuccess={handleLoginSuccess} />
			</>
		);
	}

	return (
		<>
			<Toaster position="top-right" theme="dark" richColors />
			<Dashboard onLogout={handleLogout} />
		</>
	);
}

export default App;
