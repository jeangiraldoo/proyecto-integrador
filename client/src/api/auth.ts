/** Decodifica el payload del JWT y comprueba que no haya expirado. */
export function isTokenValid(token: string | null): boolean {
	if (!token) return false;
	try {
		const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
		const payload = JSON.parse(atob(base64)) as { exp?: number };
		return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
	} catch {
		return false;
	}
}

/** Elimina los tokens del localStorage. */
export function clearAuthStorage() {
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
}
