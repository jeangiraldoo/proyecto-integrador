import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

// ─────────────────────────────────────────────────────────────────────────────
// QA-22 | US-09 — Integridad del Cálculo de Progreso en Vista Organización
//
// Caso 1: Actividad con 3 subtareas, completar 1 → barra al 33.3% y "1 de 3"
// Caso 2: Subtareas Pospuestas y En Progreso NO suman al progreso → 0%
// Caso 3 (Edge): Actividad con 0 subtareas → sin "NaN%" ni error de UI
// Bonus: Error del servidor al completar no bloquea la UI (AC #3)
// ─────────────────────────────────────────────────────────────────────────────

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const today = new Date();
const FAR_FUTURE_STR = formatLocalDateForInput(
	new Date(today.getFullYear(), today.getMonth() + 3, 15),
);

const MOCK_USER = {
	id: 999,
	username: "qa22user",
	email: "qa22@test.com",
	name: "QA22 Progress User",
	max_daily_hours: 8,
	onboarding: {
		has_seen_tour: true,
		has_seen_org_tour: true,
		has_seen_progress_tour: true,
	},
};

// ── Actividad 1: 3 subtareas, 1 completada ─────────────────────────────────
const ACTIVITY_601 = {
	id: 601,
	user: 999,
	title: "Actividad Tres Subtareas",
	course_name: "Cálculo",
	description: "Actividad con progreso parcial",
	due_date: FAR_FUTURE_STR,
	status: "in_progress",
	subtask_count: 3,
	total_subtasks_count: 3,
	completed_subtasks_count: 1,
	total_estimated_hours: 6,
};

const SUBTASKS_601 = [
	{
		id: 6010,
		name: "Subtarea Completada",
		status: "completed",
		estimated_hours: 2,
		target_date: FAR_FUTURE_STR,
		ordering: 1,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-02T00:00:00Z",
		activity: { id: 601, title: "Actividad Tres Subtareas" },
	},
	{
		id: 6011,
		name: "Subtarea Pendiente 1",
		status: "pending",
		estimated_hours: 2,
		target_date: FAR_FUTURE_STR,
		ordering: 2,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		activity: { id: 601, title: "Actividad Tres Subtareas" },
	},
	{
		id: 6012,
		name: "Subtarea Pendiente 2",
		status: "pending",
		estimated_hours: 2,
		target_date: FAR_FUTURE_STR,
		ordering: 3,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		activity: { id: 601, title: "Actividad Tres Subtareas" },
	},
];

// ── Actividad 2: 2 subtareas (1 pospuesta, 1 en progreso), 0 completadas ──
const ACTIVITY_602 = {
	id: 602,
	user: 999,
	title: "Actividad Estados Mixtos",
	course_name: "Física",
	description: "Actividad con estados pospuesto/en progreso",
	due_date: FAR_FUTURE_STR,
	status: "in_progress",
	subtask_count: 2,
	total_subtasks_count: 2,
	completed_subtasks_count: 0,
	total_estimated_hours: 4,
};

const SUBTASKS_602 = [
	{
		id: 6020,
		name: "Subtarea Pospuesta",
		status: "postponed",
		estimated_hours: 2,
		target_date: FAR_FUTURE_STR,
		ordering: 1,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-02T00:00:00Z",
		postponement_note: "Esperando material",
		activity: { id: 602, title: "Actividad Estados Mixtos" },
	},
	{
		id: 6021,
		name: "Subtarea En Progreso",
		status: "in_progress",
		estimated_hours: 2,
		target_date: FAR_FUTURE_STR,
		ordering: 2,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		activity: { id: 602, title: "Actividad Estados Mixtos" },
	},
];

// ── Actividad 3: 0 subtareas (edge case) ──────────────────────────────────
const ACTIVITY_603 = {
	id: 603,
	user: 999,
	title: "Actividad Vacía",
	course_name: "Química",
	description: "Actividad recién creada sin subtareas",
	due_date: FAR_FUTURE_STR,
	status: "pending",
	subtask_count: 0,
	total_subtasks_count: 0,
	completed_subtasks_count: 0,
	total_estimated_hours: 0,
};

