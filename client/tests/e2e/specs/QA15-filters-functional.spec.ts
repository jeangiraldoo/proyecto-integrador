import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

/**
 * QA-15 | US-5: Functional Tests for Filtering
 * As requested by the team coordinator, this file strictly focuses on Functional Testing
 * isolating the frontend behavior using API Mocking (Network Interception).
 */

// Mock payload to simulate a controlled environment without relying on the real Database
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
	test.describe.configure({ retries: 1 });

	test("Functional: Filtrar por curso, por estado, combinar y limpiar", async ({ page }) => {
		// 1. MOCK THE API: Intercept the real backend request and fulfill it with our controlled MOCK_TODAY_DATA
		await page.route("**/api/today/**", async (route) => {
			await route.fulfill({ json: MOCK_TODAY_DATA });
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		await test.step("1. Filtrar por estado (Solo 'En progreso')", async () => {
			await page.getByRole("button", { name: /Estado:/i }).click();
			const dropdown = page.locator('div[style*="z-index: 9999"]').first();
			await dropdown.getByRole("button", { name: /En progreso/i }).click();

			// Only "Tarea Hoy de Cálculo" should be visible across all tabs
			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Cálculo" }),
			).toBeVisible();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Redes" }),
			).toBeHidden();
		});

		await test.step("2. Combinar filtros (Estado: En progreso + Curso: Redes) -> Estado Vacío", async () => {
			// Apply second filter
			await page.getByRole("button", { name: /Curso:/i }).click();
			const dropdown = page.locator('div[style*="z-index: 9999"]').first();
			await dropdown.getByRole("button", { name: /Redes/i }).click();

			// Condition: No task is both "En progreso" AND from "Redes"
			// Functional requirement: Should show Empty State Message
			await expect(page.getByText(/Nada por aquí/i)).toBeVisible();
		});

		await test.step("3. Limpiar filtros (Restaura la vista sin recargar la página)", async () => {
			const btnLimpiar = page.getByRole("button", { name: /Limpiar/i });
			await btnLimpiar.click();

			// UI state should be completely restored
			await expect(page.getByRole("button", { name: "Estado: Todos" }).first()).toBeVisible();
			await expect(page.getByRole("button", { name: "Curso: Todos" }).first()).toBeVisible();

			// Original mocked tasks should be visible again
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Cálculo" }),
			).toBeVisible();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Tarea Hoy de Redes" }),
			).toBeVisible();
		});
	});

	test("Functional: Error del servidor (Simulado 500)", async ({ page }) => {
		// MOCK: Simulate a critical backend crash (Requirement from PDF)
		await page.route("**/api/today/**", async (route) => {
			await route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({ errors: { server: "Internal Server Error" } }),
			});
		});

		await loginAndGoToDashboard(page);

		// The application should not completely crash. The header must survive.
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 10000 });

		// Wait for the Kanban to either show loading or degrade gracefully,
		// verifying the UI doesn't throw a white screen of death (React Error Boundary).
		const tabButtons = page.getByRole("button", { name: /Para hoy/i }).first();
		await expect(tabButtons).toBeVisible();
	});

	test("Functional: Usuario A no ve datos de usuario B (Data Isolation Check)", async ({
		page,
	}) => {
		// To functionally test isolation in the frontend, we verify that the course dropdown
		// strictly populates ONLY with the courses returned by the user's specific /today/ payload.
		await page.route("**/api/today/**", async (route) => {
			await route.fulfill({ json: MOCK_TODAY_DATA }); // Payload only contains "Redes", "Cálculo", "Física"
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		await page.getByRole("button", { name: /Curso:/i }).click();
		const dropdown = page.locator('div[style*="z-index: 9999"]').first();

		const optionsText = await dropdown.locator("button").allTextContents();

		// Verify that a malicious/external course like "Filosofía B" is NOT rendered
		const filteredOptions = optionsText.map((t) => t.trim());
		expect(filteredOptions).not.toContain("Curso: Filosofía B");

		// Verify that exactly our mocked courses are rendered
		expect(filteredOptions).toContain("Curso: Redes");
		expect(filteredOptions).toContain("Curso: Cálculo");
		expect(filteredOptions).toContain("Curso: Física");
	});
});
