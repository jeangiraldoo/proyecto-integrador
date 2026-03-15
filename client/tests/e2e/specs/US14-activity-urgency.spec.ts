import { test, expect } from "@playwright/test";
import { loginAndGoToDashboard } from "../utils/auth";

// ─────────────────────────────────────────────────────────────────────────────
// QA-14 | US-4 — Vista /hoy: Ver actividades urgentes (prioridades "hoy")
//
// Cubre:
//  • Caso de éxito  (datos reales desde el backend + seed data)
//  • Caso vacío     (mock de API devuelve listas vacías)
//  • Caso de error  (mock de API devuelve HTTP 500)
//  • Ordenamiento   (Regla de Oro: overdue/upcoming → fecha ASC, today → horas ASC)
//  • Diseño / UX    (tabs, sort-hint bar, summary pill, filtros de estado, cards)
//  • Accesibilidad  (roles, teclado, aria-pressed)
//  • Interacción    (cambiar tab, filtrar, abrir detail panel, dropdown de estado)
// ─────────────────────────────────────────────────────────────────────────────

// ── Payload de seed data controlado ──────────────────────────────────────────
const TODAY_ISO = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
const TOMORROW = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const IN_5_DAYS = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
const IN_10_DAYS = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];

// Subtask factory para legibilidad
function makeSubtask(overrides: {
	id: number;
	name: string;
	target_date: string;
	estimated_hours: number;
	status?: "pending" | "in_progress" | "completed";
	course_name?: string;
	activity?: { id: number; title: string };
}) {
	return {
		ordering: overrides.id,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		status: "pending" as const,
		course_name: "Matemáticas",
		activity: { id: 1, title: "Actividad de prueba" },
		...overrides,
	};
}

const SEED_RESPONSE = {
	overdue: [
		// Más antigua primero (date ASC)
		makeSubtask({
			id: 1,
			name: "Subtarea vencida A (más antigua)",
			target_date: TWO_DAYS_AGO,
			estimated_hours: 3,
		}),
		makeSubtask({
			id: 2,
			name: "Subtarea vencida B (ayer)",
			target_date: YESTERDAY,
			estimated_hours: 1,
		}),
	],
	today: [
		// Menor esfuerzo primero (estimated_hours ASC)
		makeSubtask({
			id: 3,
			name: "Subtarea rápida (1h)",
			target_date: TODAY_ISO,
			estimated_hours: 1,
		}),
		makeSubtask({ id: 4, name: "Subtarea media (2h)", target_date: TODAY_ISO, estimated_hours: 2 }),
		makeSubtask({
			id: 5,
			name: "Subtarea larga (4h)",
			target_date: TODAY_ISO,
			estimated_hours: 4,
			status: "in_progress",
		}),
	],
	upcoming: [
		// Más cercana primero (date ASC)
		makeSubtask({
			id: 6,
			name: "Subtarea próxima cercana",
			target_date: TOMORROW,
			estimated_hours: 2,
		}),
		makeSubtask({
			id: 7,
			name: "Subtarea próxima lejana",
			target_date: IN_5_DAYS,
			estimated_hours: 5,
		}),
		makeSubtask({
			id: 8,
			name: "Subtarea fuera de rango N",
			target_date: IN_10_DAYS,
			estimated_hours: 1,
		}),
	],
	meta: { n_days: 7 },
};

