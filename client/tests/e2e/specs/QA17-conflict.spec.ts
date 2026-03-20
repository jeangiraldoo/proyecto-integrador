import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-17 | US-7 - Conflict Detection by Daily Overload", () => {
	test.setTimeout(90000);

	test.beforeEach(async ({ page }) => {
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		// PRECONDITION: Set daily limit to 6h for all tests as requested
		await test.step("Setup: Configure daily limit to 6h", async () => {
			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			await page.locator("#daily-hours-input-floating").fill("6");
			await page.locator(".capacity-inline-save").click();
			await expect(page.locator(".capacity-total")).toContainText("6h", { timeout: 5000 });
		});
	});

	test("Functional Tests: Boundary values and Status rules", async ({ page }) => {
		const TIMESTAMP = Date.now();
		const ACTIVITY_NAME = `QA17_Act_${TIMESTAMP}`;
		const TASK_6H = `T_Exact6h_${TIMESTAMP}`;
		const TASK_01H = `T_Overload_${TIMESTAMP}`;

		const targetDate = new Date();
		targetDate.setDate(targetDate.getDate() + 2); // Day after tomorrow
		const targetDateStr = formatLocalDateForInput(targetDate);

		await test.step("Setup: Navigate to Organization and open Create Modal", async () => {
			await page.getByRole("button", { name: "Organización" }).click();
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 10000 });

			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			await expect(page.locator(".ca-modal")).toBeVisible({ timeout: 5000 });
		});

		// 1. Exactamente igual al límite (6h) -> NO conflicto
		await test.step("Functional Rule #1: Exactly at limit (6h) -> NO conflict", async () => {
			const modal = page.locator(".ca-modal");
			await modal.locator(".ca-combobox-input").fill(`Subject_${TIMESTAMP}`);
			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(targetDateStr);
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			// Add 6h subtask
			await modal.locator('input[id="st-title"]').fill(TASK_6H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(targetDateStr);
			await modal.locator('input[id="st-hours"]').fill("6");

			// UI Validation: The capacity indicator should NOT show conflict styling (red)
			const capacityIndicator = modal.locator(".stm-capacity, .ca-subform-max").or(
				modal
					.locator("div")
					.filter({ hasText: /Capacidad para/i })
					.last(),
			);
			await expect(capacityIndicator).not.toContainText(/conflicto/i);

			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
		});

		// 2. 6.1h -> Sí conflicto
		await test.step("Functional Rule #2: Over limit (6.1h) -> YES conflict", async () => {
			const modal = page.locator(".ca-modal");

			// Add 0.1h subtask to exceed limit
			await modal.locator('input[id="st-title"]').fill(TASK_01H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(targetDateStr);
			await modal.locator('input[id="st-hours"]').fill("0.1");

			// Note: DashboardUtils uses 0.25 steps usually, but we test 0.1 to check decimal handling
			// UI Validation: The capacity indicator MUST show conflict text
			const capacityIndicator = modal
				.locator("div")
				.filter({ hasText: /Hay un conflicto de carga/i })
				.last();
			await expect(capacityIndicator).toBeVisible();

			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await modal.getByRole("button", { name: /Crear actividad/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/creada/i, { timeout: 8000 });
		});

		// 3. Subtarea “Hecha” no cuenta
		await test.step("Functional Rule #3: 'Completed' subtask does not count towards load", async () => {
			await page.getByRole("button", { name: "Hoy" }).click();
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			// Open 6h task and mark as completed
			const task6H = page.locator('[role="button"]').filter({ hasText: TASK_6H }).first();
			await expect(task6H).toBeVisible({ timeout: 5000 });
			await task6H.click();

			await page.getByRole("button", { name: /Marcar como completada/i }).click();
			await expect(page.getByRole("button", { name: /Marcar como pendiente/i })).toBeVisible({
				timeout: 5000,
			});

			// Close panel
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await page.waitForTimeout(500); // Wait for backdrop animation

			// Conflict badge should NOT be red, because 6h is completed, only 0.1h is pending (0.1 < 6)
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).not.toHaveClass(/danger/, { timeout: 8000 });
		});

		// 4. Cambiar límite diario modifica comportamiento
		await test.step("Functional Rule #5: Changing daily limit updates behavior dynamically", async () => {
			// Edit limit to 0.05h (so 0.1h becomes a conflict again)
			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			await page.locator("#daily-hours-input-floating").fill("0.05"); // Very low limit
			await page.locator(".capacity-inline-save").click();

			// Conflict badge SHOULD turn red now
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).toHaveClass(/danger/, { timeout: 8000 });

			// Revert limit to 6h for cleanup
			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			await page.locator("#daily-hours-input-floating").fill("6");
			await page.locator(".capacity-inline-save").click();
		});

		await test.step("Cleanup Functional Tests", async () => {
			await page.getByRole("button", { name: "Organización" }).click();
			const actHeader = page.locator("div").filter({ hasText: ACTIVITY_NAME }).first();
			await actHeader.locator('button[title="Eliminar actividad"]').first().click();
			await page.getByRole("button", { name: /Sí, eliminar/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
				timeout: 8000,
			});
		});
	});

	test("E2E Scenario: Reschedule triggering conflict modal and cancellation persistence", async ({
		page,
	}) => {
		const TIMESTAMP = Date.now();
		const ACTIVITY_NAME = `QA17_E2E_${TIMESTAMP}`;
		const TASK_5H = `T5H_${TIMESTAMP}`;
		const TASK_2H = `T2H_${TIMESTAMP}`;

		const targetDate5h = new Date();
		targetDate5h.setDate(targetDate5h.getDate() + 3);
		const targetDate5hStr = formatLocalDateForInput(targetDate5h);

		const targetDate2h = new Date();
		targetDate2h.setDate(targetDate2h.getDate() + 4);
		const targetDate2hStr = formatLocalDateForInput(targetDate2h);

		// ====================================================================
		// GIVEN: Usuario con límite 6h, Día con 5h planificadas
		// ====================================================================
		await test.step("Dado: Usuario con límite 6h, Día con 5h planificadas", async () => {
			await page.getByRole("button", { name: "Organización" }).click();
			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 5000 });

			await modal.locator(".ca-combobox-input").fill(`Subject_${TIMESTAMP}`);
			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(targetDate2hStr);
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			// Create 5h task on Day 1
			await modal.locator('input[id="st-title"]').fill(TASK_5H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(targetDate5hStr);
			await modal.locator('input[id="st-hours"]').fill("5");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// Create 2h task on Day 2
			await modal.locator('input[id="st-title"]').fill(TASK_2H);
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(targetDate2hStr);
			await modal.locator('input[id="st-hours"]').fill("2");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.getByRole("button", { name: /Crear actividad/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/creada/i, { timeout: 8000 });
		});

		// ====================================================================
		// WHEN: Reprograma subtarea de 2h al mismo día
		// ====================================================================
		await test.step("Cuando: Reprograma subtarea de 2h al mismo día", async () => {
			await page.getByRole("button", { name: "Hoy" }).click();
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			const myTask = page.locator('[role="button"]').filter({ hasText: TASK_2H }).first();
			await expect(myTask).toBeVisible({ timeout: 5000 });
			await myTask.click();

			await page.locator('button[title="Editar"]').click();

			// Reschedule to the day that already has 5h
			await page.locator('input[type="date"]').last().fill(targetDate5hStr);
		});

		// ====================================================================
		// THEN: Modal, valores correctos, cancelación y persistencia
		// ====================================================================
		await test.step("Entonces: Aparece modal de conflicto, Se muestra '7h', Si cancela mantiene fecha, Recarga y no se guarda", async () => {
			// 1. Aparece modal (aviso inline de conflicto)
			const inlineConflict = page
				.locator("div")
				.filter({ hasText: /Hay un conflicto de carga/i })
				.last();
			await expect(inlineConflict).toBeVisible({ timeout: 5000 });

			// 2. Se muestra “7h planificadas (límite 6h)”
			await expect(page.getByText(/7h \/ 6h/i).last()).toBeVisible();

			// 3. Si cancela -> subtarea mantiene fecha original
			await page
				.getByRole("button", { name: /Cancelar/i })
				.last()
				.click();

			// Validar que la fecha en el panel lateral volvió a ser la original (targetDate2hStr)
			// La fecha se formatea como dd/mm/yyyy en la UI de lectura
			const datePillText = formatLocalDateForInput(targetDate2h).split("-").reverse().join("/");
			await expect(page.getByText(datePillText).first()).toBeVisible();

			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
			await page.waitForTimeout(500);

			// 4. Recarga página -> no se guardó cambio
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

			// El badge de conflicto NO debe estar en rojo, porque no guardamos la sobrecarga
			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).not.toHaveClass(/danger/, { timeout: 8000 });
		});

		await test.step("Cleanup E2E Test", async () => {
			await page.getByRole("button", { name: "Organización" }).click();
			const actHeader = page.locator("div").filter({ hasText: ACTIVITY_NAME }).first();
			await actHeader.locator('button[title="Eliminar actividad"]').first().click();
			await page.getByRole("button", { name: /Sí, eliminar/i }).click();
			await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
				timeout: 8000,
			});
		});
	});
});
