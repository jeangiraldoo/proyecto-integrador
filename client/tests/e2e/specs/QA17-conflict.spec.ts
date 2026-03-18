import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

// Escaping characters to safely use the name in a Regular Expression
const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-17 | US-7 - Detectar conflicto por sobrecarga diaria", () => {
	// Complex E2E flows with reloads and multiple API calls require a higher timeout
	test.setTimeout(90000);

	test.beforeEach(async ({ page }) => {
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		// PRECONDITION: Set daily limit to 6h for the test
		await test.step("Configurar límite diario a 6h", async () => {
			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			await page.locator("#daily-hours-input-floating").fill("6");
			await page.locator(".capacity-inline-save").click();
			await expect(page.locator(".capacity-total")).toContainText("6h", { timeout: 5000 });
		});
	});

	test("E2E & Funcional: Deteccion, cancelacion y resolucion automatica", async ({ page }) => {
		const TIMESTAMP = Date.now();
		const ACTIVITY_NAME = `[QA-17] Actividad ${TIMESTAMP}`;
		const TASK_5H = `T5H ${TIMESTAMP}`;
		const TASK_2H = `T2H ${TIMESTAMP}`;

		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const dayAfter = new Date(today);
		dayAfter.setDate(dayAfter.getDate() + 2);

		const tomorrowStr = formatLocalDateForInput(tomorrow);
		const dayAfterStr = formatLocalDateForInput(dayAfter);

		// ====================================================================
		// GIVEN: Usuario con límite 6h, Día con 5h planificadas
		// ====================================================================
		await test.step("Dado: Usuario con límite 6h y día con 5h planificadas", async () => {
			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 5000 });

			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(dayAfterStr);
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			// Subtask 1: 5h for Tomorrow (Generates the 5h day)
			await modal.locator('input[id="st-title"]').fill(TASK_5H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(tomorrowStr);
			await modal.locator('input[id="st-hours"]').fill("5");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// Subtask 2: 2h for Day After (The one we will move)
			await modal.locator('input[id="st-title"]').fill(TASK_2H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(dayAfterStr);
			await modal.locator('input[id="st-hours"]').fill("2");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.getByRole("button", { name: /Crear actividad/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/creada/i, { timeout: 8000 });
		});

		// ====================================================================
		// WHEN: Reprograma subtarea de 2h al mismo día
		// ====================================================================
		await test.step("Cuando: Reprograma subtarea de 2h al mismo día (genera 7h)", async () => {
			await page.getByRole("button", { name: /Próximas/i }).click();

			// Open 2h Task
			const myTask = page.getByRole("button", { name: new RegExp(escapeRegExp(TASK_2H)) }).first();
			await expect(myTask).toBeVisible({ timeout: 5000 });
			await myTask.click();

			// Click Edit
			await page.locator('button[title="Editar"]').click();

			// Change date to Tomorrow (causing 5h + 2h = 7h > 6h)
			await page.locator('input[type="date"]').last().fill(tomorrowStr);

			// VALIDATE INLINE CONFLICT UI
			await expect(page.getByText(/7h \/ 6h/i).last()).toBeVisible({ timeout: 5000 });
			await expect(page.getByText(/Hay un conflicto de carga/i).last()).toBeVisible();
		});

		// ====================================================================
		// THEN: Si cancela -> no se guarda, mantiene fecha original
		// ====================================================================
		await test.step("Entonces: Si cancela, mantiene fecha original y no guarda cambios", async () => {
			// Click Cancel inside the Edit Modal
			await page
				.getByRole("button", { name: /Cancelar/i })
				.last()
				.click();

			// Close Side Panel properly
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await expect(page.locator('aside[aria-label="Detalle de tarea"]')).toBeHidden({
				timeout: 5000,
			});

			// Reload to verify persistence (or lack thereof)
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			// Verify Conflict Badge is NOT showing danger/red
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).not.toHaveClass(/danger/);
		});

		// ====================================================================
		// FUNCIONAL: Validar Reglas de Negocio Extra (Modal Global y Tarea Hecha)
		// ====================================================================
		await test.step("Funcional: Al guardar aparece Modal de Conflicto. Subtarea 'Hecha' no cuenta.", async () => {
			await page.getByRole("button", { name: /Próximas/i }).click();

			// Re-edit and SAVE to trigger real conflict
			const myTask = page.getByRole("button", { name: new RegExp(escapeRegExp(TASK_2H)) }).first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();
			await page.locator('input[type="date"]').last().fill(tomorrowStr);
			await page
				.getByRole("button", { name: /Guardar cambios/i })
				.last()
				.click();

			// Verify Sidebar Conflict Badge turns red
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).toHaveClass(/danger/, { timeout: 10000 });

			// Verify Global Conflict Modal (As specified in PDF)
			await page.locator(".sidebar-conflicts-btn").click();
			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible();
			await expect(conflictModal).toContainText("7h / 6h max");
			await conflictModal.locator(".cf-close").click();

			// Rule: "Subtarea 'Hecha' no cuenta"
			// Mark the 5h task as Completed. Total pending will be 2h (No conflict)
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click(); // Close current side panel
			const task5H = page.getByRole("button", { name: new RegExp(escapeRegExp(TASK_5H)) }).first();
			await task5H.click();
			await page.getByRole("button", { name: /Marcar como completada/i }).click();

			// Conflict should auto-resolve (badge goes back to normal)
			await expect(conflictCount).not.toHaveClass(/danger/, { timeout: 10000 });
		});

		// ====================================================================
		// CLEANUP
		// ====================================================================
		await test.step("Cleanup: Eliminar subtareas de prueba", async () => {
			// Delete 5H Task
			await page.locator('button[title="Eliminar"]').click();
			await page.getByRole("button", { name: /Sí, eliminar/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
				timeout: 8000,
			});

			// Delete 2H Task
			const t2 = page.getByRole("button", { name: new RegExp(escapeRegExp(TASK_2H)) }).first();
			await t2.click();
			await page.locator('button[title="Eliminar"]').click();
			await page.getByRole("button", { name: /Sí, eliminar/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
				timeout: 8000,
			});
		});
	});
});