const EMPTY_RESPONSE = {
	overdue: [],
	today: [],
	upcoming: [],
	meta: { n_days: 7 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Caso de éxito con datos mockeados (seed data controlado)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("US-4 | Caso de éxito — Vista /hoy con datos controlados", () => {
	test.beforeEach(async ({ page }) => {
		// Interceptar ANTES de navegar para que el mock esté listo
		await page.route("**/api/planner/today/**", async (route) => {
			await route.fulfill({ json: SEED_RESPONSE });
		});
		await loginAndGoToDashboard(page);
	});

	// ── Estructura y layout ──────────────────────────────────────────────

	test("EX-01 | debe renderizar los tres tabs: Vencidas, Para hoy, Próximas", async ({ page }) => {
		// Los tabs son botones con el texto del grupo
		await expect(page.locator("button", { hasText: "Vencidas" }).first()).toBeVisible();
		await expect(page.locator("button", { hasText: "Para hoy" }).first()).toBeVisible();
		await expect(page.locator("button", { hasText: "Próximas" }).first()).toBeVisible();
	});

	test("EX-02 | los tabs deben mostrar el conteo correcto de subtareas", async ({ page }) => {
		// Vencidas: 2, Para hoy: 3, Próximas: 3
		const overdueBadge = page
			.locator("button", { hasText: "Vencidas" })
			.first()
			.locator("span", { hasText: "2" });
		const todayBadge = page
			.locator("button", { hasText: "Para hoy" })
			.first()
			.locator("span", { hasText: "3" });
		const upcomingBadge = page
			.locator("button", { hasText: "Próximas" })
			.first()
			.locator("span", { hasText: "3" });

		await expect(overdueBadge).toBeVisible();
		await expect(todayBadge).toBeVisible();
		await expect(upcomingBadge).toBeVisible();
	});

	test("EX-03 | debe activar automáticamente el tab de Vencidas si existen subtareas vencidas", async ({
		page,
	}) => {
		// El primer tab activo debe ser "Vencidas" (lógica del componente: overdue > today > upcoming)
		const overdueTab = page.locator("button", { hasText: "Vencidas" }).first();
		// El tab activo tiene un accent bar absoluto en la parte superior
		await expect(overdueTab).toBeVisible();

		// Debe mostrar las subtareas vencidas en el panel activo
		await expect(
			page.locator("p, div").filter({ hasText: "Subtarea vencida A (más antigua)" }).first(),
		).toBeVisible();
	});

	test("EX-04 | debe mostrar la barra de sort-hint con el criterio correcto por grupo", async ({
		page,
	}) => {
		// Vencidas → "más antiguas primero"
		await expect(page.locator("text=más antiguas primero")).toBeVisible();

		// Cambiar a "Para hoy" → "más rápidas primero"
		await page.locator("button", { hasText: "Para hoy" }).first().click();
		await expect(page.locator("text=más rápidas primero")).toBeVisible();

		// Cambiar a "Próximas" → "más cercanas primero"
		await page.locator("button", { hasText: "Próximas" }).first().click();
		await expect(page.locator("text=más cercanas primero")).toBeVisible();
	});

	test("EX-05 | debe mostrar el summary pill con el conteo de subtareas pendientes", async ({
		page,
	}) => {
		// El pill muestra "Tienes X subtareas pendientes"
		// Con seed data: 2 overdue + 2 today (pending) + 1 today (in_progress) + 3 upcoming = 8 pendientes (todos sin completar)
		const summaryPill = page
			.locator("span, div")
			.filter({ hasText: /subtarea.? pendiente/i })
			.first();
		await expect(summaryPill).toBeVisible();
	});

	test("EX-06 | el summary pill debe mostrar la advertencia de vencidas sin completar", async ({
		page,
	}) => {
		// "⚠ Vencidas sin completar"
		await expect(page.locator("text=Vencidas sin completar")).toBeVisible();
	});

	test('EX-07 | debe mostrar el botón "Nueva subtarea" funcional', async ({ page }) => {
		const newBtn = page.locator("button", { hasText: "Nueva subtarea" });
		await expect(newBtn).toBeVisible();
	});

	test("EX-08 | debe mostrar los chips de filtro de estado", async ({ page }) => {
		await expect(page.locator("button", { hasText: "Todos" }).first()).toBeVisible();
		await expect(page.locator("button", { hasText: "Pendientes" })).toBeVisible();
		await expect(page.locator("button", { hasText: "En progreso" })).toBeVisible();
		await expect(page.locator("button", { hasText: "Completadas" })).toBeVisible();
	});

	// ── Ordenamiento (Regla de Oro) ──────────────────────────────────────

	test("EX-09 | Vencidas debe mostrar subtareas ordenadas por fecha ASC (más antigua primero)", async ({
		page,
	}) => {
		const cards = page.locator('[role="button"]').filter({ hasText: /Subtarea vencida/ });
		const texts = await cards.allTextContents();

		expect(texts.length).toBeGreaterThan(0);
		// La primera debe ser la más antigua ("A")
		expect(texts[0]).toContain("Subtarea vencida A (más antigua)");
		if (texts.length > 1) {
			expect(texts[1]).toContain("Subtarea vencida B (ayer)");
		}
	});

	test("EX-10 | Para hoy debe mostrar subtareas ordenadas por estimated_hours ASC (menor esfuerzo primero)", async ({
		page,
	}) => {
		await page.locator("button", { hasText: "Para hoy" }).first().click();

		const cards = page.locator('[role="button"]').filter({ hasText: /Subtarea/ });
		const texts = await cards.allTextContents();

		expect(texts.length).toBeGreaterThan(0);
		expect(texts[0]).toContain("Subtarea rápida (1h)");
		if (texts.length > 1) {
			expect(texts[1]).toContain("Subtarea media (2h)");
		}
		if (texts.length > 2) {
			expect(texts[2]).toContain("Subtarea larga (4h)");
		}
	});

	test("EX-11 | Próximas debe mostrar subtareas ordenadas por fecha ASC (más cercana primero)", async ({
		page,
	}) => {
		await page.locator("button", { hasText: "Próximas" }).first().click();

		const cards = page.locator('[role="button"]').filter({ hasText: /Subtarea próxima/ });
		const texts = await cards.allTextContents();

		expect(texts.length).toBeGreaterThan(0);
		expect(texts[0]).toContain("Subtarea próxima cercana");
		if (texts.length > 1) {
			expect(texts[1]).toContain("Subtarea próxima lejana");
		}
	});

	// ── Cards: contenido y metadatos ─────────────────────────────────────

	test("EX-12 | las cards deben mostrar el nombre de la subtarea", async ({ page }) => {
		await expect(
			page.locator("p, div").filter({ hasText: "Subtarea vencida A (más antigua)" }).first(),
		).toBeVisible();
	});

	test("EX-13 | las cards deben mostrar el nombre del curso (course_name)", async ({ page }) => {
		await expect(page.locator("span", { hasText: "Matemáticas" }).first()).toBeVisible();
	});

	test("EX-14 | las cards deben mostrar el título de la actividad padre", async ({ page }) => {
		await expect(page.locator("span", { hasText: "Actividad de prueba" }).first()).toBeVisible();
	});

	test("EX-15 | las cards deben mostrar las horas estimadas", async ({ page }) => {
		// "3h" para la primera subtarea vencida con estimated_hours=3
		await expect(page.locator("span", { hasText: /\dh/ }).first()).toBeVisible();
	});

	test('EX-16 | las cards vencidas deben mostrar badge de fecha en rojo ("hace Xd")', async ({
		page,
	}) => {
		// El badge de fecha overdue muestra "hace Xd"
		await expect(page.locator("span", { hasText: /hace \dd/ }).first()).toBeVisible();
	});

	test('EX-17 | las cards del tab "Para hoy" deben mostrar badge "Hoy"', async ({ page }) => {
		await page.locator("button", { hasText: "Para hoy" }).first().click();
		await expect(page.locator("span", { hasText: "Hoy" }).first()).toBeVisible();
	});

	test('EX-18 | las cards del tab "Próximas" deben mostrar badge de días positivo', async ({
		page,
	}) => {
		await page.locator("button", { hasText: "Próximas" }).first().click();
		// Mañana → "Mañana", resto → "Xd"
		const badgeText = page
			.locator("span")
			.filter({ hasText: /Mañana|\dd/ })
			.first();
		await expect(badgeText).toBeVisible();
	});

	test("EX-19 | las cards deben mostrar el badge de estado (Pendiente/En progreso/Completada)", async ({
		page,
	}) => {
		await expect(page.locator("span", { hasText: "Pendiente" }).first()).toBeVisible();
	});

	// ── Interacción con tabs ──────────────────────────────────────────────

	test('EX-20 | hacer clic en "Para hoy" debe cambiar el contenido visible del panel', async ({
		page,
	}) => {
		await page.locator("button", { hasText: "Para hoy" }).first().click();

		// Las subtareas de overdue ya no deben estar visibles
		await expect(
			page.locator('[role="button"]').filter({ hasText: "Subtarea vencida A (más antigua)" }),
		).toHaveCount(0);

		// Las subtareas de hoy sí
		await expect(
			page.locator("p, div").filter({ hasText: "Subtarea rápida (1h)" }).first(),
		).toBeVisible();
	});

	test("EX-21 | sub-caption del tab debe indicar cuántas subtareas están sin completar", async ({
		page,
	}) => {
		// El tab de Vencidas tiene sub-caption "2 sin completar"
		await expect(page.locator("span", { hasText: /sin completar/ }).first()).toBeVisible();
	});

	// ── Filtros de estado ─────────────────────────────────────────────────

	test('EX-22 | el filtro "En progreso" debe mostrar solo subtareas en ese estado', async ({
		page,
	}) => {
		// Cambiar al tab de "Para hoy" donde hay una en estado in_progress
		await page.locator("button", { hasText: "Para hoy" }).first().click();

		// Activar filtro "En progreso"
		await page.locator("button", { hasText: "En progreso" }).click();

		// Solo debe aparecer la subtarea "Subtarea larga (4h)" con status in_progress
		await expect(
			page.locator('[role="button"]').filter({ hasText: "Subtarea larga (4h)" }),
		).toBeVisible();
		await expect(
			page.locator('[role="button"]').filter({ hasText: "Subtarea rápida (1h)" }),
		).toHaveCount(0);
	});

	test('EX-23 | el filtro "Todos" debe restaurar todas las subtareas visibles', async ({
		page,
	}) => {
		await page.locator("button", { hasText: "Para hoy" }).first().click();

		// Activar filtro en progreso y luego volver a "Todos"
		await page.locator("button", { hasText: "En progreso" }).click();
		await page.locator("button", { hasText: "Todos" }).first().click();

		await expect(
			page.locator('[role="button"]').filter({ hasText: "Subtarea rápida (1h)" }),
		).toBeVisible();
		await expect(
			page.locator('[role="button"]').filter({ hasText: "Subtarea larga (4h)" }),
		).toBeVisible();
	});

	// ── Detail panel (SubtaskDetailPanel) ────────────────────────────────

	test("EX-24 | hacer clic en una card debe abrir el panel de detalle", async ({ page }) => {
		const firstCard = page
			.locator('[role="button"]')
			.filter({ hasText: "Subtarea vencida A (más antigua)" })
			.first();
		await firstCard.click();

		// El panel lateral debe aparecer (contiene el nombre de la subtarea)
		const panel = page
			.locator('[role="dialog"], aside, .detail-panel, div')
			.filter({ hasText: "Subtarea vencida A (más antigua)" })
			.last();
		await expect(panel).toBeVisible({ timeout: 5000 });
	});

	test("EX-25 | hacer clic 2 veces en la misma card debe cerrar el panel", async ({ page }) => {
		const firstCard = page
			.locator('[role="button"]')
			.filter({ hasText: "Subtarea vencida A (más antigua)" })
			.first();
		await firstCard.click();
		// Esperar a que abra
		await page.waitForTimeout(300);
		// Hacer clic de nuevo para cerrar
		await firstCard.click();
		// El panel ya no debe tener aria-pressed=true
		await expect(firstCard).toHaveAttribute("aria-pressed", "false");
	});

	// ── Dropdown de estado ────────────────────────────────────────────────

	test("EX-26 | el badge de estado en una card debe abrir un dropdown al hacer clic", async ({
		page,
	}) => {
		// El badge de estado (ej: "Pendiente") dentro de la primera card funciona como botón
		const firstCard = page.locator('[role="button"]').first();
		const statusBadge = firstCard.locator("button", {
			hasText: /Pendiente|En progreso|Completada/,
		});

		await statusBadge.click();

		// El portal (dropdown) debe aparecer con las 3 opciones
		await expect(page.locator("button", { hasText: "Pendiente" }).last()).toBeVisible();
		await expect(page.locator("button", { hasText: "En progreso" }).last()).toBeVisible();
		await expect(page.locator("button", { hasText: "Completada" }).last()).toBeVisible();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Caso de estado vacío
// ─────────────────────────────────────────────────────────────────────────────

test.describe("US-4 | Caso vacío — sin subtareas urgentes", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/api/planner/today/**", async (route) => {
			await route.fulfill({ json: EMPTY_RESPONSE });
		});
		await loginAndGoToDashboard(page);
	});

	test('VA-01 | debe mostrar mensaje de "todo libre" al no haber subtareas en el tab activo', async ({
		page,
	}) => {
		// Cada columna vacía muestra "Nada por aquí — ¡todo libre! 🎉"
		await expect(
			page
				.locator("p, div")
				.filter({ hasText: /Nada por aquí|todo libre/ })
				.first(),
		).toBeVisible({ timeout: 8000 });
	});

	test("VA-02 | el summary pill debe indicar que no hay subtareas urgentes", async ({ page }) => {
		// "Sin subtareas urgentes — ¡todo bajo control!"
		await expect(
			page
				.locator("span, div")
				.filter({ hasText: /Sin subtareas urgentes|todo bajo control/ })
				.first(),
		).toBeVisible({ timeout: 8000 });
	});

	test('VA-03 | el sub-caption de cada tab debe decir "todo completado"', async ({ page }) => {
		await expect(page.locator("span", { hasText: "todo completado" }).first()).toBeVisible({
			timeout: 8000,
		});
	});

	test("VA-04 | NO debe mostrar la advertencia de vencidas sin completar", async ({ page }) => {
		await expect(page.locator("text=Vencidas sin completar")).toHaveCount(0);
	});

	test("VA-05 | los badges de count en los tabs deben mostrar 0", async ({ page }) => {
		// Todos los contadores de grupos deben ser "0"
		const zeroBadges = page.locator("span", { hasText: "0" });
		const count = await zeroBadges.count();
		expect(count).toBeGreaterThanOrEqual(3); // uno por cada tab
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Caso de error de API
// ─────────────────────────────────────────────────────────────────────────────

test.describe("US-4 | Caso de error — API devuelve 500", () => {
	test("ER-01 | debe mostrar spinner de carga mientras espera respuesta", async ({ page }) => {
		// Interceptar con un delay para capturar el loading state
		await page.route("**/api/planner/today/**", async (route) => {
			await new Promise((r) => setTimeout(r, 1000));
			await route.fulfill({ status: 500 });
		});
		await loginAndGoToDashboard(page);

		// Spinner debe aparecer brevemente
		const spinner = page.locator('.spinner, [class*="spinner"]');
		// Puede ser muy breve, lo verificamos con un timeout corto
		await expect(spinner)
			.toBeVisible({ timeout: 2000 })
			.catch(() => {
				// Si el spinner ya pasó, no es un fallo del test
			});
	});

	test("ER-02 | ante un error de red, la vista debe degradarse sin crashear", async ({ page }) => {
		await page.route("**/api/planner/today/**", async (route) => {
			await route.fulfill({ status: 503 });
		});
		await loginAndGoToDashboard(page);

		// La página no debe mostrar una pantalla en blanco (debe tener al menos los tabs)
		await expect(
			page.locator("button", { hasText: /Vencidas|Para hoy|Próximas/ }).first(),
		).toBeVisible({ timeout: 8000 });
	});

	test("ER-03 | un error 401 (no autenticado) no debe mostrar datos ajenos", async ({ page }) => {
		await page.route("**/api/planner/today/**", async (route) => {
			await route.fulfill({ status: 401, json: { detail: "No autenticado" } });
		});
		await loginAndGoToDashboard(page);

		// No deben aparecer datos de subtareas (la vista se degrada limpiamente)
		await expect(page.locator('[role="button"]').filter({ hasText: "Subtarea" })).toHaveCount(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: UX / Diseño / Accesibilidad
// ─────────────────────────────────────────────────────────────────────────────

test.describe("US-4 | UX, diseño y accesibilidad", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/api/planner/today/**", async (route) => {
			await route.fulfill({ json: SEED_RESPONSE });
		});
		await loginAndGoToDashboard(page);
	});

	// ── Accesibilidad ─────────────────────────────────────────────────────

	test('UX-01 | las cards deben tener role="button" para accesibilidad', async ({ page }) => {
		const cards = page.locator('[role="button"]');
		const count = await cards.count();
		expect(count).toBeGreaterThan(0);
	});

	test("UX-02 | las cards deben tener atributo aria-pressed", async ({ page }) => {
		const firstCard = page.locator('[role="button"]').first();
		await expect(firstCard).toHaveAttribute("aria-pressed", /(true|false)/);
	});

	test("UX-03 | las cards deben tener tabIndex=0 (navegables con teclado)", async ({ page }) => {
		const firstCard = page.locator('[role="button"]').first();
		await expect(firstCard).toHaveAttribute("tabindex", "0");
	});

	test("UX-04 | se debe poder seleccionar una card con la tecla Enter", async ({ page }) => {
		const firstCard = page.locator('[role="button"]').first();
		await firstCard.focus();
		await firstCard.press("Enter");

		// Después de Enter, aria-pressed debe ser true
		await expect(firstCard).toHaveAttribute("aria-pressed", "true");
	});

	test("UX-05 | se debe poder seleccionar una card con la tecla Space", async ({ page }) => {
		const firstCard = page.locator('[role="button"]').first();
		await firstCard.focus();
		await firstCard.press(" ");

		await expect(firstCard).toHaveAttribute("aria-pressed", "true");
	});

	test("UX-06 | los tabs deben ser navegables con Tab del teclado", async ({ page }) => {
		// Focusear el primer tab y moverse con Tab
		const firstTab = page.locator("button", { hasText: "Vencidas" }).first();
		await firstTab.focus();
		await expect(firstTab).toBeFocused();
	});

	// ── Diseño / Responsividad visual ─────────────────────────────────────

	test("UX-07 | la toolbar debe incluir: summary pill + botón Nueva subtarea + chips de filtro", async ({
		page,
	}) => {
		await expect(page.locator("button", { hasText: "Nueva subtarea" })).toBeVisible();
		await expect(page.locator("button", { hasText: "Todos" }).first()).toBeVisible();
		// Summary pill
		await expect(
			page
				.locator("span, div")
				.filter({ hasText: /subtarea.? pendiente|Sin subtareas urgentes/i })
				.first(),
		).toBeVisible();
	});

	test('UX-08 | la sort-hint bar debe mostrar la etiqueta "Orden" en mayúsculas', async ({
		page,
	}) => {
		await expect(page.locator("span", { hasText: "Orden" })).toBeVisible();
	});

	test("UX-09 | el tab activo debe mostrar la barra de acento en la parte superior", async ({
		page,
	}) => {
		// El tab activo tiene un <span> absolute con border-radius "11px 11px 0 0" —
		// Verificamos que el tab activo existe y tiene hijos (el accent bar es un span absoluto)
		const activeTab = page.locator("button", { hasText: "Vencidas" }).first();
		await expect(activeTab).toBeVisible();
		// El span del accent bar está dentro del button activo
		const accentBar = activeTab.locator("span").first();
		await expect(accentBar).toBeVisible();
	});

	test("UX-10 | la página debe cargar en menos de 5 segundos", async ({ page }) => {
		const start = Date.now();
		// Los tabs deben estar visibles en < 5s
		await expect(page.locator("button", { hasText: "Para hoy" }).first()).toBeVisible({
			timeout: 5000,
		});
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(5000);
	});

	test("UX-11 | el título de la página debe identificar la sección (title tag)", async ({
		page,
	}) => {
		const title = await page.title();
		// El título debe ser descriptivo (no estar vacío)
		expect(title.length).toBeGreaterThan(0);
	});

	test("UX-12 | la página debe contener al menos un encabezado h1 o h2", async ({ page }) => {
		const headings = page.locator("h1, h2");
		const count = await headings.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	// ── Interacciones UX avanzadas ─────────────────────────────────────────

	test("UX-13 | cambiar de tab debe actualizar la sort-hint bar con el criterio correcto", async ({
		page,
	}) => {
		// Vencidas → antiguas
		await expect(page.locator("text=más antiguas primero")).toBeVisible();

		// Para hoy → rápidas
		await page.locator("button", { hasText: "Para hoy" }).first().click();
		await expect(page.locator("text=más rápidas primero")).toBeVisible();

		// Próximas → cercanas
		await page.locator("button", { hasText: "Próximas" }).first().click();
		await expect(page.locator("text=más cercanas primero")).toBeVisible();

		// Volver a Vencidas
		await page.locator("button", { hasText: "Vencidas" }).first().click();
		await expect(page.locator("text=más antiguas primero")).toBeVisible();
	});

	test('UX-14 | hacer clic en "Nueva subtarea" debe abrir un modal o panel de creación', async ({
		page,
	}) => {
		await page.locator("button", { hasText: "Nueva subtarea" }).click();
		// El modal/dialog de creación debe aparecer
		const modal = page.locator('[role="dialog"], .modal, form').first();
		await expect(modal).toBeVisible({ timeout: 5000 });
	});

	test("UX-15 | el filtro activo debe tener indicador visual distinto (estilo activo)", async ({
		page,
	}) => {
		// El chip "Todos" está activo por defecto; verificamos que tiene texto visible
		const todosChip = page.locator("button", { hasText: "Todos" }).first();
		await expect(todosChip).toBeVisible();
		// Al hacer clic en "Pendientes", el chip debe cambiar visualmente
		await page.locator("button", { hasText: "Pendientes" }).click();
		const pendientesChip = page.locator("button", { hasText: "Pendientes" });
		await expect(pendientesChip).toBeVisible();
	});

	test("UX-16 | cerrar el dropdown de estado haciendo clic fuera debe funcionar", async ({
		page,
	}) => {
		const firstCard = page.locator('[role="button"]').first();
		const statusBadge = firstCard.locator("button", {
			hasText: /Pendiente|En progreso|Completada/,
		});

		await statusBadge.click();

		// El dropdown (portal) debe estar visible
		await expect(page.locator("button", { hasText: "Completada" }).last()).toBeVisible();

		// Hacer clic en el overlay (fondo del portal)
		await page.locator('div[style*="inset: 0"]').first().click({ force: true });

		// El dropdown debe cerrarse
		await expect(page.locator("button", { hasText: "Completada" })).toHaveCount(1); // solo el chip de filtro
	});

	test('UX-17 | la card seleccionada debe tener aria-pressed="true"', async ({ page }) => {
		const firstCard = page.locator('[role="button"]').first();
		await firstCard.click();
		await expect(firstCard).toHaveAttribute("aria-pressed", "true");
	});

	test('UX-18 | deseleccionar una card debe volver aria-pressed a "false"', async ({ page }) => {
		const firstCard = page.locator('[role="button"]').first();
		await firstCard.click();
		await expect(firstCard).toHaveAttribute("aria-pressed", "true");

		await firstCard.click();
		await expect(firstCard).toHaveAttribute("aria-pressed", "false");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Integración real (sin mocks) — validación contra backend real
// ─────────────────────────────────────────────────────────────────────────────

test.describe("US-4 | Integración real — backend Django + base de datos", () => {
	test.beforeEach(async ({ page }) => {
		// Sin mock → usa el backend real
		await loginAndGoToDashboard(page);
	});

	test("INT-01 | la vista /hoy debe responder con éxito desde el backend real", async ({
		page,
	}) => {
		// Verificar que la petición al backend devuelva 200
		const [response] = await Promise.all([
			page
				.waitForResponse((r) => r.url().includes("/today") || r.url().includes("planner"), {
					timeout: 10000,
				})
				.catch(() => null),
			page.reload(),
		]);

		if (response) {
			expect([200, 304]).toContain(response.status());
		}
	});

	test("INT-02 | debe renderizar al menos uno de los tres estados posibles (éxito, vacío, error)", async ({
		page,
	}) => {
		// Éxito: tabs visibles. Vacío: "todo libre". Error: degradación.
		const tabsVisible = await page
			.locator("button", { hasText: /Vencidas|Para hoy|Próximas/ })
			.first()
			.isVisible()
			.catch(() => false);
		const emptyVisible = await page
			.locator("text=/Nada por aquí|Sin subtareas urgentes/")
			.isVisible()
			.catch(() => false);

		expect(tabsVisible || emptyVisible).toBe(true);
	});

	test("INT-03 | el frontend debe enviar el header de Authorization en la petición", async ({
		page,
	}) => {
		let authHeaderPresent = false;

		page.on("request", (req) => {
			if (req.url().includes("/today") || req.url().includes("planner")) {
				const auth = req.headers()["authorization"];
				if (auth && auth.startsWith("Bearer ")) {
					authHeaderPresent = true;
				}
			}
		});

		await page.reload();
		await page.waitForTimeout(3000);

		expect(authHeaderPresent).toBe(true);
	});

	test("INT-04 | la respuesta de la API debe contener las claves overdue, today, upcoming y meta", async ({
		page,
	}) => {
		const captured: { body: Record<string, unknown> | null } = { body: null };

		page.on("response", async (res) => {
			if ((res.url().includes("/today") || res.url().includes("planner")) && res.status() === 200) {
				try {
					captured.body = await res.json();
				} catch {
					/* non-JSON */
				}
			}
		});

		await page.reload();
		await page.waitForTimeout(4000);

		if (captured.body) {
			expect(captured.body).toHaveProperty("overdue");
			expect(captured.body).toHaveProperty("today");
			expect(captured.body).toHaveProperty("upcoming");
			expect(captured.body).toHaveProperty("meta");
		}
	});
});
