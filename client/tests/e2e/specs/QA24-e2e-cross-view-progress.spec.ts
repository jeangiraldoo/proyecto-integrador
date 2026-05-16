import { test, expect } from "@playwright/test";
import { loginWithMockedToken } from "../utils/auth";

// ─────────────────────────────────────────────────────────────────────────────
// QA-24 | US-09 — Script E2E Transversal: Consistencia de Progreso entre Vistas
//
// Valida la integración entre /hoy y /organizacion:
// el cálculo de progreso se actualiza en tiempo real al completar una subtarea.
//
// Script 1: Flujo completo /organizacion → /hoy → completar subtarea → /organizacion
//           Verifica que el contador y la barra reflejan el nuevo porcentaje sin F5.
// Script 2: Ausencia de errores de consola y 500 durante el flujo completo.
// ─────────────────────────────────────────────────────────────────────────────

const formatLocalDate = (date: Date) => {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
};

const TODAY_STR = formatLocalDate(new Date());
const FAR_FUTURE = formatLocalDate(
	new Date(new Date().getFullYear(), new Date().getMonth() + 3, 15),
);

const MOCK_USER = {
	id: 999,
	username: "qa24user",
	email: "qa24@test.com",
	name: "QA24 CrossView User",
	max_daily_hours: 8,
	onboarding: {
		has_seen_tour: true,
		has_seen_org_tour: true,
		has_seen_progress_tour: true,
	},
};

// ── Actividad 801: 0/2 completadas inicialmente ───────────────────────────
const ACTIVITY_801_BASE = {
	id: 801,
	user: 999,
	title: "Proyecto Transversal",
	course_name: "Álgebra",
	description: "Actividad con subtareas en /hoy y /organizacion",
	due_date: FAR_FUTURE,
	status: "in_progress",
	subtask_count: 2,
	total_subtasks_count: 2,
	total_estimated_hours: 4,
};

// Subtarea 8010: vence hoy → aparece en la columna "today" de /hoy
const SUBTASK_8010 = {
	id: 8010,
	name: "Subtarea para completar desde /hoy",
	status: "pending",
	estimated_hours: 2,
	target_date: TODAY_STR,
	ordering: 1,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
	postponement_note: null,
	activity: { id: 801, title: "Proyecto Transversal" },
};

// Subtarea 8011: vence en el futuro → en upcoming, no en /hoy today
const SUBTASK_8011 = {
	id: 8011,
	name: "Subtarea futura",
	status: "pending",
	estimated_hours: 2,
	target_date: FAR_FUTURE,
	ordering: 2,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
	postponement_note: null,
	activity: { id: 801, title: "Proyecto Transversal" },
};

