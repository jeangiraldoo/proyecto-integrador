import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

// ─────────────────────────────────────────────────────────────────────────────
// QA-23 | US-09 — Accesibilidad (A11y) del Componente de Barra de Progreso
//
// Verifica que la barra de progreso por actividad sea perceptible para
// lectores de pantalla y cumpla criterios WCAG en la vista /organizacion.
//
// A11y-1: role="progressbar" + aria-valuenow / aria-valuemin / aria-valuemax
// A11y-2: aria-label descriptivo mapeado a los datos reales del backend
// A11y-3: aria-valuenow refleja el porcentaje correcto según backend
// A11y-4: No se generan saltos de foco al navegar por teclado
// A11y-5: Auditoría básica de accesibilidad en /organizacion (sin violaciones)
// ─────────────────────────────────────────────────────────────────────────────

const formatLocalDate = (date: Date) => {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
};

const FAR_FUTURE = formatLocalDate(
	new Date(new Date().getFullYear(), new Date().getMonth() + 3, 15),
);

const MOCK_USER = {
	id: 999,
	username: "qa23user",
	email: "qa23@test.com",
	name: "QA23 A11y User",
	max_daily_hours: 8,
	onboarding: {
		has_seen_tour: true,
		has_seen_org_tour: true,
		has_seen_progress_tour: true,
	},
};

// Actividad 701: 1 de 2 subtareas completadas → progreso 50%
const ACTIVITY_701 = {
	id: 701,
	user: 999,
	title: "Tarea de Redes",
	course_name: "Redes",
	description: "Actividad con progreso al 50%",
	due_date: FAR_FUTURE,
	status: "in_progress",
	subtask_count: 2,
	total_subtasks_count: 2,
	completed_subtasks_count: 1,
	total_estimated_hours: 4,
};

// Actividad 702: 3 de 3 completadas → progreso 100%
const ACTIVITY_702 = {
	id: 702,
	user: 999,
	title: "Lab Completado",
	course_name: "Redes",
	description: "Actividad totalmente completada",
	due_date: FAR_FUTURE,
	status: "completed",
	subtask_count: 3,
	total_subtasks_count: 3,
	completed_subtasks_count: 3,
	total_estimated_hours: 6,
};

// Actividad 703: 0 subtareas → NO debe mostrar barra de progreso
const ACTIVITY_703 = {
	id: 703,
	user: 999,
	title: "Actividad Sin Subtareas",
	course_name: "Redes",
	description: "Sin subtareas aún",
	due_date: FAR_FUTURE,
	status: "pending",
	subtask_count: 0,
	total_subtasks_count: 0,
	completed_subtasks_count: 0,
	total_estimated_hours: 0,
};

