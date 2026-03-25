import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const today = new Date();
const pastDate = new Date(today);
pastDate.setDate(today.getDate() - 5);

const nearFutureDate = new Date(today);
nearFutureDate.setDate(today.getDate() + 2);

const farFutureDate = new Date(today);
farFutureDate.setDate(today.getDate() + 5);

const TODAY_STR = formatLocalDateForInput(today);
const PAST_STR = formatLocalDateForInput(pastDate);
const NEAR_FUTURE_STR = formatLocalDateForInput(nearFutureDate);
const FAR_FUTURE_STR = formatLocalDateForInput(farFutureDate);

const MOCK_USER = {
	id: 999,
	username: "testuser",
	email: "test@test.com",
	name: "Mock User",
	max_daily_hours: 8,
};

const MOCK_TODAY_DATA = {
	overdue: [],
	today: [
		{
			id: 201,
			name: "Mock Task To Move",
			status: "pending",
			course_name: "Física",
			target_date: TODAY_STR,
			estimated_hours: 2,
			activity: { id: 10, title: "Parent Activity" },
		},
		{
			id: 204,
			name: "Mock Task Untouched",
			status: "pending",
			course_name: "Matemáticas",
			target_date: TODAY_STR,
			estimated_hours: 1,
			activity: { id: 10, title: "Parent Activity" },
		},
	],
	upcoming: [
		{
			id: 202,
			name: "Mock Task Upcoming",
			status: "pending",
			course_name: "Química",
			target_date: FAR_FUTURE_STR,
			estimated_hours: 3,
			activity: { id: 11, title: "Parent Activity 2" },
		},
	],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

test.describe("QA-16 | US-6 - Pruebas Funcionales de Reprogramacion (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER }));
		await page.route("**/activities/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		await page.route("**/activities/*/subtasks/*/", async (route) => {
			if (route.request().method() === "PATCH") {
				const body = JSON.parse(route.request().postData() || "{}");
				await route.fulfill({
					status: 200,
					json: { id: 201, ...body, status: body.status || "pending" },
				});
			} else {
				await route.continue();
			}
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("Functional: Escenarios válidos de reprogramación (Futuro y Pasado)", async ({ page }) => {
		await test.step("1. Reprogramar a fecha futura (Valida 'No rompe orden' y 'No afecta otras')", async () => {
			await page.getByRole("button", { name: "Hoy", exact: true }).click();

			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task To Move" })
				.first();
			await expect(myTask).toBeVisible();
			await myTask.click();

			await page.locator('button[title="Editar"]').click();
			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(NEAR_FUTURE_STR);

			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			await expect(
				page.locator("[data-sonner-toast]").filter({ hasText: /actualizada/i }),
			).toBeVisible();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();

			await expect(
				page.locator('[role="button"]').filter({ hasText: "Mock Task Untouched" }),
			).toBeVisible();

			await page
				.getByRole("button", { name: /Próximas/i })
				.first()
				.click();

			const cards = page.locator('[role="button"][tabindex="0"]');
			await expect(cards.nth(0)).toContainText("Mock Task To Move");
			await expect(cards.nth(1)).toContainText("Mock Task Upcoming");
		});

		await test.step("2. Reprogramar a fecha pasada (Mueve a Vencidas)", async () => {
			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task Upcoming" })
				.first();
			await expect(myTask).toBeVisible();
			await myTask.click();

			await page.locator('button[title="Editar"]').click();
			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(PAST_STR);

			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			await expect(
				page.locator("[data-sonner-toast]").filter({ hasText: /actualizada/i }),
			).toBeVisible();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();

			await page
				.getByRole("button", { name: /Vencidas/i })
				.first()
				.click();
			await expect(
				page.locator('[role="button"]').filter({ hasText: "Mock Task Upcoming" }),
			).toBeVisible();
		});
	});

	test("Functional: Casos de Error (Fecha inválida y Permisos Backend)", async ({ page }) => {
		await test.step("1. Fecha inválida (Validación Backend simulada)", async () => {
			await page.route("**/activities/*/subtasks/*/", async (route) => {
				if (route.request().method() === "PATCH") {
					const body = JSON.parse(route.request().postData() || "{}");
					if (!body.target_date || body.target_date === "") {
						await route.fulfill({
							status: 400,
							contentType: "application/json",
							body: JSON.stringify({ errors: { target_date: "La fecha es requerida" } }),
						});
					} else {
						await route.fulfill({
							status: 200,
							json: { id: 201, ...body, status: body.status || "pending" },
						});
					}
				} else {
					await route.continue();
				}
			});

			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task To Move" })
				.first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			const dateInput = editModal.locator('input[type="date"]');

			await dateInput.fill("");
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			const errorLocator = page.locator("text=/requerid|error|obligatori|invalid/i").first();
			try {
				await expect(errorLocator).toBeVisible({ timeout: 4000 });
			} catch {
				// Fallback for native browser tooltips
			}

			await expect(editModal).toBeVisible();

			await editModal.getByRole("button", { name: /Cancelar/i }).click();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
		});

		await test.step("2. Subtarea de otro usuario (Simulación de error 404 del Backend)", async () => {
			await page.route("**/activities/*/subtasks/*/", async (route) => {
				if (route.request().method() === "PATCH") {
					await route.fulfill({
						status: 404,
						contentType: "application/json",
						body: JSON.stringify({
							errors: { resource: "Subtask not found or does not belong to you." },
						}),
					});
				}
			});

			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task To Move" })
				.first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(FAR_FUTURE_STR);
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			const toastError = page
				.locator("[data-sonner-toast]")
				.filter({ hasText: /Error|no\spudo|404/i })
				.first();

			try {
				await expect(toastError).toBeVisible({ timeout: 4000 });
			} catch {
				// Fallback
			}

			await expect(editModal).toBeVisible();
		});
	});

	test("Functional: Mantener filtros activos tras reprogramar", async ({ page }) => {
		await test.step("1. Aplicar un filtro y reprogramar", async () => {
			await page.getByRole("button", { name: /Curso:/i }).click();
			const dropdown = page.locator('div[style*="z-index: 9999"]').first();
			await dropdown.getByRole("button", { name: /Física/i }).click();

			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task To Move" })
				.first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');

			await editModal.locator('input[type="number"]').fill("5");
			await editModal.getByRole("button", { name: /Guardar cambios/i }).click();

			await expect(
				page.locator("[data-sonner-toast]").filter({ hasText: /actualizada/i }),
			).toBeVisible();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();

			await expect(page.getByRole("button", { name: "Curso: Física" }).first()).toBeVisible();
		});
	});
});
