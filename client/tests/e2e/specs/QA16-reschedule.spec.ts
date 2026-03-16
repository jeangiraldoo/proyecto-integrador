import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const TEST_SUBTASK_NAME = `[QA-16] Mover a Hoy ${Date.now()}`;
// Escaping characters to safely use the name in a Regular Expression
const ESCAPED_TEST_SUBTASK_NAME = TEST_SUBTASK_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Helper to avoid UTC timezone issues when selecting dates
const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-16 | US-6 - Reprogramacion de actividades/subtareas", () => {
	// FIX 1: Aumentamos el límite de tiempo de la prueba a 60 segundos.
	// Los flujos E2E complejos (Crear -> Editar -> Recargar -> Borrar) toman más de 30s.
	test.setTimeout(60000);

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
			const createDialog = page.locator('div[role="dialog"]').filter({ hasText: "Nueva tarea" });
			await expect(createDialog).toBeVisible({ timeout: 5000 });

			// Select the first available activity
			await createDialog.locator("button", { hasText: /Selecciona una actividad/i }).click();
			await page.locator('div[style*="z-index: 10"] button').nth(0).click();

			// Fill subtask name
			await createDialog.locator('input[placeholder*="ej. Revisar"]').fill(TEST_SUBTASK_NAME);

			// Set target date to TOMORROW (so it goes to 'Próximas')
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = formatLocalDateForInput(tomorrow);
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
			// Go to 'Próximas' tab to find our newly created upcoming task
			await page.getByRole("button", { name: /Próximas/i }).click();

			// Click the task to open the side panel
			const myTask = page
				.getByRole("button", { name: new RegExp(ESCAPED_TEST_SUBTASK_NAME) })
				.first();
			await expect(myTask).toBeVisible({ timeout: 20000 });
			await myTask.click();

			// Click the 'Edit' button (pencil icon)
			await page.locator('button[title="Editar"]').click();
			await expect(page.locator("div").filter({ hasText: "Editar tarea" }).first()).toBeVisible();

			// Change date to TODAY
			const dateInput = page.locator('input[type="date"]');
			const todayStr = formatLocalDateForInput(new Date());
			await dateInput.fill(todayStr);

			// Save changes
			await page.getByRole("button", { name: /Guardar cambios/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizada/i, {
				timeout: 8000,
			});

			// Close detail panel so its backdrop does not block tab clicks
			await page.locator('aside[aria-label="Detalle de tarea"] button[title="Cerrar"]').click();
			await expect(page.locator('aside[aria-label="Detalle de tarea"]')).toBeHidden({
				timeout: 5000,
			});

			// FIX 2: Esperamos 500ms para asegurar que la animación de desvanecimiento del fondo
			// oscuro (backdrop) desaparezca completamente y no intercepte el puntero.
			await page.waitForTimeout(500);
		});

		// ====================================================================
		// THEN: Appears in 'Para hoy', page reloads, task stays in 'Para hoy'
		// ====================================================================
		await test.step("Entonces: Subtarea aparece en grupo 'Para hoy', Recarga página, Subtarea sigue en 'Para hoy'", async () => {
			// Subtask appears in 'Para hoy' group
			await page.getByRole("button", { name: /Para hoy/i }).click();
			const taskInToday = page
				.getByRole("button", { name: new RegExp(ESCAPED_TEST_SUBTASK_NAME) })
				.first();
			await expect(taskInToday).toBeVisible();

			// Page reloads (Hard refresh to validate database persistence)
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			// Subtask stays in 'Para hoy' after reloading
			await page.getByRole("button", { name: /Para hoy/i }).click();
			await expect(taskInToday).toBeVisible({ timeout: 5000 });
		});

		// ====================================================================
		// CLEANUP: Remove test data to avoid polluting the database
		// ====================================================================
		await test.step("Cleanup: Remove test subtask", async () => {
			const persistedTask = page
				.getByRole("button", { name: new RegExp(ESCAPED_TEST_SUBTASK_NAME) })
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