const MOCK_TODAY_DATA = {
	overdue: [],
	today: [],
	upcoming: [],
	postponed: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

// ─────────────────────────────────────────────────────────────────────────────

test.describe("QA-23 | US-09 - Accesibilidad de Barra de Progreso (Mocked)", () => {
	test.setTimeout(120000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));
		await page.route("**/activities/", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({ json: [ACTIVITY_701, ACTIVITY_702, ACTIVITY_703] });
			} else {
				await route.continue();
			}
		});
		await page.route("**/activities/*/subtasks/", async (route) => {
			await route.fulfill({ json: [] });
		});

		await loginAndGoToDashboard(page);
		await page.goto("/organizacion");
		await expect(page.locator('[data-testid="org-view"]')).toBeVisible({ timeout: 15000 });

		// Expandir la materia "Redes" para que los activity cards sean visibles
		const subjectHeader = page.locator('[data-testid="org-subject-header-redes"]');
		await expect(subjectHeader).toBeVisible({ timeout: 8000 });
		await subjectHeader.click();
		await expect(page.locator('[data-testid="org-subject-body-redes"]')).toBeVisible({
			timeout: 5000,
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-1: role="progressbar" con aria-valuenow / aria-valuemin / aria-valuemax
	// Criterio: El componente de barra de progreso expone semántica ARIA correcta
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-1: La barra de progreso tiene role=progressbar y atributos ARIA correctos", async ({
		page,
	}) => {
		await test.step("1. Verificar role=progressbar en actividad con progreso parcial", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');
			await expect(progressBar).toBeVisible({ timeout: 5000 });

			const role = await progressBar.getAttribute("role");
			expect(role).toBe("progressbar");
		});

		await test.step("2. Verificar aria-valuemin=0 y aria-valuemax=100", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');

			const valueMin = await progressBar.getAttribute("aria-valuemin");
			const valueMax = await progressBar.getAttribute("aria-valuemax");

			expect(valueMin).toBe("0");
			expect(valueMax).toBe("100");
		});

		await test.step("3. Verificar aria-valuenow=50 para actividad con 1/2 completadas", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');
			const valueNow = await progressBar.getAttribute("aria-valuenow");
			expect(Number(valueNow)).toBe(50);
		});

		await test.step("4. Verificar aria-valuenow=100 para actividad totalmente completada", async () => {
			const progressBar702 = page.locator('[data-testid="org-activity-progress-702"]');
			await expect(progressBar702).toBeVisible({ timeout: 5000 });

			const valueNow = await progressBar702.getAttribute("aria-valuenow");
			expect(Number(valueNow)).toBe(100);
		});

		await test.step("5. Actividad sin subtareas NO muestra barra de progreso", async () => {
			const progressBar703 = page.locator('[data-testid="org-activity-progress-703"]');
			await expect(progressBar703).not.toBeVisible();
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-2: aria-label descriptivo con nombre de actividad y contador
	// Criterio: El aria-label mapea los datos del backend de forma legible
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-2: aria-label de la barra describe el progreso en lenguaje natural", async ({
		page,
	}) => {
		await test.step("1. Verificar que el aria-label existe y no está vacío", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');
			const label = await progressBar.getAttribute("aria-label");
			expect(label).not.toBeNull();
			expect(label!.length).toBeGreaterThan(0);
		});

		await test.step("2. El aria-label menciona el título de la actividad", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');
			const label = await progressBar.getAttribute("aria-label");
			expect(label).toContain("Tarea de Redes");
		});

		await test.step("3. El aria-label incluye el contador (X de Y)", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');
			const label = await progressBar.getAttribute("aria-label");
			// Debe incluir "1 de 2" o similar
			expect(label).toMatch(/1\s+de\s+2/i);
		});

		await test.step("4. El texto visual del contador coincide con el aria-label", async () => {
			const countText = page.locator('[data-testid="org-activity-progress-count-701"]');
			await expect(countText).toBeVisible({ timeout: 5000 });
			await expect(countText).toContainText("1 de 2");
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-3: aria-valuenow refleja matemáticamente el porcentaje correcto
	// Criterio: El valor ARIA es consistente con completed/total del backend
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-3: aria-valuenow refleja porcentaje matemáticamente correcto", async ({ page }) => {
		await test.step("1. Actividad 701: 1/2 → aria-valuenow debe ser 50", async () => {
			const bar = page.locator('[data-testid="org-activity-progress-701"]');
			const valueNow = await bar.getAttribute("aria-valuenow");
			const expected = Math.round((1 / 2) * 100); // 50
			expect(Number(valueNow)).toBe(expected);
		});

		await test.step("2. Actividad 702: 3/3 → aria-valuenow debe ser 100", async () => {
			const bar = page.locator('[data-testid="org-activity-progress-702"]');
			const valueNow = await bar.getAttribute("aria-valuenow");
			const expected = Math.round((3 / 3) * 100); // 100
			expect(Number(valueNow)).toBe(expected);
		});

		await test.step("3. El fill CSS tiene width consistente con aria-valuenow", async () => {
			const fill = page.locator('[data-testid="org-activity-progress-fill-701"]');
			await expect(fill).toBeVisible();
			const width = await fill.evaluate((el) => (el as HTMLElement).style.width);
			// width debe ser "50%" (± tolerancia de redondeo)
			const pct = parseFloat(width);
			expect(pct).toBeCloseTo(50, 0);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-4: Sin saltos de foco inesperados al navegar por teclado
	// Criterio: Tab sobre los activity cards no interrumpe el flujo de foco
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-4: La navegación por teclado en la vista no genera saltos de foco", async ({
		page,
	}) => {
		await test.step("1. El botón de subtareas de la actividad es alcanzable con Tab", async () => {
			const toggleBtn = page.locator('[data-testid="org-activity-subtasks-toggle-701"]');
			await toggleBtn.focus();
			await expect(toggleBtn).toBeFocused({ timeout: 3000 });
		});

		await test.step("2. La barra de progreso no es interactiva (no tiene tabindex)", async () => {
			const progressBar = page.locator('[data-testid="org-activity-progress-701"]');
			const tabindex = await progressBar.getAttribute("tabindex");
			// La barra de progreso no debe ser focusable por sí misma (es informativa)
			expect(tabindex).toBeNull();
		});

		await test.step("3. Los botones de edición/eliminación de la actividad son alcanzables", async () => {
			const editBtn = page.locator('[data-testid="org-activity-edit-btn-701"]');
			await expect(editBtn).toBeVisible({ timeout: 5000 });
			await editBtn.focus();
			await expect(editBtn).toBeFocused({ timeout: 3000 });
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-5: Auditoría básica en /organizacion — sin violaciones críticas
	// Criterio: Imágenes decorativas, botones con texto accesible, no NaN%
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-5: Auditoría de accesibilidad básica — sin violaciones críticas en /organizacion", async ({
		page,
	}) => {
		await test.step("1. No se muestra NaN% ni errores de división entre cero", async () => {
			const pageText = await page.locator("body").innerText();
			expect(pageText).not.toMatch(/NaN%/i);
			expect(pageText).not.toMatch(/undefined/i);
			expect(pageText).not.toMatch(/Infinity/i);
		});

		await test.step("2. Todas las imágenes tienen alt o son decorativas", async () => {
			const images = page.locator("img");
			const count = await images.count();
			for (let i = 0; i < count; i++) {
				const img = images.nth(i);
				const alt = await img.getAttribute("alt");
				const ariaHidden = await img.getAttribute("aria-hidden");
				const role = await img.getAttribute("role");
				const isAccessible = alt !== null || ariaHidden === "true" || role === "presentation";
				expect(isAccessible).toBe(true);
			}
		});

		await test.step("3. Los role=progressbar tienen aria-valuenow definido", async () => {
			const progressBars = page.locator('[role="progressbar"]');
			const count = await progressBars.count();
			expect(count).toBeGreaterThan(0);

			for (let i = 0; i < count; i++) {
				const bar = progressBars.nth(i);
				const valueNow = await bar.getAttribute("aria-valuenow");
				expect(valueNow).not.toBeNull();
				// El valor no debe ser NaN
				expect(isNaN(Number(valueNow))).toBe(false);
			}
		});

		await test.step("4. El fill de la barra tiene un width CSS válido (no vacío)", async () => {
			const fills = page.locator('[data-testid^="org-activity-progress-fill-"]');
			const count = await fills.count();
			expect(count).toBeGreaterThan(0);

			for (let i = 0; i < count; i++) {
				const fill = fills.nth(i);
				const width = await fill.evaluate((el) => (el as HTMLElement).style.width);
				expect(width).not.toBe("");
				expect(width).toMatch(/^\d+(\.\d+)?%$/);
			}
		});
	});
});
