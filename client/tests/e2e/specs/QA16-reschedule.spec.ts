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
	test.setTimeout(60000);

	test.beforeEach(async ({ page }) => {
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("E2E Test: Reprogramar una subtarea próxima para hoy y validar su persistencia", async ({
		page,
	}) => {
		await test.step("Dado: Subtarea próxima y Usuario autenticado", async () => {
			await page.getByRole("button", { name: /Nueva tarea/i }).click();
			const createDialog = page.locator('div[role="dialog"]').filter({ hasText: "Nueva tarea" });
			await expect(createDialog).toBeVisible({ timeout: 5000 });

			await createDialog.locator("button", { hasText: /Selecciona una actividad/i }).click();
			await page.locator('div[style*="z-index: 10"] button').nth(0).click();

			await createDialog.locator('input[placeholder*="ej. Revisar"]').fill(TEST_SUBTASK_NAME);

			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowStr = formatLocalDateForInput(tomorrow);
			await createDialog.locator('input[type="date"]').fill(tomorrowStr);

			await createDialog.locator('input[type="number"]').fill("2");

			await createDialog.getByRole("button", { name: /Crear tarea/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/Tarea creada/i, {
				timeout: 8000,
			});
		});

		await test.step("Cuando: Entra a /hoy, Cambia fecha a hoy, Guarda", async () => {
			await page.getByRole("button", { name: /Próximas/i }).click();

			const myTask = page
				.getByRole("button", { name: new RegExp(ESCAPED_TEST_SUBTASK_NAME) })
				.first();
			await expect(myTask).toBeVisible({ timeout: 20000 });
			await myTask.click();

			await page.locator('button[title="Editar"]').click();
			await expect(page.locator("div").filter({ hasText: "Editar tarea" }).first()).toBeVisible();

			const dateInput = page.locator('input[type="date"]');
			const todayStr = formatLocalDateForInput(new Date());
			await dateInput.fill(todayStr);

			await page.getByRole("button", { name: /Guardar cambios/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizada/i, {
				timeout: 8000,
			});

			await page.locator('aside[aria-label="Detalle de tarea"] button[title="Cerrar"]').click();
			await expect(page.locator('aside[aria-label="Detalle de tarea"]')).toBeHidden({
				timeout: 5000,
			});

			await page.waitForTimeout(500);
		});

		await test.step("Entonces: Subtarea aparece en grupo 'Para hoy', Recarga página, Subtarea sigue en 'Para hoy'", async () => {
			await page.getByRole("button", { name: /Para hoy/i }).click();
			const taskInToday = page
				.getByRole("button", { name: new RegExp(ESCAPED_TEST_SUBTASK_NAME) })
				.first();
			await expect(taskInToday).toBeVisible();

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			await page.getByRole("button", { name: /Para hoy/i }).click();
			await expect(taskInToday).toBeVisible({ timeout: 5000 });
		});

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
