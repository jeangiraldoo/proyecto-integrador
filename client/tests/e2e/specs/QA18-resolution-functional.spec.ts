import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const TODAY_STR = formatLocalDateForInput(today);
const TOMORROW_STR = formatLocalDateForInput(tomorrow);

const MOCK_USER_6H = {
	id: 999,
	username: "qa18_user",
	email: "qa18@test.com",
	name: "Mock User",
	max_daily_hours: 6,
};

const MOCK_ACTIVITIES = [
	{
		id: 888,
		title: "Actividad Compleja",
		course_name: "Testing QA",
		subtasks: [
			{
				id: 101,
				name: "Tarea Pesada",
				status: "pending",
				estimated_hours: 4,
				target_date: TODAY_STR,
			},
			{
				id: 102,
				name: "Tarea Ligera",
				status: "pending",
				estimated_hours: 4,
				target_date: TODAY_STR,
			},
		],
	},
];

const MOCK_TODAY_DATA = {
	overdue: [],
	today: MOCK_ACTIVITIES[0].subtasks,
	upcoming: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

const INITIAL_CONFLICT = {
	id: 500,
	affected_date: TODAY_STR,
	planned_hours: 8,
	max_allowed_hours: 6,
	status: "pending",
};

test.describe("QA-18 | US-8 - Pruebas Funcionales de Resolución de Conflictos (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER_6H }));
		await page.route("**/activities/**", (route) => route.fulfill({ json: MOCK_ACTIVITIES }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		await page.route("**/conflicts/**", (route) => {
			if (route.request().method() === "GET") {
				route.fulfill({ json: [INITIAL_CONFLICT] });
			} else {
				route.continue();
			}
		});

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("Functional: Resolver reduciendo -> éxito y Persistencia (con Regla de Prioridad)", async ({
		page,
	}) => {
		await test.step("1. Abrir Modal de Conflictos y reducir horas a un nivel seguro", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible();

			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("2");
			await resolverLayer.getByRole("button", { name: /Guardar horas/i }).click();

			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada|actualizada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });

			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);
		});

		await test.step("2. Persistencia tras recargar y Regla de Prioridad (AC #3)", async () => {
			await page.route("**/today/**", async (route) => {
				await route.fulfill({
					json: {
						...MOCK_TODAY_DATA,
						today: [
							MOCK_TODAY_DATA.today[1], // Tarea Ligera (4h)
							{ ...MOCK_TODAY_DATA.today[0], estimated_hours: 2 }, // Tarea Pesada (2h)
						],
					},
				});
			});

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);

			await page
				.getByRole("button", { name: /Para hoy/i })
				.first()
				.click();

			const cards = page.locator('div[role="button"][tabindex="0"]');

			await expect(cards.nth(0)).toContainText("Tarea Pesada", { timeout: 10000 });
			await expect(cards.nth(1)).toContainText("Tarea Ligera", { timeout: 10000 });
		});
	});

	test("Functional: Resolver reduciendo -> conflicto persiste", async ({ page }) => {
		await test.step("1. Reducir horas pero mantener un estado de sobrecarga", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, planned_hours: 7 }],
				}),
			);

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("3");
			await resolverLayer.getByRole("button", { name: /Guardar horas/i }).click();

			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			await expect(conflictModal.getByText("7h / 6h max")).toBeVisible();
		});
	});

	test("Functional: Resolver moviendo -> éxito", async ({ page }) => {
		await test.step("1. Cambiar fecha a un día libre", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);
			await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Cambiar fecha/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="date"]').fill(TOMORROW_STR);
			await resolverLayer.getByRole("button", { name: /Guardar fecha/i }).click();

			await expect(
				page
					.locator("[data-sonner-toast]")
					.filter({ hasText: /recalculada/i })
					.first(),
			).toBeVisible({ timeout: 8000 });
			await expect(page.locator(".sidebar-conflicts-count")).not.toHaveClass(/danger/);
		});
	});

	test("Functional: Resolver moviendo -> conflicto persiste", async ({ page }) => {
		await test.step("1. Cambiar fecha a un día que también está sobrecargado", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			await page.route("**/activities/*/subtasks/*/", (route) =>
				route.fulfill({ status: 200, json: {} }),
			);

			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, affected_date: TOMORROW_STR, planned_hours: 9 }],
				}),
			);

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Pesada" })
				.first();
			await conflictRow.getByRole("button", { name: /Cambiar fecha/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="date"]').fill(TOMORROW_STR);
			await resolverLayer.getByRole("button", { name: /Guardar fecha/i }).click();

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });

			const reloadedConflictModal = page.locator(".cf-modal");
			await expect(reloadedConflictModal).toBeVisible({ timeout: 5000 });
			await expect(reloadedConflictModal.getByText("9h / 6h max")).toBeVisible({ timeout: 5000 });
		});
	});

	test("Functional: Cancelar -> no hay cambios y Data Isolation", async ({ page }) => {
		await test.step("1. Cancelar mantiene los datos intactos", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			const conflictRow = conflictModal
				.locator(".cf-subtask-row")
				.filter({ hasText: "Tarea Ligera" })
				.first();
			await conflictRow.getByRole("button", { name: /Ajustar horas/i }).click();

			const resolverLayer = page.locator(".cf-resolver-layer");
			await resolverLayer.locator('input[type="number"]').fill("1");

			await resolverLayer.getByRole("button", { name: /Cancelar/i }).click();

			await expect(resolverLayer).toBeHidden();
			await expect(conflictModal.getByText("8h / 6h max")).toBeVisible();
		});

		await test.step("2. No afecta subtareas de otros usuarios (Data Isolation)", async () => {
			await page.route("**/conflicts/**", (route) =>
				route.fulfill({
					json: [{ ...INITIAL_CONFLICT, affected_date: "2099-01-01" }],
				}),
			);

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			await page.locator(".sidebar-conflicts-btn").click({ force: true });
			const conflictModal = page.locator(".cf-modal");

			await expect(
				conflictModal.getByText(/No se encontraron subtareas detalladas para esta fecha/i),
			).toBeVisible();
		});
	});
});
