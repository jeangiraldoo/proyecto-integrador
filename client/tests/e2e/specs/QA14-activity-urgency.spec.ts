import { test, expect } from "@playwright/test";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-14 | US-4 - Ver actividades urgentes (prioridades 'hoy')", () => {
	// Extended timeout and retries to mitigate Vercel/Render Cold Starts
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		// FIX SENIOR: Test Isolation. We create a fresh user per test run to guarantee
		// an empty state from the beginning, avoiding flaky assertions.
		const timestamp = Date.now();

		// Increased timeout for potential Vercel sleeping server
		await page.goto("/registro", { timeout: 120000 });

		await page.locator('input[name="username"]').fill(`qa14_${timestamp}`);
		await page.locator('input[name="email"]').fill(`qa14_${timestamp}@test.com`);
		await page.locator('input[name="password"]').fill("SuperPassword123!");
		await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");

		await page.locator('button[type="submit"]').click();

		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 120000 });
	});

	test("E2E Test: Renderizado correcto, estados vacios y reglas de ordenamiento reales", async ({
		page,
	}) => {
		const TIMESTAMP = Date.now();
		const SUBJECT_NAME = `QA14_Materia_${TIMESTAMP}`;
		const ACTIVITY_NAME = `QA14_Actividad_${TIMESTAMP}`;

		const today = new Date();

		// Dates mapping for testing US-4 Sorting Rules
		const pastOld = new Date(today);
		pastOld.setDate(today.getDate() - 3);
		const pastRecent = new Date(today);
		pastRecent.setDate(today.getDate() - 1);
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);
		const futureFar = new Date(today);
		futureFar.setDate(today.getDate() + 3);
		const dueActivity = new Date(today);
		dueActivity.setDate(today.getDate() + 10);

		const pastOldStr = formatLocalDateForInput(pastOld);
		const pastRecentStr = formatLocalDateForInput(pastRecent);
		const todayStr = formatLocalDateForInput(today);
		const tomorrowStr = formatLocalDateForInput(tomorrow);
		const futureFarStr = formatLocalDateForInput(futureFar);
		const dueActivityStr = formatLocalDateForInput(dueActivity);

		// ====================================================================
		// STEP 1: Empty State Validation
		// ====================================================================
		await test.step("1. Estado Vacío: Cuando no hay subtareas pendientes", async () => {
			// Summary pill should show no urgent tasks
			await expect(page.getByTestId("today-summary-pill")).toContainText(/Sin tareas/i, {
				timeout: 15000,
			});

			// Today tab should be visible and active
			await expect(page.getByTestId("today-tab-today")).toBeVisible();

			// Empty state illustration/message must be displayed
			await expect(page.getByTestId("today-empty-state-today")).toBeVisible();
		});

		// ====================================================================
		// STEP 2: Data Preparation (Creating the tasks directly to real DB)
		// ====================================================================
		await test.step("2. Preparación: Crear tareas con fechas y horas específicas", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 10000 });

			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 5000 });

			await modal.locator(".ca-combobox-input").fill(SUBJECT_NAME);
			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(dueActivityStr);
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			// Subtask 1: Past Old
			await modal.locator('input[id="st-title"]').fill("Vencida Antigua");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(pastOldStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Vencida Antigua")).toBeVisible({
				timeout: 5000,
			});

			// Subtask 2: Past Recent
			await modal.locator('input[id="st-title"]').fill("Vencida Reciente");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(pastRecentStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Vencida Reciente")).toBeVisible({
				timeout: 5000,
			});

			// Subtask 3: Today Heavy (3h)
			await modal.locator('input[id="st-title"]').fill("Hoy Pesada");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(todayStr);
			await modal.locator('input[id="st-hours"]').fill("3");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Hoy Pesada")).toBeVisible({
				timeout: 5000,
			});

			// Subtask 4: Today Light (1h)
			await modal.locator('input[id="st-title"]').fill("Hoy Ligera");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(todayStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Hoy Ligera")).toBeVisible({
				timeout: 5000,
			});

			// Subtask 5: Upcoming Near
			await modal.locator('input[id="st-title"]').fill("Proxima Cercana");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(tomorrowStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Proxima Cercana")).toBeVisible({
				timeout: 5000,
			});

			// Subtask 6: Upcoming Far
			await modal.locator('input[id="st-title"]').fill("Proxima Lejana");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(futureFarStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Proxima Lejana")).toBeVisible({
				timeout: 5000,
			});

			await modal.getByRole("button", { name: /Crear actividad/i }).click();

			const toastCreada = page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /creada/i })
				.first();
			await expect(toastCreada).toBeVisible({ timeout: 8000 });
		});

		// ====================================================================
		// STEP 3: Validation of Sorting Rules (US-04 Tie-breakers)
		// ====================================================================
		await test.step("3. Validación: Reglas de ordenamiento reales en Vista Hoy", async () => {
			await page.getByRole("button", { name: "Hoy" }).click({ force: true });
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			// Vencidas: Oldest first (Date ASC)
			await page.getByTestId("today-tab-overdue").click();
			const overdueCards = page.locator('[data-testid="today-column-overdue"] [role="button"]');
			await expect(overdueCards.nth(0)).toContainText("Vencida Antigua", { timeout: 10000 });
			await expect(overdueCards.nth(1)).toContainText("Vencida Reciente", { timeout: 10000 });
			await expect(page.getByTestId("today-sort-hint")).toContainText(/más antiguas primero/i);

			// Para hoy: Least effort first (Hours ASC)
			await page.getByTestId("today-tab-today").click();
			const todayCards = page.locator('[data-testid="today-column-today"] [role="button"]');
			await expect(todayCards.nth(0)).toContainText("Hoy Ligera", { timeout: 10000 });
			await expect(todayCards.nth(1)).toContainText("Hoy Pesada", { timeout: 10000 });
			await expect(page.getByTestId("today-sort-hint")).toContainText(/más rápidas primero/i);

			// Próximas: Closest first (Date ASC)
			await page.getByTestId("today-tab-upcoming").click();
			const upcomingCards = page.locator('[data-testid="today-column-upcoming"] [role="button"]');
			await expect(upcomingCards.nth(0)).toContainText("Proxima Cercana", { timeout: 10000 });
			await expect(upcomingCards.nth(1)).toContainText("Proxima Lejana", { timeout: 10000 });
			await expect(page.getByTestId("today-sort-hint")).toContainText(/más cercanas primero/i);
		});

		// ====================================================================
		// STEP 4: Cleanup
		// ====================================================================
		await test.step("4. Cleanup: Eliminar actividad completa", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 15000 });

			await page.getByText(SUBJECT_NAME).click();

			const activityBlock = page.locator("div").filter({ hasText: ACTIVITY_NAME }).first();
			await expect(activityBlock).toBeVisible({ timeout: 5000 });

			await activityBlock.locator('button[title="Eliminar actividad"]').first().click();

			await page.getByRole("button", { name: /Sí, eliminar/i }).click();

			const toastEliminada = page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /eliminada/i })
				.first();
			await expect(toastEliminada).toBeVisible({ timeout: 8000 });
		});
	});
});
