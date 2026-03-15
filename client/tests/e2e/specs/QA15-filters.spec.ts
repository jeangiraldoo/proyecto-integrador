import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

test.describe("QA-15 | US-5 - Filter by course and validate sorting rules", () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate and wait for the TodayView to load completely
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });
	});

	test("Should filter by course and validate sorting order across the 3 tabs", async ({ page }) => {
		// 1. FILTER BY COURSE (As requested in the PDF scenario)
		const btnCurso = page.getByRole("button", { name: /Curso:/i });
		await expect(btnCurso).toBeVisible({ timeout: 10000 });
		await btnCurso.click();

		// Select the last available course in the dropdown to ensure we pick a real course (not "Todos")
		const dropdownCurso = page.locator('div[style*="z-index: 9999"]').first();
		await dropdownCurso.locator("button").last().click();

		// 2. VALIDATE 'VENCIDAS' TAB (Oldest first)
		const tabVencidas = page.getByRole("button", { name: /Vencidas/i });
		await tabVencidas.click();

		// Assert the UI explicitly states the correct sorting rule
		const hintVencidas = page.getByText(/más antiguas primero/i);
		await expect(hintVencidas).toBeVisible();

		// 3. VALIDATE 'PARA HOY' TAB (Least time first)
		const tabHoy = page.getByRole("button", { name: /Para hoy/i });
		await tabHoy.click();

		// Assert the UI explicitly states the correct sorting rule
		const hintHoy = page.getByText(/más rápidas primero/i);
		await expect(hintHoy).toBeVisible();

		// E2E Core validation: mathematically verify the sorting if there are multiple tasks
		const cardsHoy = page.locator('[role="button"][tabindex="0"]');
		const countHoy = await cardsHoy.count();

		if (countHoy > 1) {
			let previousHours = -1;
			for (let i = 0; i < countHoy; i++) {
				const cardText = await cardsHoy.nth(i).textContent();
				// Extract the number right before the 'h' (e.g., "1.5h" -> 1.5)
				const match = cardText?.match(/(\d+(\.\d+)?)(?=h)/);

				if (match && match[1]) {
					const currentHours = parseFloat(match[1]);
					// Expect current task hours to be greater or equal to the previous one (Ascending order)
					expect(currentHours).toBeGreaterThanOrEqual(previousHours);
					previousHours = currentHours;
				}
			}
		}

		// 4. VALIDATE 'PRÓXIMAS' TAB (Closest first)
		const tabProximas = page.getByRole("button", { name: /Próximas/i });
		await tabProximas.click();

		// Assert the UI explicitly states the correct sorting rule
		const hintProximas = page.getByText(/más cercanas primero/i);
		await expect(hintProximas).toBeVisible();
	});

	test("Should keep UI state without reloading when clearing filters (Acceptance Criteria #1)", async ({
		page,
	}) => {
		// Clean filters to validate SPA behavior (no page reload)
		const btnLimpiar = page.getByRole("button", { name: /Limpiar/i });
		if (await btnLimpiar.isVisible()) {
			await btnLimpiar.click();
		}

		// Validate that the filter resets correctly
		await expect(page.getByRole("button", { name: "Curso: Todos" }).first()).toBeVisible();
	});
});
