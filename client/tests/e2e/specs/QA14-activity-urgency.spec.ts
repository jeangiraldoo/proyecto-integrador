import { test, expect } from "@playwright/test";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

test.describe("QA-14 | US-4 - Ver actividades urgentes (prioridades 'hoy')", () => {
	// FIX SENIOR: Aumentamos el timeout global a 3 minutos para tolerar los Cold Starts
	// de Vercel y Supabase. Las infraestructuras serverless gratuitas pueden tardar en despertar.
	test.setTimeout(180000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		const timestamp = Date.now();

		await page.goto("/registro", { timeout: 60000 });

		await page.locator('input[name="username"]').fill(`qa14_${timestamp}`);
		await page.locator('input[name="email"]').fill(`qa14_${timestamp}@test.com`);
		await page.locator('input[name="password"]').fill("SuperPassword123!");
		await page.locator('input[name="passwordConfirm"]').fill("SuperPassword123!");

		await page.locator('button[type="submit"]').click();

		// GARANTÍA 1: Esperamos el toast de cuenta creada. Esto nos asegura que la BD respondió.
		await expect(
			page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /cuenta/i })
				.first(),
		).toBeVisible({ timeout: 60000 });

		// GARANTÍA 2: Esperamos que el enrutador de React nos lleve a la vista Hoy.
		await page.waitForURL("**/hoy", { timeout: 30000 });

		// GARANTÍA 3: Esperamos a que el spinner desaparezca y el Toolbar del Kanban se renderice.
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 30000 });
		await expect(page.getByTestId("today-toolbar")).toBeVisible({ timeout: 20000 });
	});

	test("E2E Test: Renderizado correcto, estados vacios y reglas de ordenamiento reales", async ({
		page,
	}) => {
		const TIMESTAMP = Date.now();
		const SUBJECT_NAME = `QA14_Materia_${TIMESTAMP}`;
		const ACTIVITY_NAME = `QA14_Actividad_${TIMESTAMP}`;

		const today = new Date();

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
			// El pill superior debe indicar que no hay tareas
			await expect(page.getByTestId("today-summary-pill")).toContainText(/Sin tareas/i, {
				timeout: 15000,
			});

			// El tab "Para hoy" debe ser visible y el mensaje de "Nada por aquí" debe aparecer
			await expect(page.getByTestId("today-tab-today")).toBeVisible();
			await expect(page.getByText(/Nada por aquí/i).first()).toBeVisible({ timeout: 5000 });
		});

		// ====================================================================
		// STEP 2: Data Preparation (Creación E2E en la BD Real)
		// ====================================================================
		await test.step("2. Preparación: Crear tareas con fechas y horas específicas", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 15000 });

			await page.getByRole("button", { name: /Nueva actividad/i }).click();
			const modal = page.locator(".ca-modal");
			await expect(modal).toBeVisible({ timeout: 10000 });

			await modal.locator(".ca-combobox-input").fill(SUBJECT_NAME);
			await modal.locator('input[id="ca-title"]').fill(ACTIVITY_NAME);
			await modal.locator('input[id="ca-due-date"]').fill(dueActivityStr);
			await modal.getByRole("button", { name: /Siguiente/i }).click();

			// Subtarea 1: Vencida Antigua (Hace 3 días)
			await modal.locator('input[id="st-title"]').fill("Vencida Antigua");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(pastOldStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Vencida Antigua")).toBeVisible({
				timeout: 5000,
			});

			// Subtarea 2: Vencida Reciente (Ayer)
			await modal.locator('input[id="st-title"]').fill("Vencida Reciente");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(pastRecentStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Vencida Reciente")).toBeVisible({
				timeout: 5000,
			});

			// Subtarea 3: Hoy Pesada (3h)
			await modal.locator('input[id="st-title"]').fill("Hoy Pesada");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(todayStr);
			await modal.locator('input[id="st-hours"]').fill("3");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Hoy Pesada")).toBeVisible({
				timeout: 5000,
			});

			// Subtarea 4: Hoy Ligera (1h)
			await modal.locator('input[id="st-title"]').fill("Hoy Ligera");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(todayStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Hoy Ligera")).toBeVisible({
				timeout: 5000,
			});

			// Subtarea 5: Próxima Cercana (Mañana)
			await modal.locator('input[id="st-title"]').fill("Proxima Cercana");
			await modal.locator('.ca-subform-date-wrapper input[type="date"]').fill(tomorrowStr);
			await modal.locator('input[id="st-hours"]').fill("1");
			await modal.getByRole("button", { name: /Añadir subtarea/i }).click();
			await expect(modal.locator(".ca-subtask-table").getByText("Proxima Cercana")).toBeVisible({
				timeout: 5000,
			});

			// Subtarea 6: Próxima Lejana (+3 días)
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
			await expect(toastCreada).toBeVisible({ timeout: 15000 });
		});

		// ====================================================================
		// STEP 3: Validation of Sorting Rules (Regla de Oro US-04)
		// ====================================================================
		await test.step("3. Validación: Reglas de ordenamiento reales en Vista Hoy", async () => {
			await page.getByRole("button", { name: "Hoy" }).click({ force: true });
			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
			await expect(page.getByTestId("today-toolbar")).toBeVisible({ timeout: 15000 });

			// Vencidas: Más antiguas primero (Fecha ASC)
			await page.getByTestId("today-tab-overdue").click();
			const overdueCards = page.locator('[data-testid="today-column-overdue"] [role="button"]');
			await expect(overdueCards.nth(0)).toContainText("Vencida Antigua", { timeout: 10000 });
			await expect(overdueCards.nth(1)).toContainText("Vencida Reciente", { timeout: 10000 });
			await expect(page.getByTestId("today-sort-hint")).toContainText(/más antiguas/i);

			// Para hoy: Menor esfuerzo primero (Horas ASC) -> La de 1h antes que la de 3h
			await page.getByTestId("today-tab-today").click();
			const todayCards = page.locator('[data-testid="today-column-today"] [role="button"]');
			await expect(todayCards.nth(0)).toContainText("Hoy Ligera", { timeout: 10000 });
			await expect(todayCards.nth(1)).toContainText("Hoy Pesada", { timeout: 10000 });
			await expect(page.getByTestId("today-sort-hint")).toContainText(/más rápidas/i);

			// Próximas: Más cercanas primero (Fecha ASC)
			await page.getByTestId("today-tab-upcoming").click();
			const upcomingCards = page.locator('[data-testid="today-column-upcoming"] [role="button"]');
			await expect(upcomingCards.nth(0)).toContainText("Proxima Cercana", { timeout: 10000 });
			await expect(upcomingCards.nth(1)).toContainText("Proxima Lejana", { timeout: 10000 });
			await expect(page.getByTestId("today-sort-hint")).toContainText(/más cercanas/i);
		});

		// ====================================================================
		// STEP 4: Cleanup
		// ====================================================================
		await test.step("4. Cleanup: Eliminar actividad completa", async () => {
			await page.getByRole("button", { name: "Organización" }).click({ force: true });
			await expect(page.locator("h1.page-title")).toContainText("Organización", { timeout: 15000 });

			await page.getByText(SUBJECT_NAME).click();

			const activityBlock = page.locator("div").filter({ hasText: ACTIVITY_NAME }).first();
			await expect(activityBlock).toBeVisible({ timeout: 10000 });

			await activityBlock.locator('button[title="Eliminar actividad"]').first().click();

			await page.getByRole("button", { name: /Sí, eliminar/i }).click();

			const toastEliminada = page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /eliminada/i })
				.first();
			await expect(toastEliminada).toBeVisible({ timeout: 15000 });
		});
	});
});
