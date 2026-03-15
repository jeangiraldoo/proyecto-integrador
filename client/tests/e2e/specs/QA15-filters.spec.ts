import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

test.describe("QA-15 | US-5 - Filtrado basico para actividades urgentes", () => {
	test.beforeEach(async ({ page }) => {
		// Reutilizamos el helper existente
		await loginAndGoToDashboard(page);
		// Aumentamos el timeout a 15s para darle tiempo al Backend de cargar las tareas
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });
	});

	test("Debe filtrar por estado y limpiar filtros manteniendo la UX", async ({ page }) => {
		// 1. En la vista /hoy, los filtros son botones directos. Buscamos el de Estado.
		const btnEstado = page.getByRole("button", { name: /Estado:/i });
		await expect(btnEstado).toBeVisible({ timeout: 10000 });
		await btnEstado.click();

		// 2. Seleccionar "Completada" en el portal flotante (z-index: 9999)
		const dropdownEstado = page.locator('div[style*="z-index: 9999"]').first();
		await dropdownEstado.getByRole("button", { name: /Completada/i }).click();

		// 3. Validar que el botón refleja el estado seleccionado (UX Feedback)
		await expect(page.getByRole("button", { name: "Estado: Completada" }).first()).toBeVisible();

		// 4. Clic en el botón limpiar filtros
		const btnLimpiar = page.getByRole("button", { name: /Limpiar/i });
		await btnLimpiar.click();

		// 5. Validar restauración al estado original
		await expect(page.getByRole("button", { name: "Estado: Todos" }).first()).toBeVisible();
	});

	test("Debe mostrar estado vacio o tarjetas al aplicar un filtro de curso", async ({ page }) => {
		// 1. Buscamos el filtro de Curso
		const btnCurso = page.getByRole("button", { name: /Curso:/i });
		await expect(btnCurso).toBeVisible({ timeout: 10000 });
		await btnCurso.click();

		// 2. Seleccionamos la última opción disponible en el dropdown de cursos
		const dropdownCurso = page.locator('div[style*="z-index: 9999"]').first();
		await dropdownCurso.locator("button").last().click();

		// 3. Criterio US-5: Verificamos de forma pasiva que la página responda correctamente
		// ya sea mostrando el mensaje de vacío ("Nada por aquí") o las tarjetas filtradas.
		const estadoVacio = page.getByText(/Nada por aquí/i).first();
		const tarjetas = page.locator(".col-title").first();

		// Evaluamos que al menos una de las dos situaciones ocurra (dependiendo de la BD)
		await expect(estadoVacio.or(tarjetas)).toBeVisible({ timeout: 10000 });
	});
});
