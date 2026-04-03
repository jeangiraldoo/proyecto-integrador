import { test, expect } from "@playwright/test";

/**
 * QA-14 | US-4: E2E Tests for Today View (/hoy)
 * This suite validates the real End-to-End flow ensuring the React Frontend
 * communicates correctly with the Django Backend and renders success, empty,
 * and error states based on the priority rules.
 */

// Helper to generate dynamic dates
const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-14 | US-4 - Pruebas E2E Vista Hoy", () => {
	// E2E flows with heavy UI interaction and DB persistence need higher timeouts
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test("E2E: Caso de éxito - Preparación de datos (Seed) y Reglas de Ordenamiento", async ({
		page,
	}) => {
		const timestamp = Date.now();
		const ACTIVITY_NAME = `QA14_Actividad_${timestamp}`;

		// Dynamic Dates for the Seed
		const today = new Date();
		const pastDate1 = new Date(today);
		pastDate1.setDate(today.getDate() - 3); // Oldest
		const pastDate2 = new Date(today);
		pastDate2.setDate(today.getDate() - 1); // Yesterday
		const futureDate1 = new Date(today);
		futureDate1.setDate(today.getDate() + 2); // Within N days
		const futureDateOut = new Date(today);
		futureDateOut.setDate(today.getDate() + 10); // Outside N=7 days

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

			// 1. Overdue: Oldest (-3 days)
			await modal.locator('input[id="st-title"]').fill(ST_OVERDUE_OLDEST);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(pastDate1));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// 2. Overdue: Newer (-1 day)
			await modal.locator('input[id="st-title"]').fill(ST_OVERDUE_NEWER);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(pastDate2));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// 3. Today: Heavy effort (3h)
			await modal.locator('input[id="st-title"]').fill(ST_TODAY_HEAVY);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(today));
			await modal.locator('input[id="st-hours"]').fill("3");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// 4. Today: Light effort (1h) - MUST appear above Heavy effort
			await modal.locator('input[id="st-title"]').fill(ST_TODAY_LIGHT);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(today));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// 5. Upcoming: Inside N range (+2 days)
			await modal.locator('input[id="st-title"]').fill(ST_UPCOMING_IN);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(futureDate1));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// 6. Upcoming: Outside N range (+10 days)
			await modal.locator('input[id="st-title"]').fill(ST_UPCOMING_OUT);
			await modal
				.locator('.ca-subform-date-wrapper input[type="date"]')
				.fill(formatLocalDateForInput(futureDateOut));
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();

			// Save to Real Database
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
			await page.reload(); // Force full backend sync
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			// 1. Verify Vencidas (Oldest First)
			await page
				.getByRole("button", { name: /Vencidas/i })
				.first()
				.click();
			const cardsVencidas = page.locator('div[role="button"][tabindex="0"]');
			await expect(cardsVencidas.nth(0)).toContainText(ST_OVERDUE_OLDEST, { timeout: 5000 });
			await expect(cardsVencidas.nth(1)).toContainText(ST_OVERDUE_NEWER);

			// 2. Verify Para Hoy (Tie-breaker: Least effort first)
			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();
			const cardsHoy = page.locator('div[role="button"][tabindex="0"]');
			await expect(cardsHoy.nth(0)).toContainText(ST_TODAY_LIGHT, { timeout: 5000 }); // 1h task goes first
			await expect(cardsHoy.nth(1)).toContainText(ST_TODAY_HEAVY); // 3h task goes second

			// 3. Verify Próximas (Only inside N days range)
			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();
			const cardsProximas = page.locator('div[role="button"][tabindex="0"]');
			await expect(cardsProximas.nth(0)).toContainText(ST_UPCOMING_IN, { timeout: 5000 });

			// The task at +10 days should NOT be visible because default N is 7 days
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
			// The backend returns empty arrays, UI must show the empty state message
			const emptyMessage = page.getByText(/Nada por aquí — ¡todo libre!/i).first();
			await expect(emptyMessage).toBeVisible({ timeout: 10000 });

			// Verify counts reflect the empty state
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
			await page.goto("/registro", { timeout: 60000 });
			await page.locator('input[name="username"]').fill(`qa14_err_${timestamp}`);
			await page.locator('input[name="email"]').fill(`qa14_err_${timestamp}@test.com`);
			await page.locator('input[name="password"]').fill("SuperPassword123!");
			await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");
			await page.locator('button[type="submit"]').click();
		});

		await test.step("Simular caída de la Base de Datos (500 Internal Server Error)", async () => {
			// This is the ONLY mock in this E2E file, because it's impossible/unsafe to physically crash
			// the real Vercel/Django server just for a test.
			await page.route("**/today/**", async (route) => {
				await route.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({ errors: { server: "Database connection lost" } }),
				});
			});

			await page.reload();

			// Ensure the app doesn't trigger a White Screen of Death (React Crash)
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			// UI should degrade gracefully
			const tabButtons = page.getByRole("button", { name: /Para hoy/i }).first();
			await expect(tabButtons).toBeVisible({ timeout: 5000 });
		});
	});
});
