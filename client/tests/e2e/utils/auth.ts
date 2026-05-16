import { Page } from "@playwright/test";

// JWT con exp = 9999999999 (año 2286). La app solo valida la expiración, no la firma.
// Payload: {"sub":"999","exp":9999999999}
const MOCK_JWT =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OTkiLCJleHAiOjk5OTk5OTk5OTl9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

/** Mock user ID used by MOCK_JWT (sub claim). */
const MOCK_USER_ID = 999;

/**
 * Pre-sets all onboarding localStorage keys as "seen" so the tour never
 * interrupts automated tests. Sets both the user-scoped variant (user_999)
 * and the base (unscoped) variant as a fallback for any user ID.
 */
async function suppressOnboardingTour(page: Page) {
	const BASE_KEYS = ["luma_has_seen_tour", "luma_has_seen_org_tour", "luma_has_seen_progress_tour"];
	await page.addInitScript(
		({ baseKeys, userId }: { baseKeys: string[]; userId: number }) => {
			for (const key of baseKeys) {
				localStorage.setItem(key, "true");
				localStorage.setItem(`${key}_user_${userId}`, "true");
			}
		},
		{ baseKeys: BASE_KEYS, userId: MOCK_USER_ID },
	);
}

/**
 * Inyecta un JWT mock directamente en localStorage y navega a /hoy.
 * Úsala en tests que mockean toda la API para evitar depender del backend real.
 */
export async function loginWithMockedToken(page: Page) {
	// La clave de storage deriva de la API_BASE_URL del build de producción/Vercel
	// API_BASE_URL = "https://proyecto-integrador-as97.onrender.com/"
	// origin.replace(/[^a-zA-Z0-9]+/g, "_") = "https_proyecto_integrador_as97_onrender_com"
	const STORAGE_KEY = "luma_auth_https_proyecto_integrador_as97_onrender_com_access";

	await suppressOnboardingTour(page);

	// addInitScript ejecuta ANTES de que la app corra en cada navegación
	await page.addInitScript(
		({ key, token }: { key: string; token: string }) => {
			localStorage.setItem(key, token);
		},
		{ key: STORAGE_KEY, token: MOCK_JWT },
	);

	await page.goto("/hoy");
}

/**
 * Función reutilizable para logearse y navegar al dashboard/hoy.
 * Mockea /api/token/ con un JWT válido para evitar depender del backend real (Render cold start).
 */
export async function loginAndGoToDashboard(page: Page) {
	await suppressOnboardingTour(page);

	// Mock del endpoint de login — evita llamada real a Render
	await page.route("**/api/token/**", (route) =>
		route.fulfill({ json: { access: MOCK_JWT, refresh: MOCK_JWT } }),
	);

	// 1. Ir a la ruta de inicio (formulario de login)
	await page.goto("/auth");

	// 2. Llenar credenciales
	await page.locator("#username").fill("jean");
	await page.locator("#password").fill("superjean");

	// 3. Enviar y esperar navegación al dashboard u otra ruta
	await Promise.all([
		// Dependiendo de tu frontend, se puede esperar a la redirección
		// waitForURL puede ser algo como /dashboard o /hoy
		page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
		page.locator('button[type="submit"]').click(),
	]);

	// Si después del login cae al dashboard, y la vista que queremos es /hoy:
	await page.goto("/hoy");
}