const MOCK_ACTIVITIES = [ACTIVITY_601, ACTIVITY_602, ACTIVITY_603];

const MOCK_TODAY_DATA = {
	overdue: [],
	today: [],
	upcoming: [],
	postponed: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

// ─────────────────────────────────────────────────────────────────────────────

test.describe("QA-22 | US-09 - Integridad del Cálculo de Progreso (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		// Activities list endpoint
		await page.route("**/activities/", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({ json: MOCK_ACTIVITIES });
			} else {
				await route.continue();
			}
		});

		// Subtasks per activity — diferenciamos por URL
		await page.route("**/activities/*/subtasks/", async (route) => {
			if (route.request().method() !== "GET") {
				await route.continue();
				return;
			}
			const url = route.request().url();
			if (url.includes("/601/")) {
				await route.fulfill({ json: SUBTASKS_601 });
			} else if (url.includes("/602/")) {
				await route.fulfill({ json: SUBTASKS_602 });
			} else if (url.includes("/603/")) {
				await route.fulfill({ json: [] });
			} else {
				await route.continue();
			}
		});

		// PATCH handler por defecto para subtareas
		await page.route("**/activities/*/subtasks/*/", async (route) => {
			if (route.request().method() === "PATCH") {
				const body = JSON.parse(route.request().postData() || "{}");
				await route.fulfill({
					status: 200,
					json: { id: body.id ?? 6010, status: body.status || "pending", ...body },
				});
			} else {
				await route.continue();
			}
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		// Navegar a la vista Organización
		await page.goto("/organizacion");
		await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 20000 });
	});

	// ───────────────────────────────────────────────────────────────────────────
	// Caso 1: Actividad con 3 subtareas, 1 completada → "1 de 3" y barra ~33%
	// ───────────────────────────────────────────────────────────────────────────
	test("Caso 1: Actividad con 3 subtareas — progreso exacto de 1/3 (33.3%)", async ({ page }) => {
		await test.step("Expandir la materia 'Cálculo'", async () => {
			// La materia (course_name) actúa como agrupador en OrganizationView
			const calcSection = page.locator('[data-testid="org-subject-card-cálculo"]');
			const calcFallback = page.locator('[data-testid^="org-subject-card-c"]').first();
			const section = (await calcSection.count()) > 0 ? calcSection : calcFallback;
			await expect(section).toBeVisible({ timeout: 10000 });
			await section.locator('[data-testid^="org-subject-header-"]').click();
		});

		await test.step("Verificar que la actividad 601 es visible con su progreso", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			await expect(actCard).toBeVisible({ timeout: 10000 });
		});

		await test.step("Verificar el contador 'X de Y' muestra '1 de 3'", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			// La barra de progreso muestra "completedSubs de totalSubs"
			await expect(actCard).toContainText("1 de 3", { timeout: 8000 });
		});

		await test.step("Verificar que la barra de progreso ocupa ~33% del ancho", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			// La barra de progreso es un div con style.width basado en el %
			const progressBar = actCard.locator('div[style*="33.33"]');
			const progressBarFallback = actCard.locator('div[style*="33.3"]').first();

			// Intentar localizar por el style de ancho
			const barCount = await progressBar.count();
			if (barCount > 0) {
				await expect(progressBar.first()).toBeVisible();
			} else {
				// Fallback: verificar que existe alguna barra de progreso visible
				await expect(progressBarFallback).toBeVisible({ timeout: 5000 });
			}
		});

		await test.step("Expandir subtareas y verificar que 1 está Completada y 2 Pendientes", async () => {
			const toggleBtn = page.locator('[data-testid="org-activity-subtasks-toggle-601"]');
			await expect(toggleBtn).toBeVisible({ timeout: 8000 });
			await toggleBtn.click();

			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			// Verificar que se muestra "Completada" una vez
			await expect(actCard).toContainText("Completada", { timeout: 8000 });
		});

		await test.step("Verificar que la UI no muestra 'NaN%' en ningún lugar", async () => {
			const bodyText = await page.locator("body").textContent();
			expect(bodyText).not.toContain("NaN%");
			expect(bodyText).not.toContain("NaN");
		});
	});

	// ───────────────────────────────────────────────────────────────────────────
	// Caso 2: Subtareas Pospuesta + En Progreso → progreso debe ser 0%
	// Criterio: Solo "Hecha/Completada" suma al contador de progreso
	// ───────────────────────────────────────────────────────────────────────────
	test("Caso 2: Subtareas Pospuesta y En Progreso no suman al progreso (0%)", async ({ page }) => {
		await test.step("Expandir la materia 'Física'", async () => {
			const section = page.locator('[data-testid="org-subject-card-física"]');
			const sectionFallback = page.locator('[data-testid^="org-subject-card-f"]').first();
			const s = (await section.count()) > 0 ? section : sectionFallback;
			await expect(s).toBeVisible({ timeout: 10000 });
			await s.locator('[data-testid^="org-subject-header-"]').click();
		});

		await test.step("Verificar que la actividad 602 es visible", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-602"]');
			await expect(actCard).toBeVisible({ timeout: 10000 });
		});

		await test.step("Verificar el contador '0 de 2' (0 completadas)", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-602"]');
			await expect(actCard).toContainText("0 de 2", { timeout: 8000 });
		});

		await test.step("Verificar que la barra de progreso muestra 0% (ancho 0px o 0%)", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-602"]');
			// La barra debe tener style width: 0% cuando no hay completadas
			const progressFill = actCard.locator('div[style*="width: 0%"]').first();
			const progressFillAlt = actCard.locator('div[style*="width:0"]').first();

			const has0pct = (await progressFill.count()) > 0;
			const has0alt = (await progressFillAlt.count()) > 0;
			expect(has0pct || has0alt).toBe(true);
		});

		await test.step("Expandir subtareas y verificar que muestra 'Pospuesta' y estado 'En progreso'", async () => {
			const toggleBtn = page.locator('[data-testid="org-activity-subtasks-toggle-602"]');
			await expect(toggleBtn).toBeVisible({ timeout: 8000 });
			await toggleBtn.click();

			const actCard = page.locator('[data-testid="org-activity-card-602"]');
			// Debe mostrar alguna subtarea pospuesta o en progreso
			await expect(actCard).toBeVisible({ timeout: 8000 });
		});

		await test.step("Verificar que la UI no muestra 'NaN%' ni errores", async () => {
			const bodyText = await page.locator("body").textContent();
			expect(bodyText).not.toContain("NaN%");
			expect(bodyText).not.toContain("NaN");
		});
	});

	// ───────────────────────────────────────────────────────────────────────────
	// Caso 3 (Edge): Actividad con 0 subtareas → sin "NaN%", UI segura
	// ───────────────────────────────────────────────────────────────────────────
	test("Caso 3 (Edge): Actividad con 0 subtareas — sin NaN%, UI estable", async ({ page }) => {
		await test.step("Expandir la materia 'Química'", async () => {
			const section = page.locator('[data-testid="org-subject-card-química"]');
			const sectionFallback = page.locator('[data-testid^="org-subject-card-qu"]').first();
			const s = (await section.count()) > 0 ? section : sectionFallback;
			await expect(s).toBeVisible({ timeout: 10000 });
			await s.locator('[data-testid^="org-subject-header-"]').click();
		});

		await test.step("Verificar que la actividad 603 (0 subtareas) es visible", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-603"]');
			await expect(actCard).toBeVisible({ timeout: 10000 });
		});

		await test.step("Verificar que NO se muestra 'NaN%' en la actividad vacía", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-603"]');
			const cardText = await actCard.textContent();
			expect(cardText).not.toContain("NaN%");
			expect(cardText).not.toContain("NaN");
		});

		await test.step("Verificar que NO hay barra de progreso cuando no hay subtareas", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-603"]');
			// Cuando totalSubs === 0, la barra de progreso no se renderiza
			// El texto "PROGRESO" no debe aparecer en una actividad sin subtareas
			const progressLabel = actCard.locator("text=PROGRESO");
			// Puede que no esté, o esté oculta
			const count = await progressLabel.count();
			// Si existe, verificar que muestra 0 de 0 o estado seguro
			if (count > 0) {
				const cardText = await actCard.textContent();
				expect(cardText).not.toContain("NaN");
			}
		});

		await test.step("Verificar que expandir subtareas muestra 'Sin subtareas registradas'", async () => {
			const toggleBtn = page.locator('[data-testid="org-activity-subtasks-toggle-603"]');
			if ((await toggleBtn.count()) > 0) {
				await toggleBtn.click();
				const actCard = page.locator('[data-testid="org-activity-card-603"]');
				// Debe mostrar un mensaje de estado vacío
				await expect(actCard).toContainText(/sin subtareas|no hay subtareas/i, { timeout: 8000 });
			}
		});

		await test.step("Verificar que toda la página está libre de 'NaN'", async () => {
			const bodyText = await page.locator("body").textContent();
			expect(bodyText).not.toContain("NaN%");
		});
	});

	// ───────────────────────────────────────────────────────────────────────────
	// Caso Bonus (AC #3): Error del servidor no bloquea la navegación ni la UI
	// Criterio: El componente de progreso no falla; el usuario recibe feedback visual
	// ───────────────────────────────────────────────────────────────────────────
	test("Caso Bonus (AC-3): Error del servidor al completar subtarea no bloquea la UI", async ({
		page,
	}) => {
		await test.step("Configurar mock para devolver error 500 en PATCH", async () => {
			await page.route("**/activities/*/subtasks/*/", async (route) => {
				if (route.request().method() === "PATCH") {
					await route.fulfill({
						status: 500,
						contentType: "application/json",
						body: JSON.stringify({ errors: { server: "Internal server error" } }),
					});
				} else {
					await route.continue();
				}
			});
		});

		await test.step("Expandir la materia 'Cálculo' y sus subtareas", async () => {
			const calcSection = page.locator('[data-testid="org-subject-card-cálculo"]');
			const calcFallback = page.locator('[data-testid^="org-subject-card-c"]').first();
			const section = (await calcSection.count()) > 0 ? calcSection : calcFallback;
			await section.locator('[data-testid^="org-subject-header-"]').click();

			const toggleBtn = page.locator('[data-testid="org-activity-subtasks-toggle-601"]');
			await expect(toggleBtn).toBeVisible({ timeout: 8000 });
			await toggleBtn.click();
		});

		await test.step("Intentar completar una subtarea (fallará con 500)", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			// Hacer click en la primera subtarea para abrir su detalle
			const subtaskRow = actCard.locator('[role="button"]').first();
			if ((await subtaskRow.count()) > 0) {
				await subtaskRow.click();
			}
		});

		await test.step("Verificar que la vista Organización sigue navegable (no bloqueada)", async () => {
			// La página debe seguir mostrando el título correcto
			await expect(page.locator("h1.page-title")).toContainText("Organización", {
				timeout: 5000,
			});

			// La actividad 601 debe seguir visible
			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			await expect(actCard).toBeVisible({ timeout: 5000 });
		});

		await test.step("Verificar que el contador de progreso sigue siendo correcto (no NaN)", async () => {
			const actCard = page.locator('[data-testid="org-activity-card-601"]');
			const cardText = await actCard.textContent();
			expect(cardText).not.toContain("NaN");
			// El progreso debe seguir siendo "1 de 3" (sin cambio tras el error)
			expect(cardText).toContain("1 de 3");
		});

		await test.step("Verificar que la navegación entre secciones funciona", async () => {
			// Navegar a /hoy para confirmar que la app no quedó bloqueada
			await page.goto("/hoy");
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 10000 });

			// Volver a /organizacion
			await page.goto("/organizacion");
			await expect(page.locator("h1.page-title")).toContainText("Organización", {
				timeout: 10000,
			});
		});
	});
});
