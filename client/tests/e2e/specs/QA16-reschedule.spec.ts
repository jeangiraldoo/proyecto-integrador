import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const TEST_SUBTASK_NAME = `[QA-16] Tarea E2E ${Date.now()}`;

test.describe("QA-16 | US-6 - Reprogramacion de actividades/subtareas", () => {
	test.beforeEach(async ({ page }) => {
		// Wait for authentication and ensure the Today view is fully loaded
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("E2E Test: Reschedule an upcoming subtask to today and validate persistence", async ({
		page,
	}) => {
		// ====================================================================
		// GIVEN: Upcoming subtask & Authenticated User
		// ====================================================================
		await test.step("Dado: Subtarea próxima y Usuario autenticado", async () => {
			// Create a subtask for tomorrow to satisfy the "Upcoming subtask" precondition
			await page.getByRole("button", { name: /Nueva tarea/i }).click();
			const createDialog = page.locator('div[role="dialog"]').filter({ hasText: /Nueva tarea/i });
			await expect(createDialog).toBeVisible({ timeout: 5000 });

			// Select the first available activity
			await createDialog.getByRole("button", { name: /Selecciona una actividad/i }).click();
			const dropdown = page.locator('div[style*="z-index: 10"]').first();
			await dropdown.locator("button").first().click();

			// Fill subtask name
			await createDialog.locator('input[placeholder*="ej. Revisar"]').fill(TEST_SUBTASK_NAME);

			// Set target date to TOMORROW (so it goes to 'Próximas')
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = tomorrow.toISOString().split("T")[0];
			await createDialog.locator('input[type="date"]').fill(tomorrowStr);

			// Set estimated hours
			await createDialog.locator('input[type="number"]').fill("2");

			// Save and wait for creation toast
			await createDialog.getByRole("button", { name: /Crear tarea/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/Tarea creada/i, {
				timeout: 8000,
			});
		});

		// ====================================================================
		// WHEN: Enters /hoy, changes date to today, saves
		// ====================================================================
		await test.step("Cuando: Entra a /hoy, Cambia fecha a hoy, Guarda", async () => {
			// FIX: Using regex /Próximas/i to ignore dynamic numbers inside the tab button
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			// FIX: Searching the task card by role="button" instead of a CSS class, which is 100% stable
			const myTask = page.locator('[role="button"]').filter({ hasText: TEST_SUBTASK_NAME }).first();
			await expect(myTask).toBeVisible({ timeout: 5000 });
			await myTask.click();

			// Click the 'Edit' button (pencil icon)
			await page.locator('button[title="Editar"]').click();
			await expect(
				page
					.locator("div")
					.filter({ hasText: /Editar tarea/i })
					.first(),
			).toBeVisible();

			// Change date to TODAY
			const dateInput = page.locator('input[type="date"]');
			const todayStr = new Date().toISOString().split("T")[0];
			await dateInput.fill(todayStr);

			// Save changes
			await page.getByRole("button", { name: /Guardar cambios/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizada/i, {
				timeout: 8000,
			});
		});

		// ====================================================================
		// THEN: Appears in 'Para hoy', page reloads, task stays in 'Para hoy'
		// ====================================================================
		await test.step("Entonces: Subtarea aparece en grupo 'Para hoy', Recarga página, Subtarea sigue en 'Para hoy'", async () => {
			// Go to 'Para hoy'
			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();

			const taskInToday = page
				.locator('[role="button"]')
				.filter({ hasText: TEST_SUBTASK_NAME })
				.first();
			await expect(taskInToday).toBeVisible();

			// Page reloads (Hard refresh to validate database persistence)
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			// Subtask stays in 'Para hoy' after reloading
			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();
			await expect(
				page.locator('[role="button"]').filter({ hasText: TEST_SUBTASK_NAME }).first(),
			).toBeVisible({ timeout: 5000 });
		});

		// ====================================================================
		// CLEANUP: Remove test data to avoid polluting the database
		// ====================================================================
		await test.step("Cleanup: Remove test subtask", async () => {
			const persistedTask = page
				.locator('[role="button"]')
				.filter({ hasText: TEST_SUBTASK_NAME })
				.first();
			await persistedTask.click();

			await page.locator('button[title="Eliminar"]').click();
			await expect(page.getByText(/¿Eliminar tarea\?/i)).toBeVisible();
			await page.getByRole("button", { name: /Sí, eliminar/i }).click();

			await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
				timeout: 8000,
			});
		});
	});
});
