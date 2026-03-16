import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

test.describe("QA-16 | US-6 - Reprogramacion de actividades/subtareas", () => {
	test.beforeEach(async ({ page }) => {
		await loginAndGoToDashboard(page);
	});

	test("Debe reprogramar una tarea, reubicarla y mantener persistencia en DB", async ({ page }) => {
		// 1. Ir a "Próximas" para asegurar que tomamos una tarea que no es de hoy
		await page.getByRole("button", { name: "Próximas" }).click();

		const tarjetas = page.locator('[role="button"][tabindex="0"]');

		// Si no hay tareas en Próximas, el test no puede continuar su flujo, pero no debe fallar el CI
		if ((await tarjetas.count()) === 0) {
			console.log("Empty state: No hay tareas en Próximas para reprogramar.");
			test.skip(true, "No data available for rescheduling");
			return;
		}

		// 2. Seleccionar la primera tarjeta
		const primeraTarea = tarjetas.first();
		const tituloTarea = await primeraTarea.locator(".col-title").textContent();
		await primeraTarea.click();

		// 3. Abrir modo edición
		// El icono de lápiz tiene el title="Editar", esto lo vimos en SubtaskDetailPanel.tsx
		await page.locator('button[title="Editar"]').click();

		// 4. Asegurar que el modal se abre
		await expect(page.locator("div").filter({ hasText: "Editar tarea" }).first()).toBeVisible();

		// 5. Cambiar fecha a HOY (Simulando el imprevisto de la US-6)
		const inputsDate = page.locator('input[type="date"]');
		const today = new Date().toISOString().split("T")[0];
		await inputsDate.fill(today);

		// 6. Guardar cambios
		await page.getByRole("button", { name: /Guardar cambios/i }).click();

		// 7. Feedback de éxito (Regla de UX/HCI)
		const toastExito = page.locator("[data-sonner-toast]");
		await expect(toastExito).toContainText(/actualizada/i, { timeout: 6000 });

		// 8. Reubicación automática: Validar que se movió a "Para hoy"
		await page.getByRole("button", { name: "Para hoy" }).click();

		// 9. Validar Persistencia (Gating del Sprint 3)
		// La regla fundamental: "Lo que no tiene evidencia, no existe". Recargamos la página.
		await page.reload();

		// Volvemos a entrar a "Para hoy" tras recargar para verificar que el Backend guardó el cambio
		await page.getByRole("button", { name: "Para hoy" }).click();
		const tareaEnHoy = page.locator(".col-title").filter({ hasText: tituloTarea || "" });

		await expect(tareaEnHoy.first()).toBeVisible();
	});
});
