import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

/**
 * QA-16 | US-6: Functional Tests for Rescheduling (Reprogramación)
 * As agreed by the team, this file isolates the frontend behavior using API Mocking.
 * It focuses on edge cases, UI validation, and simulated backend errors without polluting the DB.
 */

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

// Calculate dynamic dates for mocking
const today = new Date();
const pastDate = new Date(today);
pastDate.setDate(today.getDate() - 5);
const futureDate = new Date(today);
futureDate.setDate(today.getDate() + 5);

const TODAY_STR = formatLocalDateForInput(today);
const PAST_STR = formatLocalDateForInput(pastDate);
const FUTURE_STR = formatLocalDateForInput(futureDate);

// Static Mock Data strictly for frontend UI mapping
const MOCK_USER = {
	id: 999,
	username: "testuser",
	email: "test@test.com",
	name: "Mock User",
	max_daily_hours: 8,
};

const MOCK_TODAY_DATA = {
	overdue: [],
	today: [
		{
			id: 201,
			name: "Mock Task Today",
			status: "pending",
			course_name: "Física",
			target_date: TODAY_STR,
			estimated_hours: 2,
			activity: { id: 10, title: "Parent Activity" },
		},
	],
	upcoming: [
		{
			id: 202,
			name: "Mock Task Upcoming",
			status: "pending",
			course_name: "Química",
			target_date: FUTURE_STR,
			estimated_hours: 3,
			activity: { id: 11, title: "Parent Activity 2" },
		},
	],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

test.describe("QA-16 | US-6 - Pruebas Funcionales de Reprogramacion (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		// ====================================================================
		// GLOBAL MOCKS FOR STRICT FRONTEND ISOLATION
		// ====================================================================
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER }));
		await page.route("**/activities/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		// Default successful PATCH response for rescheduling tasks
		await page.route("**/activities/*/subtasks/*/", async (route) => {
			if (route.request().method() === "PATCH") {
				await route.fulfill({ status: 200, json: { id: 201, status: "pending" } });
			} else {
				await route.continue();
			}
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("Functional: Escenarios válidos de reprogramación (Futuro y Pasado)", async ({ page }) => {
		await test.step("1. Reprogramar a fecha futura (Mueve de Hoy a Próximas)", async () => {
			await page.getByRole("button", { name: "Hoy" }).click();

			// Open task
			const myTask = page.locator('[role="button"]').filter({ hasText: "Mock Task Today" }).first();
			await expect(myTask).toBeVisible();
			await myTask.click();

			// Edit to Future Date
			await page.locator('button[title="Editar"]').click();
			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(FUTURE_STR);
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			// Validate success and local state update
			await expect(
				page.locator("[data-sonner-toast]").filter({ hasText: /actualizada/i }),
			).toBeVisible();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();

			// Verification: Task should move to "Próximas"
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Mock Task Today" }),
			).toBeVisible();
		});

		await test.step("2. Reprogramar a fecha pasada (Mueve a Vencidas)", async () => {
			// Find the upcoming task
			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task Upcoming" })
				.first();
			await expect(myTask).toBeVisible();
			await myTask.click();

			// Edit to Past Date
			await page.locator('button[title="Editar"]').click();
			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(PAST_STR);
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			await expect(
				page.locator("[data-sonner-toast]").filter({ hasText: /actualizada/i }),
			).toBeVisible();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();

			// Verification: Task should move to "Vencidas"
			await page
				.getByRole("button", { name: /Vencidas/i })
				.first()
				.click();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Mock Task Upcoming" }),
			).toBeVisible();
		});
	});

	test("Functional: Casos de Error (Fecha inválida y Permisos Backend)", async ({ page }) => {
		await test.step("1. Fecha inválida (Validación HTML5 / Frontend)", async () => {
			const myTask = page.locator('[role="button"]').filter({ hasText: "Mock Task Today" }).first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			const dateInput = editModal.locator('input[type="date"]');

			// Fill with empty/invalid date
			await dateInput.fill("");
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			// Expect HTML5/Frontend validation or internal error state
			// The modal should NOT close if validation fails
			await expect(editModal).toBeVisible();
			await editModal.getByRole("button", { name: /Cancelar/i }).click();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
		});

		await test.step("2. Subtarea de otro usuario (Simulación de error 404 del Backend)", async () => {
			// MOCK OVERRIDE: Simulate backend rejecting the PATCH request because the task belongs to another user
			await page.route("**/activities/*/subtasks/*/", async (route) => {
				if (route.request().method() === "PATCH") {
					await route.fulfill({
						status: 404,
						contentType: "application/json",
						body: JSON.stringify({
							errors: { resource: "Subtask not found or does not belong to you." },
						}),
					});
				}
			});

			const myTask = page.locator('[role="button"]').filter({ hasText: "Mock Task Today" }).first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(FUTURE_STR);
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			// Verification: The frontend must display an error toast and NOT close the modal
			const toastError = page.locator("[data-sonner-toast]").filter({ hasText: /Error/i }).first();
			await expect(toastError).toBeVisible({ timeout: 5000 });
			await expect(editModal).toBeVisible(); // Modal stays open to let user correct or cancel
		});
	});

	test("Functional: Mantener filtros activos tras reprogramar", async ({ page }) => {
		await test.step("1. Aplicar un filtro y reprogramar", async () => {
			// Apply filter: Course = Física
			await page.getByRole("button", { name: /Curso:/i }).click();
			const dropdown = page.locator('div[style*="z-index: 9999"]').first();
			await dropdown.getByRole("button", { name: /Física/i }).click();

			// Go to upcoming
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			// Edit task
			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task Upcoming" })
				.first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');

			// Change estimated hours instead of date to keep it in the same tab for visibility
			await editModal.locator('input[type="number"]').fill("5");
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			await expect(
				page.locator("[data-sonner-toast]").filter({ hasText: /actualizada/i }),
			).toBeVisible();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();

			// Verification: The filter MUST remain active
			await expect(page.getByRole("button", { name: "Curso: Física" }).first()).toBeVisible();
		});
	});
});
