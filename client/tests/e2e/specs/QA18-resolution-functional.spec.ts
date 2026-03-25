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

	test("Functional: Resolver reduciendo -> éxito y Persistencia", async ({ page }) => {
		await test.step("1. Abrir Modal de Conflictos y reducir horas a un nivel seguro", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible();

			// MOCK OVERRIDE: Simulate successful PATCH and subsequent conflict resolution (Empty conflicts array)
			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] })); // Conflict resolved!

			// Select the first task in the modal
			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			// Fill 2h (Reducing from 4h to 2h makes total 6h -> Within limits)
			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("2");
			await resolverLayer.getByRole("button", { name: /Guardar horas/i }).click();

			// The UI should close the modal and show success toast
			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada|actualizada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });

			// Criterio de Aceptación 1: Conflicto desaparece correctamente
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);
		});

		await test.step("2. Persistencia tras recargar", async () => {
			// Criterio de Aceptación 2 & 6: Persistencia tras recargar (Mocked Reload)
			// Because we maintain the mock returning [] for conflicts, it validates the UI respects the backend state
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);
		});
	});

	test("Functional: Resolver reduciendo -> conflicto persiste", async ({ page }) => {
		await test.step("1. Reducir horas pero mantener un estado de sobrecarga", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			// MOCK OVERRIDE: Simulate successful PATCH, but the conflict STILL exists (e.g. reduced to 3h, total 7h > 6h)
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

			// The UI should update the conflict modal to reflect the new math: 7h / 6h
			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });

			// Open Modal again to verify the mathematical update
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			await expect(conflictModal.getByText("7h / 6h max")).toBeVisible();
		});
	});

	test("Functional: Resolver moviendo -> éxito", async () => {
		await test.step("1. Cambiar fecha a un día libre", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			// MOCK OVERRIDE: Conflict is resolved because the task was moved
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

			// MOCK OVERRIDE: Moving the task resolved today's conflict, but generated a NEW conflict tomorrow
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

			// The new conflict should reflect in the UI automatically
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
			await resolverLayer.locator('input[type="number"]').fill("1"); // Type a change

			// Click Cancel
			await resolverLayer.getByRole("button", { name: /Cancelar/i }).click();

			// Verify the modal closed but the conflict remains exactly 8h / 6h
			await expect(resolverLayer).toBeHidden();
			await expect(conflictModal.getByText("8h / 6h max")).toBeVisible();
		});

		await test.step("2. No afecta subtareas de otros usuarios (Data Isolation)", async () => {
			// If the backend accidentally returns a conflict for a date where the user has NO tasks
			// (meaning the conflict belongs to someone else but leaked), the UI handles it gracefully.
			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, affected_date: "2099-01-01" }],
				}),
			);

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			// According to ConflictModal.tsx line 440, it should show an empty state message
			await expect(
				conflictModal.getByText(/No se encontraron subtareas detalladas para esta fecha/i),
			).toBeVisible();
		});
	});
});
