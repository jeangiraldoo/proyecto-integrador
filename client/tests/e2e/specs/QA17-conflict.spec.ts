import { test, expect } from "@playwright/test";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-17 | US-7 - Detectar conflicto por sobrecarga diaria", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		const timestamp = Date.now();

		await page.goto("/registro", { timeout: 120000 });

		await page.locator('input[name="username"]').fill(`qa17_${timestamp}`);
		await page.locator('input[name="email"]').fill(`qa17_${timestamp}@test.com`);
		await page.locator('input[name="password"]').fill("SuperPassword123!");
		await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");

		await page.locator('button[type="submit"]').click();

		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 120000 });

		await test.step("Configurar límite diario a 6h", async () => {
			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			const inputLimit = page.locator("#daily-hours-input-floating");
			await inputLimit.fill("6");
			await page.locator(".capacity-inline-save").click();
			await expect(page.locator(".capacity-total")).toContainText("6h", { timeout: 5000 });
			await page.waitForTimeout(1000);
		});
	});

	test("E2E Test: Deteccion, cancelacion y resolucion automatica", async ({ page }) => {
		const TIMESTAMP = Date.now();
		const SUBJECT_NAME = `QA17_Materia_${TIMESTAMP}`;
		const ACTIVITY_NAME = `QA17_Actividad_${TIMESTAMP}`;
		const TASK_5H = `QA17_T5H_${TIMESTAMP}`;
		const TASK_2H = `QA17_T2H_${TIMESTAMP}`;

		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const dayAfter = new Date(today);
		dayAfter.setDate(dayAfter.getDate() + 2);

		const tomorrowStr = formatLocalDateForInput(tomorrow);
		const dayAfterStr = formatLocalDateForInput(dayAfter);

		await test.step("Dado: Usuario con límite 6h y día con 5h planificadas", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 10000 });

			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 5000 });

			await modal.locator(".ca-combobox-input").fill(SUBJECT_NAME);
			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(dayAfterStr);
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			await modal.locator('input[id="st-title"]').fill(TASK_5H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(tomorrowStr);
			await modal.locator('input[id="st-hours"]').fill("5");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText(TASK_5H)).toBeVisible({
				timeout: 5000,
			});

			await modal.locator('input[id="st-title"]').fill(TASK_2H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(dayAfterStr);
			await modal.locator('input[id="st-hours"]').fill("2");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText(TASK_2H)).toBeVisible({
				timeout: 5000,
			});

			await modal.getByRole("button", { name: /Crear actividad/i }).click();
			const toastCreada = page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /creada/i })
				.first();
			await expect(toastCreada).toBeVisible({ timeout: 8000 });
		});

		await test.step("Cuando: Reprograma subtarea de 2h al mismo día (genera 7h)", async () => {
			await page.getByRole("button", { name: "Hoy" }).click({ force: true });
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			const myTask = page.locator('[role="button"]').filter({ hasText: TASK_2H }).first();
			await expect(myTask).toBeVisible({ timeout: 15000 });
			await myTask.click();

			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			await expect(editModal).toBeVisible({ timeout: 5000 });

			const inputDate = editModal.locator('input[type="date"]');
			await inputDate.fill(tomorrowStr);

			await expect(editModal.locator("strong")).toContainText("7h", { timeout: 5000 });
			await expect(editModal.locator("strong")).toContainText("6h");
			await expect(editModal).toContainText(/Hay un conflicto de carga/i);
		});

		await test.step("Entonces: Si cancela, mantiene fecha original y no guarda cambios", async () => {
			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.getByRole("button", { name: /Cancelar/i }).click();

			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await expect(page.locator('aside[aria-label="Detalle de tarea"]')).toBeHidden({
				timeout: 5000,
			});
			await page.waitForTimeout(800);

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).not.toHaveClass(/danger/);
		});

		await test.step("Funcional: Al guardar aparece Conflicto. Subtarea 'Hecha' lo resuelve.", async () => {
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			const myTask = page.locator('[role="button"]').filter({ hasText: TASK_2H }).first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			await expect(editModal).toBeVisible({ timeout: 5000 });
			await editModal.locator('input[type="date"]').fill(tomorrowStr);
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			await expect(editModal).toBeHidden({ timeout: 5000 });
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await expect(page.locator('aside[aria-label="Detalle de tarea"]')).toBeHidden({
				timeout: 5000,
			});

			await page.waitForTimeout(1000);
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).toHaveClass(/danger/, { timeout: 15000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible({ timeout: 5000 });
			await expect(conflictModal).toContainText("7h");
			await expect(conflictModal).toContainText("6h max");
			await conflictModal.locator(".cf-close").click();
			await expect(conflictModal).toBeHidden({ timeout: 5000 });

			const task5H = page.locator('[role="button"]').filter({ hasText: TASK_5H }).first();
			await task5H.scrollIntoViewIfNeeded();
			await task5H.click();

			await expect(page.locator('aside[role="dialog"]')).toBeVisible({ timeout: 10000 });
			await page.getByRole("button", { name: /Marcar como completada/i }).click();
			await expect(page.getByRole("button", { name: /Marcar como pendiente/i })).toBeVisible({
				timeout: 5000,
			});

			await expect(conflictCount).not.toHaveClass(/danger/, { timeout: 15000 });
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
		});

		await test.step("Cleanup: Eliminar actividad completa para limpiar BD", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 15000 });

			await page.getByText(SUBJECT_NAME).click();

			const activityBlock = page.locator("div").filter({ hasText: ACTIVITY_NAME }).first();

			await expect(activityBlock).toBeVisible({ timeout: 5000 });

			await activityBlock.locator('button[title="Eliminar actividad"]').first().click();

			await page.getByRole("button", { name: /Sí, eliminar/i }).click();

			const toastEliminada = page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /eliminada/i })
				.first();
			await expect(toastEliminada).toBeVisible({ timeout: 8000 });
		});
	});
});
