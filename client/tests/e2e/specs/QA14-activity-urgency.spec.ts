import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para generar fechas dinámicas (evita que el test falle mañana)
// ─────────────────────────────────────────────────────────────────────────────
const formatLocalDate = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const dayBefore = new Date(today);
dayBefore.setDate(today.getDate() - 2);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfter = new Date(today);
dayAfter.setDate(today.getDate() + 2);

const TODAY_STR = formatLocalDate(today);
const YESTERDAY_STR = formatLocalDate(yesterday);
const DAY_BEFORE_STR = formatLocalDate(dayBefore);
const TOMORROW_STR = formatLocalDate(tomorrow);
const DAY_AFTER_STR = formatLocalDate(dayAfter);

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data (Semilla controlada)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_TODAY_DATA = {
	overdue: [
		{
			id: 102,
			name: "Tarea B (Ayer)",
			target_date: YESTERDAY_STR,
			estimated_hours: 4,
			status: "pending",
		},
		{
			id: 101,
			name: "Tarea A (Hace 2 días)",
			target_date: DAY_BEFORE_STR,
			estimated_hours: 2,
			status: "pending",
		},
	],
	today: [
		{
			id: 202,
			name: "Tarea Larga (4h)",
			target_date: TODAY_STR,
			estimated_hours: 4,
			status: "pending",
		},
		{
			id: 201,
			name: "Tarea Rápida (1h)",
			target_date: TODAY_STR,
			estimated_hours: 1,
			status: "in_progress",
		},
	],
	upcoming: [
		{
			id: 302,
			name: "Tarea Pasado Mañana",
			target_date: DAY_AFTER_STR,
			estimated_hours: 2,
			status: "pending",
		},
		{
			id: 301,
			name: "Tarea Mañana",
			target_date: TOMORROW_STR,
			estimated_hours: 3,
			status: "pending",
		},
	],
	postponed: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

const MOCK_EMPTY_DATA = {
	overdue: [],
	today: [],
	upcoming: [],
	postponed: [],
	meta: { n_days: 7 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE DE PRUEBAS
// ─────────────────────────────────────────────────────────────────────────────
test.describe("QA-14 | US-4 - Prueba E2E Vista /hoy (Prioridades y Ordenamiento)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 1 });

	test("Caso de Éxito: Renderizado correcto y Reglas de Ordenamiento", async ({ page }) => {
		// 1. Interceptar la API para inyectar nuestra semilla controlada
		await page.route("**/today/**", async (route) => {
			await route.fulfill({ json: MOCK_TODAY_DATA });
		});

		// 2. Login y navegación a /hoy
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		// 3. Validar Pestaña "Vencidas" (Debe ordenar por fecha más antigua primero)
		await test.step("Ordenamiento Vencidas: Más antiguas primero", async () => {
			await page.getByTestId("today-tab-overdue").click();
			const overdueCards = page.locator('[data-testid^="today-subtask-title-"]');

			// Tarea A (Hace 2 días) debe estar antes que Tarea B (Ayer)
			await expect(overdueCards.nth(0)).toContainText("Tarea A (Hace 2 días)");
			await expect(overdueCards.nth(1)).toContainText("Tarea B (Ayer)");
		});

		// 4. Validar Pestaña "Para hoy" (Debe ordenar por menor tiempo primero)
		await test.step("Ordenamiento Hoy: Menor esfuerzo primero", async () => {
			await page.getByTestId("today-tab-today").click();
			const todayCards = page.locator('[data-testid^="today-subtask-title-"]');

			// Tarea Rápida (1h) debe estar antes que Tarea Larga (4h)
			await expect(todayCards.nth(0)).toContainText("Tarea Rápida (1h)");
			await expect(todayCards.nth(1)).toContainText("Tarea Larga (4h)");
		});

		// 5. Validar Pestaña "Próximas" (Debe ordenar por fecha más cercana primero)
		await test.step("Ordenamiento Próximas: Más cercanas primero", async () => {
			await page.getByTestId("today-tab-upcoming").click();
			const upcomingCards = page.locator('[data-testid^="today-subtask-title-"]');

			// Tarea Mañana debe estar antes que Tarea Pasado Mañana
			await expect(upcomingCards.nth(0)).toContainText("Tarea Mañana");
			await expect(upcomingCards.nth(1)).toContainText("Tarea Pasado Mañana");
		});

		// 6. Verificar apertura de detalles
		await test.step("Interacción: Abrir panel de detalles", async () => {
			await page.getByTestId("today-subtask-card-301").click();
			await expect(page.getByTestId("subtask-detail-panel")).toBeVisible();
			await page.getByTestId("subtask-detail-close-btn").click();
		});
	});

	test("Caso de Estado Vacío: Cuando no hay subtareas pendientes", async ({ page }) => {
		await page.route("**/today/**", async (route) => {
			await route.fulfill({ json: MOCK_EMPTY_DATA });
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		await test.step("Verificar UI de estado vacío", async () => {
			// Pill superior
			await expect(page.getByTestId("today-summary-pill")).toContainText(/Sin tareas urgentes/i);

			// Empty state en la columna
			await expect(page.getByTestId("today-empty-state-upcoming")).toBeVisible();
			await expect(page.getByTestId("today-empty-state-upcoming")).toContainText(/Nada por aquí/i);
		});
	});

	test("Caso de Falla: Resiliencia del Frontend ante error 500 del servidor", async ({ page }) => {
		await page.route("**/today/**", async (route) => {
			await route.fulfill({ status: 500, json: { errors: { server: "Internal Server Error" } } });
		});

		await loginAndGoToDashboard(page);

		await test.step("La aplicación no crashea y maneja la falta de datos grácilmente", async () => {
			// El frontend maneja el error cayendo al "Estado vacío" (EMPTY_KANBAN) en lugar de una pantalla blanca
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });
			await expect(page.getByTestId("today-tab-today")).toBeVisible();
			await expect(page.getByTestId("today-empty-state-upcoming")).toBeVisible();
		});
	});
});
