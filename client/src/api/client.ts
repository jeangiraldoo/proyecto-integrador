import axios from "axios";

// URL del despliegue en Render proporcionada por el Scrum Master
const BASE_URL = "https://proyecto-integrador-as97.onrender.com";

const client = axios.create({
	baseURL: BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

// Interceptor para añadir el token a las peticiones
client.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("access_token");
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
			const refreshToken = localStorage.getItem("refresh_token");

			if (refreshToken) {
				try {
					// Actualizamos también la URL de refresco para apuntar a Render
					const response = await axios.post(`${BASE_URL}/api/token/refresh/`, {
						refresh: refreshToken,
					});

					const { access } = response.data;
					localStorage.setItem("access_token", access);

					// Actualizar el header de la petición original y reintentar
					originalRequest.headers.Authorization = `Bearer ${access}`;
					return client(originalRequest);
				} catch (refreshError) {
					// Si falla el refresh, cerramos sesión
					localStorage.removeItem("access_token");
					localStorage.removeItem("refresh_token");
					window.location.href = "/";
					return Promise.reject(refreshError);
				}
			}
		}
		return Promise.reject(error);
	},
);

export default client;
