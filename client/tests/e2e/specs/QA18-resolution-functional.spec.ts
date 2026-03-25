import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

/**
 * QA-18 | US-8: Functional Tests for Conflict Resolution
 * As agreed by the team (Santiago, Jean, Andres), this file strictly isolates the frontend behavior using API Mocking.
 * It tests every resolution outcome (success, persisting conflict, cancellation) directly from the Global Conflict Modal.
 */

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const TODAY_STR = formatLocalDateForInput(today);
const TOMORROW_STR = formatLocalDateForInput(tomorrow);

// ---------------------------------------------------------------------------
// BASE MOCK DATA
// ---------------------------------------------------------------------------
const MOCK_USER_6H = {
	id: 999,
	username: "qa18_user",
	email: "qa18@test.com",
	name: "Mock User",
	max_daily_hours: 6,
};

// We simulate a day that has 8h planned (4h + 4h), exceeding the 6h limit
const MOCK_ACTIVITIES = [
	{
		id: 888,
		title: "Actividad Compleja",
		course_name: "Testing QA",
		subtasks: [
			{
				id: 101,
				name: "Tarea Pesada",
				status: "pending",
				estimated_hours: 4,
				target_date: TODAY_STR,
			},
			{
				id: 102,
				name: "Tarea Ligera",
				status: "pending",
				estimated_hours: 4,
				target_date: TODAY_STR,
			},
		],
	},
];

const MOCK_TODAY_DATA = {
	overdue: [],
	today: MOCK_ACTIVITIES[0].subtasks,
	upcoming: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

const INITIAL_CONFLICT = {
	id: 500,
	affected_date: TODAY_STR,
	planned_hours: 8,
	max_allowed_hours: 6,
	status: "pending",
};

test.describe("QA-18 | US-8 - Pruebas Funcionales de Resolución de Conflictos (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		// ====================================================================
		// GLOBAL MOCKS TO INJECT AN ACTIVE CONFLICT STATE
		// ====================================================================
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER_6H }));
		await page.route("**/activities/**", (route) => route.fulfill({ json: MOCK_ACTIVITIES }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		// By default, the backend reports an 8h conflict for today
		await page.route("**/conflicts/**", (route) => {
			if (route.request().method() === "GET") {
				route.fulfill({ json: [INITIAL_CONFLICT] });
			} else {
				route.continue();
			}
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("Functional: Resolver reduciendo -> éxito y Persistencia (con Regla de Prioridad)", async ({
		page,
	}) => {
		await test.step("1. Abrir Modal de Conflictos y reducir horas a un nivel seguro", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible();

			// MOCK OVERRIDE: Simulate successful PATCH
			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("2");
			await resolverLayer.getByRole("button", { name: /Guardar horas/i }).click();

			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada|actualizada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);
		});

		await test.step("2. Persistencia tras recargar y Regla de Prioridad (AC #3)", async () => {
			// Criterio #3: "No rompe reglas de prioridad".
			// MOCK OVERRIDE: We feed the frontend the tasks out of order.
			// Since "Tarea Pesada" is now 2h and "Tarea Ligera" is 4h, the frontend MUST sort "Tarea Pesada" first.
			await page.route("**/today/**", (route) =>
				route.fulfill({
					json: {
						...MOCK_TODAY_DATA,
						today: [
							MOCK_TODAY_DATA.today[1], // Tarea Ligera (4h)
							{ ...MOCK_TODAY_DATA.today[0], estimated_hours: 2 }, // Tarea Pesada (2h)
						],
					},
				}),
			);

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);

			// Assert priority: 'Tarea Pesada' (2h) should be placed above 'Tarea Ligera' (4h)
			const cards = page.locator(".col-title");
			await expect(cards.nth(0)).toHaveText("Tarea Pesada");
			await expect(cards.nth(1)).toHaveText("Tarea Ligera");
		});
	});

	test("Functional: Resolver reduciendo -> conflicto persiste", async ({ page }) => {
		await test.step("1. Reducir horas pero mantener un estado de sobrecarga", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			// MOCK OVERRIDE: Simulate successful PATCH, but conflict STILL exists (7h > 6h)
			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, planned_hours: 7 }],
				}),
			);

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("3");
			await resolverLayer.getByRole("button", { name: /Guardar horas/i }).click();

			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			await expect(conflictModal.getByText("7h / 6h max")).toBeVisible();
		});
	});

	test("Functional: Resolver moviendo -> éxito", async ({ page }) => {
		await test.step("1. Cambiar fecha a un día libre", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Cambiar fecha/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="date"]').fill(TOMORROW_STR);
			await resolverLayer.getByRole("button", { name: /Guardar fecha/i }).click();

			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);
		});
	});

	test("Functional: Resolver moviendo -> conflicto persiste", async ({ page }) => {
		await test.step("1. Cambiar fecha a un día que también está sobrecargado", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			// MOCK OVERRIDE: Moving task generated a NEW conflict tomorrow
			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, affected_date: TOMORROW_STR, planned_hours: 9 }],
				}),
			);

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Cambiar fecha/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="date"]').fill(TOMORROW_STR);
			await resolverLayer.getByRole("button", { name: /Guardar fecha/i }).click();

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			await expect(conflictModal.getByText("9h / 6h max")).toBeVisible();
		});
	});

	test("Functional: Cancelar -> no hay cambios y Data Isolation", async ({ page }) => {
		await test.step("1. Cancelar mantiene los datos intactos", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Ligera" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("1");

			await resolverLayer.getByRole("button", { name: /Cancelar/i }).click();

			await expect(resolverLayer).toBeHidden();
			await expect(conflictModal.getByText("8h / 6h max")).toBeVisible();
		});

		await test.step("2. No afecta subtareas de otros usuarios (Data Isolation)", async () => {
			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, affected_date: "2099-01-01" }],
				}),
			);

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			await expect(
				conflictModal.getByText(/No se encontraron subtareas detalladas para esta fecha/i),
			).toBeVisible();
		});
	});
});
