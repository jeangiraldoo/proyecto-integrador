const API_BASE_URL =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
	"https://proyecto-integrador-as97.onrender.com/";

function getStorageScope(): string {
	try {
		return new URL(API_BASE_URL).origin.replace(/[^a-zA-Z0-9]+/g, "_");
	} catch {
		return "default";
	}
}

function getStorageKey(kind: "access" | "refresh"): string {
	return `luma_auth_${getStorageScope()}_${kind}`;
}

export function getAccessToken(): string | null {
	return localStorage.getItem(getStorageKey("access"));
}

export function getRefreshToken(): string | null {
	return localStorage.getItem(getStorageKey("refresh"));
}

export function setAuthTokens(access: string, refresh: string) {
	localStorage.setItem(getStorageKey("access"), access);
	localStorage.setItem(getStorageKey("refresh"), refresh);
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
}

export function setAccessToken(access: string) {
	localStorage.setItem(getStorageKey("access"), access);
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
}

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
	localStorage.removeItem(getStorageKey("access"));
	localStorage.removeItem(getStorageKey("refresh"));
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
}
