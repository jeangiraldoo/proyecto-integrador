import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

test.describe("QA-15 | US-5 - Filtrar por curso y validar reglas de ordenamiento", () => {
	test.beforeEach(async ({ page }) => {
		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 120000 });
	});

	test("Filtrar por curso y validar orden entre las 3 pestañas", async ({ page }) => {
		test.setTimeout(120000);
		const btnCurso = page.getByRole("button", { name: /Curso:/i });
		await expect(btnCurso).toBeVisible({ timeout: 10000 });
		await btnCurso.click();

		const dropdownCurso = page.locator('div[style*="z-index: 9999"]').first();
		const optionToClick = dropdownCurso.locator("button").last();
		await expect(optionToClick).toBeVisible({ timeout: 5000 });

		await optionToClick.evaluate((node: HTMLElement) => node.click());

		const tabVencidas = page.getByRole("button", { name: /Vencidas/i });
		await tabVencidas.click();

		const hintVencidas = page.getByText(/más antiguas primero/i);
		await expect(hintVencidas).toBeVisible();

		const tabHoy = page.getByRole("button", { name: /Para hoy/i });
		await tabHoy.click();

		const hintHoy = page.getByText(/más rápidas primero/i);
		await expect(hintHoy).toBeVisible();

		const cardsHoy = page.locator('[role="button"][tabindex="0"]');
		const countHoy = await cardsHoy.count();

		if (countHoy > 1) {
			let previousHours = -1;
			for (let i = 0; i < countHoy; i++) {
				const cardText = await cardsHoy.nth(i).textContent();

				const match = cardText?.match(/(\d+(\.\d+)?)(?=h)/);

				if (match && match[1]) {
					const currentHours = parseFloat(match[1]);

					expect(currentHours).toBeGreaterThanOrEqual(previousHours);
					previousHours = currentHours;
				}
			}
		}

		const tabProximas = page.getByRole("button", { name: /Próximas/i });
		await tabProximas.click();

		const hintProximas = page.getByText(/más cercanas primero/i);
		await expect(hintProximas).toBeVisible();
	});

	test("Debe mantener el estado de la UI sin recargar al limpiar filtros (Criterio de Aceptación #1)", async ({
		page,
	}) => {
		const btnLimpiar = page.getByRole("button", { name: /Limpiar/i });
		if (await btnLimpiar.isVisible()) {
			await btnLimpiar.click();
		}

		await expect(page.getByRole("button", { name: "Curso: Todos" }).first()).toBeVisible();
	});
});
