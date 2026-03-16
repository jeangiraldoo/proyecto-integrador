import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const TEST_SUBTASK_NAME = `[QA-16] Mover a Hoy ${Date.now()}`;

test.describe("QA-16 | US-6 - Reprogramacion de actividades/subtareas", () => {
	test.beforeEach(async ({ page }) => {
		// Autenticación y estabilización de la vista (soluciona el timeout en Firefox)
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("Debe reprogramar una tarea de 'Proximas' a 'Para hoy' y mantener persistencia real", async ({
		page,
	}) => {
		// ====================================================================
		// FASE 1: PREPARACIÓN (Crear una tarea para el futuro)
		// Evitamos el "1 skipped" creando nuestra propia data de prueba
		// ====================================================================

		await page.getByRole("button", { name: /Nueva tarea/i }).click();
		const createDialog = page.locator('div[role="dialog"]').filter({ hasText: "Nueva tarea" });
		await expect(createDialog).toBeVisible({ timeout: 5000 });

		// Seleccionar la primera actividad disponible en el combobox
		await createDialog.locator("button", { hasText: /Selecciona una actividad/i }).click();
		await page.locator('div[style*="z-index: 10"] button').nth(0).click(); // Clic a la primera

		// Llenar el nombre
		await createDialog.locator('input[placeholder*="ej. Revisar"]').fill(TEST_SUBTASK_NAME);

		// Poner fecha de MAÑANA (Para que caiga en "Próximas")
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = tomorrow.toISOString().split("T")[0];
		await createDialog.locator('input[type="date"]').fill(tomorrowStr);

		// Poner 2 horas estimadas
		await createDialog.locator('input[type="number"]').fill("2");

		// Guardar
		await createDialog.getByRole("button", { name: /Crear tarea/i }).click();
		await expect(page.locator("[data-sonner-toast]")).toContainText(/Tarea creada/i, {
			timeout: 8000,
		});

		// ====================================================================
		// FASE 2: REPROGRAMACIÓN (El núcleo de la US-6 y el PDF)
		// ====================================================================

		// Vamos a la pestaña Próximas
		await page.getByRole("button", { name: "Próximas" }).click();

		// Encontramos nuestra tarea recién creada y le damos clic para abrir el panel
		const miTarea = page.locator(".col-title").filter({ hasText: TEST_SUBTASK_NAME }).first();
		await expect(miTarea).toBeVisible({ timeout: 5000 });
		await miTarea.click();

		// Clic en el botón "Editar" (el lápiz)
		await page.locator('button[title="Editar"]').click();
		await expect(page.locator("div").filter({ hasText: "Editar tarea" }).first()).toBeVisible();

		// Cambiar fecha a HOY
		const dateInput = page.locator('input[type="date"]');
		const todayStr = new Date().toISOString().split("T")[0];
		await dateInput.fill(todayStr);

		// Guardar cambios
		await page.getByRole("button", { name: /Guardar cambios/i }).click();
		await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizada/i, {
			timeout: 8000,
		});

		// ====================================================================
		// FASE 3: VALIDACIÓN DE PERSISTENCIA (Gating del Sprint 3)
		// ====================================================================

		// Verificamos que se movió a "Para hoy"
		await page.getByRole("button", { name: "Para hoy" }).click();
		await expect(
			page.locator(".col-title").filter({ hasText: TEST_SUBTASK_NAME }).first(),
		).toBeVisible();

		// RECARGAMOS LA PÁGINA (Prueba de Fuego de Persistencia de la BD)
		await page.reload();
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		// Volvemos a verificar en "Para hoy"
		await page.getByRole("button", { name: "Para hoy" }).click();
		const tareaPersistida = page
			.locator(".col-title")
			.filter({ hasText: TEST_SUBTASK_NAME })
			.first();
		await expect(tareaPersistida).toBeVisible({ timeout: 5000 });

		// ====================================================================
		// FASE 4: LIMPIEZA (Borrar la tarea para no ensuciar la base de datos)
		// ====================================================================

		await tareaPersistida.click();
		await page.locator('button[title="Eliminar"]').click();
		await expect(page.getByText(/¿Eliminar tarea\?/i)).toBeVisible();
		await page.getByRole("button", { name: /Sí, eliminar/i }).click();

		await expect(page.locator("[data-sonner-toast]")).toContainText(/eliminada/i, {
			timeout: 8000,
		});
	});
});
