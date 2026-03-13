import axios from "axios";
import { clearAuthStorage, getAccessToken, getRefreshToken, setAccessToken } from "./auth";

const baseURL =
	(import.meta.env.VITE_API_BASE_URL as string) ?? "https://proyecto-integrador-as97.onrender.com/";

const client = axios.create({
	baseURL,
	headers: {
		"Content-Type": "application/json",
	},
});

// Interceptor para añadir el token a las peticiones
client.interceptors.request.use(
	(config) => {
		const token = getAccessToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

// Interceptor para manejar errores de autenticación (401) y refrescar el token
client.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		// Si el error es 401 y no hemos reintentado ya
		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;
			const refreshToken = getRefreshToken();

			if (refreshToken) {
				try {
					const response = await axios.post(`${baseURL}/api/token/refresh/`, {
						refresh: refreshToken,
					});

					const { access } = response.data;
					setAccessToken(access);

					// Actualizar el header de la petición original y reintentar
					originalRequest.headers.Authorization = `Bearer ${access}`;
					return client(originalRequest);
				} catch (refreshError) {
					// Si falla el refresh, cerramos sesión
					clearAuthStorage();
					window.location.href = "/login";
					return Promise.reject(refreshError);
				}
			}
		}
		return Promise.reject(error);
	},
);

export default client;
