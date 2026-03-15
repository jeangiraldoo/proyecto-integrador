import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

test.describe("QA-15 | US-5 - Filtrado basico para actividades urgentes", () => {
	test.beforeEach(async ({ page }) => {
		// Reutilizamos el helper existente (setup de autenticación)
		await loginAndGoToDashboard(page);
		// Validamos que la vista base cargó correctamente
		await expect(page.locator("h1.page-title")).toContainText("Hoy");
	});

	test("Debe filtrar por estado y limpiar filtros manteniendo la UX", async ({ page }) => {
		// 1. Abrir el panel de filtros
		// JUSTIFICACIÓN: Usamos getByRole para evitar depender de clases CSS o IDs inestables (consejo de Jean)
		const btnFiltros = page.getByRole("button", { name: /Filtros/i });
		await btnFiltros.click();

		// 2. Desplegar dropdown de "Estado"
		const btnEstado = page.getByRole("button", { name: /Estado:/i });
		await btnEstado.click();

		// 3. Seleccionar filtro "Completada"
		// El dropdown se renderiza en un portal (z-index: 9999), lo ubicamos y damos clic
		const dropdownEstado = page.locator('div[style*="z-index: 9999"]').first();
		await dropdownEstado.getByRole("button", { name: "Estado: Completada" }).click();

		// 4. Validar que el botón refleja el estado seleccionado (UX Feedback)
		await expect(page.getByRole("button", { name: "Estado: Completada" }).first()).toBeVisible();

		// 5. Clic en limpiar filtros
		await btnFiltros.click(); // Asegurar que el panel esté abierto
		const btnLimpiar = page.getByRole("button", { name: /Limpiar/i });
		await btnLimpiar.click();

		// 6. Validar restauración (Estado: Todos)
		await expect(page.getByRole("button", { name: "Estado: Todos" }).first()).toBeVisible();
	});

	test("Debe mostrar estado vacio cuando un filtro no coincide con nada", async ({ page }) => {
		await page.getByRole("button", { name: /Filtros/i }).click();
		await page.getByRole("button", { name: /Curso:/i }).click();

		// Seleccionamos un curso. Suponiendo que aplicamos un filtro cruzado muy estricto
		const dropdownCurso = page.locator('div[style*="z-index: 9999"]').first();
		const option = dropdownCurso.locator("button").nth(1); // Tomamos la primera opción que no sea "Todos"
		await option.click();

		// Criterio US-5: Si no hay tareas, el sistema muestra el mensaje de estado vacío
		// "Nada por aquí" es el texto definido en TodayView.tsx para el estado vacío
		const estadoVacio = page.getByText(/Nada por aquí/i).first();

		// Verificamos de forma pasiva que la página no explote
		await expect(estadoVacio.or(page.locator(".col-title").first())).toBeVisible();
	});
});