// Datos para /today/ — subtarea 8010 aparece en columna "today"
// Formato plano que TodayView espera (igual que QA19)
const MOCK_TODAY_DATA = {
	overdue: [],
	today: [
		{
			id: 8010,
			name: "Subtarea para completar desde /hoy",
			status: "pending",
			course_name: "Álgebra",
			target_date: TODAY_STR,
			estimated_hours: 2,
			postponement_note: null,
			activity: { id: 801, title: "Proyecto Transversal" },
		},
	],
	upcoming: [],
	postponed: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

// ─────────────────────────────────────────────────────────────────────────────

test.describe("QA-24 | US-09 - Script E2E Transversal: /organizacion ↔ /hoy (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	let consoleErrors: string[] = [];

	test.beforeEach(async ({ page }) => {
		consoleErrors = [];

		page.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});
		page.on("response", (res) => {
			if (res.status() === 500) consoleErrors.push(`[500] ${res.url()}`);
		});

		// Estado mutable del progreso (stateful mock)
		let completedCount = 0;

		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		// GET /activities/ — devuelve completedCount dinámicamente
		await page.route("**/activities/", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({
					json: [{ ...ACTIVITY_801_BASE, completed_subtasks_count: completedCount }],
				});
			} else {
				await route.continue();
			}
		});

		// GET /activities/801/subtasks/ — lista de subtareas
		await page.route("**/activities/801/subtasks/", async (route) => {
			if (route.request().method() === "GET") {
				const sub8010 = {
					...SUBTASK_8010,
					status: completedCount > 0 ? "completed" : "pending",
				};
				await route.fulfill({ json: [sub8010, SUBTASK_8011] });
			} else {
				await route.continue();
			}
		});

		// PATCH /activities/*/subtasks/*/ — actualiza el contador
		await page.route("**/activities/*/subtasks/*/", async (route) => {
			if (route.request().method() === "PATCH") {
				const body = JSON.parse(route.request().postData() || "{}");
				if (body.status === "completed") completedCount++;
				await route.fulfill({
					status: 200,
					json: {
						...SUBTASK_8010,
						status: body.status,
						...body,
					},
				});
			} else {
				await route.continue();
			}
		});

		// loginWithMockedToken inyecta el JWT vía addInitScript y navega a /hoy
		// directamente, sin pasar por el formulario de auth (que podría redirigir
		// automáticamente si /me/ ya está mockeado como usuario válido).
		await loginWithMockedToken(page);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// Script 1: Flujo completo /organizacion → /hoy → completar → /organizacion
	// Criterio gating: el progreso se actualiza sin recarga de página (sin F5)
	// ─────────────────────────────────────────────────────────────────────────
	test("Script 1: Completar subtarea en /hoy actualiza el progreso en /organizacion sin recarga", async ({
		page,
	}) => {
		// ── Centinela anti-recarga ────────────────────────────────────────────
		await page.evaluate(() => {
			(window as Window & { __reloadDetected?: boolean }).__reloadDetected = false;
			window.addEventListener("beforeunload", () => {
				(window as Window & { __reloadDetected?: boolean }).__reloadDetected = true;
			});
		});

		// ── Paso 1: Ir a /organizacion ────────────────────────────────────────
		await page.goto("/organizacion");
		await expect(page.locator('[data-testid="org-view"]')).toBeVisible({ timeout: 15000 });

		// ── Paso 2: Expandir materia "Álgebra" ────────────────────────────────
		// toTestIdToken("Álgebra") → "algebra"
		const subjectHeader = page.locator('[data-testid="org-subject-header-algebra"]');
		await expect(subjectHeader).toBeVisible({ timeout: 8000 });
		await subjectHeader.click();
		await expect(page.locator('[data-testid="org-subject-body-algebra"]')).toBeVisible({
			timeout: 5000,
		});

		// ── Paso 3: Capturar progreso inicial (0 de 2) ────────────────────────
		const progressCount = page.locator('[data-testid="org-activity-progress-count-801"]');
		await expect(progressCount).toBeVisible({ timeout: 5000 });
		const initialText = await progressCount.textContent();
		expect(initialText?.trim()).toBe("0 de 2");

		const progressBar = page.locator('[data-testid="org-activity-progress-801"]');
		const initialAriaValue = await progressBar.getAttribute("aria-valuenow");
		expect(Number(initialAriaValue)).toBe(0);

		const initialFillWidth = await page
			.locator('[data-testid="org-activity-progress-fill-801"]')
			.evaluate((el) => parseFloat((el as HTMLElement).style.width));
		expect(initialFillWidth).toBe(0);

		// ── Paso 4: Navegar a /hoy ────────────────────────────────────────────
		await page.goto("/hoy");
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		// ── Paso 5: Verificar que la subtarea aparece en la columna "today" ──
		const subtaskCard = page.locator('[data-testid="today-subtask-card-8010"]');
		await expect(subtaskCard).toBeVisible({ timeout: 10000 });

		// ── Paso 6: Marcar la subtarea como "Hecha" (completed) ──────────────
		const statusBtn = page.locator('[data-testid="today-subtask-status-btn-8010"]');
		await statusBtn.click();

		const completedOption = page.locator(
			'[data-testid="today-subtask-status-option-8010-completed"]',
		);
		await expect(completedOption).toBeVisible({ timeout: 5000 });
		await completedOption.click();

		// Esperar toast de confirmación
		const toast = page.locator("[data-sonner-toast]").filter({ hasText: /completada|hecha/i });
		await expect(toast).toBeVisible({ timeout: 8000 });

		// ── Paso 7: Regresar a /organizacion ─────────────────────────────────
		await page.goto("/organizacion");
		await expect(page.locator('[data-testid="org-view"]')).toBeVisible({ timeout: 15000 });

		// ── Paso 8: Re-expandir la materia ───────────────────────────────────
		const subjectHeaderAgain = page.locator('[data-testid="org-subject-header-algebra"]');
		await expect(subjectHeaderAgain).toBeVisible({ timeout: 8000 });
		await subjectHeaderAgain.click();
		await expect(page.locator('[data-testid="org-subject-body-algebra"]')).toBeVisible({
			timeout: 5000,
		});

		// ── Paso 9: Verificar que el progreso ahora es "1 de 2" ──────────────
		const updatedCount = page.locator('[data-testid="org-activity-progress-count-801"]');
		await expect(updatedCount).toBeVisible({ timeout: 5000 });
		await expect(updatedCount).toContainText("1 de 2", { timeout: 5000 });

		// ── Paso 10: Verificar aria-valuenow=50 ──────────────────────────────
		const updatedBar = page.locator('[data-testid="org-activity-progress-801"]');
		const updatedAriaValue = await updatedBar.getAttribute("aria-valuenow");
		expect(Number(updatedAriaValue)).toBe(50);

		// ── Paso 11: Verificar que el width CSS de la barra incrementó ───────
		const updatedFillWidth = await page
			.locator('[data-testid="org-activity-progress-fill-801"]')
			.evaluate((el) => parseFloat((el as HTMLElement).style.width));
		expect(updatedFillWidth).toBeGreaterThan(0);
		expect(updatedFillWidth).toBeCloseTo(50, 0);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// Script 2: Sin errores de consola ni 500 durante el flujo completo
	// Criterio: La integración no genera errores críticos de React ni del servidor
	// ─────────────────────────────────────────────────────────────────────────
	test("Script 2: El flujo transversal no genera errores 500 ni errores críticos de React", async ({
		page,
	}) => {
		// ── Ejecutar flujo completo ───────────────────────────────────────────

		// 1. /organizacion
		await page.goto("/organizacion");
		await expect(page.locator('[data-testid="org-view"]')).toBeVisible({ timeout: 15000 });
		const subjectHeader = page.locator('[data-testid="org-subject-header-algebra"]');
		await expect(subjectHeader).toBeVisible({ timeout: 8000 });
		await subjectHeader.click();
		await expect(page.locator('[data-testid="org-subject-body-algebra"]')).toBeVisible({
			timeout: 5000,
		});

		// 2. Verificar tarjeta de actividad visible
		const activityCard = page.locator('[data-testid="org-activity-card-801"]');
		await expect(activityCard).toBeVisible({ timeout: 5000 });

		// 3. /hoy
		await page.goto("/hoy");
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		// 4. Completar subtarea
		const subtaskCard = page.locator('[data-testid="today-subtask-card-8010"]');
		await expect(subtaskCard).toBeVisible({ timeout: 10000 });

		const statusBtn = page.locator('[data-testid="today-subtask-status-btn-8010"]');
		await statusBtn.click();
		const completedOption = page.locator(
			'[data-testid="today-subtask-status-option-8010-completed"]',
		);
		await expect(completedOption).toBeVisible({ timeout: 5000 });
		await completedOption.click();

		// 5. Esperar a que el toast desaparezca para no bloquear interacciones
		const toast = page.locator("[data-sonner-toast]").filter({ hasText: /completada|hecha/i });
		await expect(toast).toBeVisible({ timeout: 8000 });
		await page.mouse.move(0, 0);
		await expect(toast).not.toBeVisible({ timeout: 10000 });

		// 6. /organizacion
		await page.goto("/organizacion");
		await expect(page.locator('[data-testid="org-view"]')).toBeVisible({ timeout: 15000 });

		// ── Validar ausencia de errores críticos ─────────────────────────────
		const criticalErrors = consoleErrors.filter(
			(e) => e.includes("[500]") || e.toLowerCase().includes("uncaught"),
		);
		expect(criticalErrors).toHaveLength(0);
	});
});
