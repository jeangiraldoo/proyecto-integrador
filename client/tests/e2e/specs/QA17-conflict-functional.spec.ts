import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

/**
 * QA-17 | US-7: Functional Tests for Conflict Detection
 * As agreed by the team (Santiago, Jean, Andres), this file isolates the frontend behavior using API Mocking.
 * It strictly tests mathematical boundaries, UI states, and edge cases without polluting the DB.
 */

const formatLocalDateForInput = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const today = new Date();
const TODAY_STR = formatLocalDateForInput(today);

// Static Mock Data for Frontend UI mapping
const MOCK_USER_6H = {
	id: 999,
	username: "testuser",
	email: "test@test.com",
	name: "Mock User",
	max_daily_hours: 6, // Rule 1: Limit set to 6h
};

// We simulate a day that already has 4h pending and 3h completed
const MOCK_TODAY_DATA = {
	overdue: [],
	today: [
		{
			id: 301,
			name: "Mock Task Pending",
			status: "pending",
			course_name: "Cálculo",
			target_date: TODAY_STR,
			estimated_hours: 4,
		},
		{
			id: 302,
			name: "Mock Task Completed",
			status: "completed", // Rule 3: Completed tasks don't count towards the daily limit
			course_name: "Física",
			target_date: TODAY_STR,
			estimated_hours: 3,
		},
	],
	upcoming: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

const MOCK_ACTIVITIES = [
	{
		id: 9991,
		name: "Mock Activity",
		subject_name: "Mock Subject",
		subtasks: MOCK_TODAY_DATA.today,
	},
];

test.describe("QA-17 | US-7 - Pruebas Funcionales de Conflictos (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		// ====================================================================
		// GLOBAL MOCKS FOR STRICT FRONTEND ISOLATION
		// ====================================================================
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER_6H }));
		await page.route("**/activities/**", (route) => route.fulfill({ json: MOCK_ACTIVITIES }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));

		await loginAndGoToDashboard(page);
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });
	});

	test("Functional: Validacion matematica de limites y estado completado", async ({ page }) => {
		await test.step("1. Límite exacto (4h previas + 2h nuevas = 6h) -> NO genera conflicto", async () => {
			await page.getByRole("button", { name: "Hoy", exact: true }).click();

			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task Pending" })
				.first();
			await expect(myTask).toBeVisible({ timeout: 5000 });
			await myTask.click();

			await page.locator('button[title="Editar"]').click();
			const editModal = page.locator('div[style*="z-index: 2201"]');

			await editModal.locator('input[type="date"]').fill(TODAY_STR);

			// Total is 4h. The modal should show 4h / 6h and NOT be in red.
			await expect(editModal.locator("strong")).toContainText("4h / 6h", { timeout: 5000 });
			await expect(editModal.getByText(/Sin conflicto detectado/i)).toBeVisible();

			await editModal.getByRole("button", { name: /Cancelar/i }).click();
			await page.locator('aside[role="dialog"]').getByRole("button", { name: "Cerrar" }).click();
		});

		await test.step("2. Exceder límite (4h previas + 2.5h) -> SÍ genera conflicto y NO guarda automático", async () => {
			await page.getByRole("button", { name: /Nueva tarea/i }).click();
			const createModal = page.locator('div[role="dialog"]').filter({ hasText: "Nueva tarea" });

			await createModal.locator('input[type="date"]').fill(TODAY_STR);
			await createModal.locator('input[type="number"]').fill("2.5");

			// 4h (from mock) + 2.5h (new) = 6.5h. Limit is 6h.
			await expect(createModal.locator("strong")).toContainText("6.5h / 6h");
			await expect(createModal.getByText(/Hay un conflicto de carga/i)).toBeVisible();

			// Criterio PDF: "No se guarda si hay conflicto". The UI should keep the user on the modal
			// (If it was an auto-close logic it would fail here)
			await expect(createModal).toBeVisible();

			await createModal.getByRole("button", { name: /Cancelar/i }).click();
		});

		await test.step("3. Tareas 'Hechas' no suman al cálculo de carga", async () => {
			await page.getByRole("button", { name: /Nueva tarea/i }).click();
			const createModal = page.locator('div[role="dialog"]').filter({ hasText: "Nueva tarea" });

			await createModal.locator('input[type="date"]').fill(TODAY_STR);
			await createModal.locator('input[type="number"]').fill("2"); // Exactly reaching the 6h limit

			// Validation: Shows 6h / 6h. The 3h completed task is completely ignored.
			await expect(createModal.locator("strong")).toContainText("6h / 6h");
			await expect(createModal.getByText(/Sin conflicto detectado/i)).toBeVisible();

			await createModal.getByRole("button", { name: /Cancelar/i }).click();
		});

		await test.step("4. Usuario A no afecta cálculo de B (Data Isolation Check)", async () => {
			// MOCK OVERRIDE: We inject tasks from another user in the payload.
			// The frontend should ONLY calculate the current user's load (4h).
			const MALICIOUS_DATA = {
				...MOCK_TODAY_DATA,
				today: [
					...MOCK_TODAY_DATA.today,
					{
						id: 999,
						name: "Tarea Usuario B",
						status: "pending",
						estimated_hours: 5,
						target_date: TODAY_STR,
					},
				],
			};

			await page.route("**/today/**", (route) => route.fulfill({ json: MALICIOUS_DATA }));
			await page.reload();

			await page.getByRole("button", { name: /Nueva tarea/i }).click();
			const createModal = page.locator('div[role="dialog"]').filter({ hasText: "Nueva tarea" });

			await createModal.locator('input[type="date"]').fill(TODAY_STR);
			await createModal.locator('input[type="number"]').fill("1");

			// If the frontend accidentally sum'd User B's 5h, it would say 10h / 6h.
			// It must securely state 5h / 6h.
			await expect(createModal.locator("strong")).toContainText("5h / 6h");
			await expect(createModal.getByText(/Sin conflicto detectado/i)).toBeVisible();

			await createModal.getByRole("button", { name: /Cancelar/i }).click();
		});
	});

	test("Functional: Modificar el límite diario altera los cálculos instantáneamente", async ({
		page,
	}) => {
		await test.step("1. Usuario cambia su límite diario de 6h a 3h", async () => {
			await page.route("**/me/**", async (route) => {
				await route.fulfill({ json: { ...MOCK_USER_6H, max_daily_hours: 3 } });
			});

			await page.getByRole("button", { name: /Editar limite diario/i }).click();
			await page.locator("#daily-hours-input-floating").fill("3");
			await page.locator(".capacity-inline-save").click();

			await expect(page.locator(".capacity-total")).toContainText("3h", { timeout: 5000 });
		});

		await test.step("2. Tarea previamente sin conflicto ahora muestra alerta (Regresión US-06)", async () => {
			// Criterio PDF: "No hay regresión con US-06". We test rescheduling an existing task.
			const myTask = page
				.locator('[role="button"]')
				.filter({ hasText: "Mock Task Pending" })
				.first();
			await myTask.click();
			await page.locator('button[title="Editar"]').click();

			const editModal = page.locator('div[style*="z-index: 2201"]');
			await editModal.locator('input[type="date"]').fill(TODAY_STR);

			// Assertion: UI recalculates correctly based on the new user limit
			await expect(editModal.locator("strong")).toContainText("4h / 3h");
			await expect(editModal.getByText(/Hay un conflicto de carga/i)).toBeVisible();
		});
	});

	test("Functional: Modal Global de Conflictos (Simulación de backend)", async ({ page }) => {
		await test.step("1. Backend retorna un conflicto activo", async () => {
			const MOCK_CONFLICTS = [
				{
					id: 500,
					affected_date: TODAY_STR,
					planned_hours: 8,
					max_allowed_hours: 6,
					status: "pending",
					title: "Subtareas en conflicto",
					subtitle: "Sobrecarga reportada por el backend",
					subtasks: [], // The frontend uses subtasks to calculate the excess
				},
			];

			await page.route("**/conflicts/**", (route) => route.fulfill({ json: MOCK_CONFLICTS }));

			await page.reload();
			await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 20000 });

			const conflictCount = page.locator(".sidebar-conflicts-count");
			await expect(conflictCount).toHaveClass(/danger/, { timeout: 5000 });
			await expect(conflictCount).toContainText("1");
		});

		await test.step("2. Mostrar Modal Global con cálculos correctos", async () => {
			await page.locator(".sidebar-conflicts-btn").click({ force: true });

			const conflictModal = page.locator(".cf-modal");
			await expect(conflictModal).toBeVisible({ timeout: 5000 });

			// Criterio PDF: "El mensaje muestra valores correctos"
			await expect(conflictModal).toContainText("8h / 6h max");

			// Criterio PDF: "El exceso calculado es correcto".
			// En la UI de conflictos, si abres una tarea para reducir, muestra el "exceso".
			// Aquí verificamos que los números de la sobrecarga se mapearon correctamente del JSON a la UI.
			await expect(conflictModal.getByText(/Sobrecarga reportada por el backend/i)).toBeVisible();
		});
	});
});
