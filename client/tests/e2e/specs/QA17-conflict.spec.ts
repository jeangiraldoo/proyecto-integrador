import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-17 | US-7 - Detectar conflicto por sobrecarga diaria", () => {
	// Timeout extendido porque este flujo E2E es el más largo y complejo del sistema
	test.setTimeout(90000);

	test.beforeEach(async ({ page }) => {
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		// PRECONDITION: Set daily limit to 6h for the test
		await test.step("Configurar límite diario a 6h", async () => {
			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			const inputLimit = page.locator("#daily-hours-input-floating");
			await inputLimit.fill("6");
			await page.locator(".capacity-inline-save").click();
			// Esperar a que el límite se refleje en el sidebar
			await expect(page.locator(".capacity-total")).toContainText("6h", { timeout: 5000 });
		});
	});

	test("E2E & Funcional: Deteccion, cancelacion y resolucion automatica", async ({ page }) => {
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

		// ====================================================================
		// GIVEN: Usuario con límite 6h, Día con 5h planificadas
		// ====================================================================
		await test.step("Dado: Usuario con límite 6h y día con 5h planificadas", async () => {
			// FIX CRÍTICO: Navegar a Organización antes de buscar el botón
			await page.getByRole("button", { name: "Organización" }).click();
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 10000 });

			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 5000 });

			// Fill Activity Data
			await modal.locator(".ca-combobox-input").fill(SUBJECT_NAME);
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
			// Regresamos a la vista Hoy
			await page.getByRole("button", { name: "Hoy" }).click();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 10000 });

			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			// Abrir Tarea de 2H
			const myTask = page.locator('[role="button"]').filter({ hasText: TASK_2H }).first();
			await expect(myTask).toBeVisible({ timeout: 5000 });
			await myTask.click();

			// Clic en Editar
			await page.locator('button[title="Editar"]').click();

			// Cambiar fecha a Mañana (causando 5h + 2h = 7h > 6h)
			const inputsDate = page.locator('input[type="date"]');
			await inputsDate.last().fill(tomorrowStr);

			// VALIDAR UI DE CONFLICTO (Criterio del PDF)
			await expect(page.getByText(/7h \/ 6h/i).last()).toBeVisible({ timeout: 5000 });
			await expect(page.getByText(/Hay un conflicto de carga/i).last()).toBeVisible();
		});

		// ====================================================================
		// THEN: Si cancela -> no se guarda, mantiene fecha original
		// ====================================================================
		await test.step("Entonces: Si cancela, mantiene fecha original y no guarda cambios", async () => {
			// Clic en Cancelar en el Modal de Edición
			await page
				.getByRole("button", { name: /Cancelar/i })
				.last()
				.click();

			// Cerrar el panel lateral correctamente
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await expect(page.locator('aside[aria-label="Detalle de tarea"]')).toBeHidden({
				timeout: 5000,
			});
			await page.waitForTimeout(500); // Esperar desvanecimiento

			// Recargar para verificar persistencia de la cancelación
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			// Verificar que el badge de conflicto en el sidebar NO está en rojo
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).not.toHaveClass(/danger/);
		});

		// ====================================================================
		// FUNCIONAL: Guardar conflicto, validar modal global y autolimpiar
		// ====================================================================
		await test.step("Funcional: Al guardar aparece Conflicto. Subtarea 'Hecha' lo resuelve.", async () => {
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			// Volver a editar y GUARDAR para generar el conflicto real
			const myTask = page.locator('[role="button"]').filter({ hasText: TASK_2H }).first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();
			await page.locator('input[type="date"]').last().fill(tomorrowStr);
			await page
				.getByRole("button", { name: /Guardar cambios/i })
				.last()
				.click();

			// Verificar que el badge del sidebar se puso rojo
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).toHaveClass(/danger/, { timeout: 10000 });

			// Verificar Modal Global de Conflictos (Como pide el PDF)
			await page.locator(".sidebar-conflicts-btn").click();
			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible();
			await expect(conflictModal).toContainText("7h / 6h max");
			await conflictModal.locator(".cf-close").click();

			// REGLA: "Subtarea 'Hecha' no cuenta"
			// Marcaremos la tarea de 5H como completada. Eso dejará solo 2H pendientes (Se quita el conflicto)
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await page.waitForTimeout(500);

			const task5H = page.locator('[role="button"]').filter({ hasText: TASK_5H }).first();
			await task5H.click();
			await page.getByRole("button", { name: /Marcar como completada/i }).click();

			// Esperamos a que el botón cambie a pendiente para confirmar que el guardado fue exitoso
			await expect(page.getByRole("button", { name: /Marcar como pendiente/i })).toBeVisible({
				timeout: 5000,
			});

			// El conflicto debió autodesaparecer (el badge pierde la clase 'danger')
			await expect(conflictCount).not.toHaveClass(/danger/, { timeout: 10000 });

			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
		});

		// ====================================================================
		// CLEANUP: Borramos la actividad completa desde la vista Organización
		// ====================================================================
		await test.step("Cleanup: Eliminar actividad completa para limpiar BD", async () => {
			// Navegar a Organización
			await page.getByRole("button", { name: "Organización" }).click();

			// Buscar la fila de la actividad y hacer clic en su botón de eliminar (basura)
			const actHeader = page.locator("div").filter({ hasText: ACTIVITY_NAME }).first();
			await actHeader.locator('button[title="Eliminar actividad"]').first().click();

			// Confirmar eliminación en el modal de advertencia
			await page.getByRole("button", { name: /Sí, eliminar/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
				timeout: 8000,
			});
		});
	});
});
