import { test, expect } from "@playwright/test";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-14 | US-4 - Pruebas E2E Vista Hoy", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test("E2E: Caso de éxito - Preparación de datos (Seed) y Reglas de Ordenamiento", async ({
		page,
	}) => {
		const timestamp = Date.now();
		const ACTIVITY_NAME = `QA14_Actividad_${timestamp}`;

		const today = new Date();
		const pastDate1 = new Date(today);
		pastDate1.setDate(today.getDate() - 3);
		const pastDate2 = new Date(today);
		pastDate2.setDate(today.getDate() - 1);
		const futureDate1 = new Date(today);
		futureDate1.setDate(today.getDate() + 2);
		const futureDateOut = new Date(today);
		futureDateOut.setDate(today.getDate() + 10);

		// Subtask Names
		const ST_OVERDUE_OLDEST = `Vencida Antigua ${timestamp}`;
		const ST_OVERDUE_NEWER = `Vencida Reciente ${timestamp}`;
		const ST_TODAY_HEAVY = `Hoy Pesada (3h) ${timestamp}`;
		const ST_TODAY_LIGHT = `Hoy Ligera (1h) ${timestamp}`;
		const ST_UPCOMING_IN = `Proxima Rango N ${timestamp}`;
		const ST_UPCOMING_OUT = `Proxima Fuera N ${timestamp}`;

		await test.step("Setup: Registrar usuario fresco para Test Isolation", async () => {
			await page.goto("/registro", { timeout: 120000, waitUntil: "domcontentloaded" });
			await page.locator('input[name="username"]').fill(`qa14_user_${timestamp}`);
			await page.locator('input[name="email"]').fill(`qa14_user_${timestamp}@test.com`);
			await page.locator('input[name="password"]').fill("SuperPassword123!");
			await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");
			await page.locator('button[type="submit"]').click();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 30000 });
		});

		await test.step("Seed: Inyectar datos controlados vía UI", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await page.getByRole("button", { name: /Nueva actividad/i }).click();

			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 5000 });

			await modal.locator(".ca-combobox-input").fill(`QA14_Course_${timestamp}`);
			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(formatLocalDateForInput(futureDateOut));
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			await modal.locator('input[id="st-title"]').fill(ST_OVERDUE_OLDEST);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(pastDate1));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.locator('input[id="st-title"]').fill(ST_OVERDUE_NEWER);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(pastDate2));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.locator('input[id="st-title"]').fill(ST_TODAY_HEAVY);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(today));
			await modal.locator('input[id="st-hours"]').fill("3");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.locator('input[id="st-title"]').fill(ST_TODAY_LIGHT);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(today));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.locator('input[id="st-title"]').fill(ST_UPCOMING_IN);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(futureDate1));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.locator('input[id="st-title"]').fill(ST_UPCOMING_OUT);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(futureDateOut));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			await modal.getByRole("button", { name: /Crear actividad/i }).click();
			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /creada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });
		});

		await test.step("Validación: Reglas de negocio renderizadas desde DB real", async () => {
			await page.getByRole("button", { name: "Hoy" }).click({ force: true });
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			await page
				.getByRole("button", { name: /Vencidas/i })
				.first()
				.click();
			const cardsVencidas = page.locator('div[role="button"][tabindex="0"]');
			await expect(cardsVencidas.nth(0)).toContainText(ST_OVERDUE_OLDEST, { timeout: 5000 });
			await expect(cardsVencidas.nth(1)).toContainText(ST_OVERDUE_NEWER);

			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();
			const cardsHoy = page.locator('div[role="button"][tabindex="0"]');
			await expect(cardsHoy.nth(0)).toContainText(ST_TODAY_LIGHT, { timeout: 5000 });
			await expect(cardsHoy.nth(1)).toContainText(ST_TODAY_HEAVY);

			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();
			const cardsProximas = page.locator('div[role="button"][tabindex="0"]');
			await expect(cardsProximas.nth(0)).toContainText(ST_UPCOMING_IN, { timeout: 5000 });

			const outOfRangeTask = page
				.locator('div[role="button"][tabindex="0"]')
				.filter({ hasText: ST_UPCOMING_OUT });
			await expect(outOfRangeTask).toBeHidden();
		});
	});

	test("E2E: Caso de estado vacío", async ({ page }) => {
		const timestamp = Date.now();

		await test.step("Setup: Registrar usuario fresco sin tareas", async () => {
			await page.goto("/registro", { timeout: 120000, waitUntil: "domcontentloaded" });
			await page.locator('input[name="username"]').fill(`qa14_empty_${timestamp}`);
			await page.locator('input[name="email"]').fill(`qa14_empty_${timestamp}@test.com`);
			await page.locator('input[name="password"]').fill("SuperPassword123!");
			await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");
			await page.locator('button[type="submit"]').click();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 60000 });
		});

		await test.step("Validar renderizado de Empty State real", async () => {
			const emptyMessage = page.getByText(/Nada por aquí — ¡todo libre!/i).first();
			await expect(emptyMessage).toBeVisible({ timeout: 10000 });

			await expect(
				page
					.getByRole("button", { name: /Vencidas/i })
					.locator("span")
					.last(),
			).toHaveText(/0|todo completado/i);
			await expect(
				page
					.getByRole("button", { name: /Para hoy/i })
					.locator("span")
					.last(),
			).toHaveText(/0|todo completado/i);
			await expect(
				page
					.getByRole("button", { name: /Próximas/i })
					.locator("span")
					.last(),
			).toHaveText(/0|todo completado/i);
		});
	});

	test("E2E: Caso de falla (Simulación híbrida de Server Error)", async ({ page }) => {
		const timestamp = Date.now();

		await test.step("Setup: Login", async () => {
			await page.goto("/registro", { timeout: 120000, waitUntil: "domcontentloaded" });
			await page.locator('input[name="username"]').fill(`qa14_err_${timestamp}`);
			await page.locator('input[name="email"]').fill(`qa14_err_${timestamp}@test.com`);
			await page.locator('input[name="password"]').fill("SuperPassword123!");
			await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");
			await page.locator('button[type="submit"]').click();

			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 60000 });
		});

		await test.step("Simular caída de la Base de Datos (500 Internal Server Error)", async () => {
			await page.route("**/today/**", async (route) => {
				await route.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({ errors: { server: "Database connection lost" } }),
				});
			});

			await page.reload();

			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 60000 });

			const tabButtons = page.getByRole("button", { name: /Para hoy/i }).first();
			await expect(tabButtons).toBeVisible({ timeout: 10000 });
		});
	});
});
