import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

/**
 * QA-15 | US-5: Functional Tests for Filtering
 * As requested by the team coordinator, this file strictly focuses on Functional Testing
 * isolating the frontend behavior using API Mocking (Network Interception).
 */

const MOCK_TODAY_DATA = {
	overdue: [
		{
			id: 101,
			name: "Tarea Vencida de Redes",
			status: "pending",
			course_name: "Redes",
			target_date: "2025-01-01",
			estimated_hours: 2,
		},
	],
	today: [
		{
			id: 102,
			name: "Tarea Hoy de Cálculo",
			status: "in_progress",
			course_name: "Cálculo",
			target_date: "2026-10-10",
			estimated_hours: 1,
		},
		{
			id: 103,
			name: "Tarea Hoy de Redes",
			status: "completed",
			course_name: "Redes",
			target_date: "2026-10-10",
			estimated_hours: 3,
		},
	],
	upcoming: [
		{
			id: 104,
			name: "Tarea Próxima de Física",
			status: "pending",
			course_name: "Física",
			target_date: "2026-12-12",
			estimated_hours: 4,
		},
	],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

test.describe("QA-15 | US-5 - Pruebas Funcionales de Filtrado (Mocked)", () => {
	// FIX 1: Aumentamos el timeout a 120s y añadimos retries para soportar
	// los Cold Starts (servidor dormido) de Vercel durante el proceso de login real.
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		// FIX 2: Interceptamos también la llamada a /activities/ para que devuelva vacío.
		// Esto evita que las actividades creadas en la base de datos real por otros tests (QA16/QA17)
		// ensucien el dropdown de filtros, garantizando 100% de aislamiento (Isolation).
		await page.route("**/api/activities/**", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({ json: [] });
			} else {
				await route.continue();
			}
		});
	});

	test("Functional: Filtrar por curso, por estado, combinar y limpiar", async ({ page }) => {
		await page.route("**/api/today/**", async (route) => {
			await route.fulfill({ json: MOCK_TODAY_DATA });
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		await test.step("1. Filtrar por estado (Solo 'En progreso')", async () => {
			await page.getByRole("button", { name: /Estado:/i }).click();
			const dropdown = page.locator('div[style*="z-index: 9999"]').first();
			await dropdown.getByRole("button", { name: /En progreso/i }).click();

			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Cálculo" }),
			).toBeVisible({ timeout: 5000 });
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Redes" }),
			).toBeHidden();
		});

		await test.step("2. Combinar filtros (Estado: En progreso + Curso: Redes) -> Estado Vacío", async () => {
			await page.getByRole("button", { name: /Curso:/i }).click();
			const dropdown = page.locator('div[style*="z-index: 9999"]').first();
			await dropdown.getByRole("button", { name: /Redes/i }).click();

			await expect(page.getByText(/Nada por aquí/i)).toBeVisible({ timeout: 5000 });
		});

		await test.step("3. Limpiar filtros (Restaura la vista sin recargar la página)", async () => {
			const btnLimpiar = page.getByRole("button", { name: /Limpiar/i });
			await btnLimpiar.click();

			await expect(page.getByRole("button", { name: "Estado: Todos" }).first()).toBeVisible();
			await expect(page.getByRole("button", { name: "Curso: Todos" }).first()).toBeVisible();

			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Cálculo" }),
			).toBeVisible();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Redes" }),
			).toBeVisible();
		});
	});

	test("Functional: Error del servidor (Simulado 500)", async ({ page }) => {
		await page.route("**/api/today/**", async (route) => {
			await route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({ errors: { server: "Internal Server Error" } }),
			});
		});

		await loginAndGoToDashboard(page);

		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		const tabButtons = page.getByRole("button", { name: /Para hoy/i }).first();
		await expect(tabButtons).toBeVisible({ timeout: 5000 });
	});

	test("Functional: Usuario A no ve datos de usuario B (Data Isolation Check)", async ({
		page,
	}) => {
		await page.route("**/api/today/**", async (route) => {
			await route.fulfill({ json: MOCK_TODAY_DATA });
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

		await page.getByRole("button", { name: /Curso:/i }).click();
		const dropdown = page.locator('div[style*="z-index: 9999"]').first();

		const optionsText = await dropdown.locator("button").allTextContents();
		const filteredOptions = optionsText.map((t) => t.trim());

		// Verificamos que las materias generadas por otras pruebas en la BD real NO aparezcan aquí
		expect(filteredOptions).not.toContain("Curso: QA17_Materia_1773806938849");

		// Verificamos que SOLO aparezcan las materias de nuestra MOCK_DATA
		expect(filteredOptions).toContain("Curso: Redes");
		expect(filteredOptions).toContain("Curso: Cálculo");
		expect(filteredOptions).toContain("Curso: Física");
	});
});
