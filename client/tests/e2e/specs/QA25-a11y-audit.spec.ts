import { test, expect } from "@playwright/test";
import { loginWithMockedToken } from "../utils/auth";

// ─────────────────────────────────────────────────────────────────────────────
// QA-25 | US-11 — Auditoría de Accesibilidad (A11y) — Pantallas núcleo
//
// Verifica que las vistas principales y modales del producto cumplen los
// criterios mínimos de WCAG 2.1 AA:
//   - Semántica ARIA correcta (role, aria-modal, aria-labelledby, aria-label)
//   - Asociación de etiquetas en formularios (htmlFor ↔ id)
//   - Mensajes de error visibles y próximos al campo afectado
//   - Navegación por teclado (Tab, Enter, Escape)
//   - Nombres accesibles en todos los elementos interactivos
//
// Pantallas cubiertas:
//   CreateActivityModal · SubtaskDetailPanel · TodayView · OrganizationView
// ─────────────────────────────────────────────────────────────────────────────

const formatLocalDate = (date: Date) => {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
};

const TODAY_STR = formatLocalDate(new Date());
const FAR_FUTURE = formatLocalDate(
	new Date(new Date().getFullYear(), new Date().getMonth() + 3, 15),
);

// ── Mock data ──────────────────────────────────────────────────────────────
const MOCK_USER = {
	id: 999,
	username: "qa25user",
	email: "qa25@test.com",
	name: "QA25 A11y User",
	max_daily_hours: 8,
	onboarding: {
		has_seen_tour: true,
		has_seen_org_tour: true,
		has_seen_progress_tour: true,
	},
};

// Actividad 901 en materia "QA" — sirve para mostrar el botón "añadir actividad"
// que abre el CreateActivityModal desde /organizacion
const ACTIVITY_901 = {
	id: 901,
	user: 999,
	title: "Actividad de Prueba A11y",
	course_name: "QA",
	description: "Actividad para auditoría de accesibilidad",
	due_date: FAR_FUTURE,
	status: "in_progress",
	subtask_count: 1,
	total_subtasks_count: 1,
	completed_subtasks_count: 0,
	total_estimated_hours: 2,
};

// Subtarea 9010 — vence hoy → aparece en columna "today" de /hoy
const SUBTASK_9010 = {
	id: 9010,
	name: "Subtarea A11y",
	status: "pending",
	estimated_hours: 2,
	target_date: TODAY_STR,
	ordering: 1,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
	postponement_note: null,
	activity: { id: 901, title: "Actividad de Prueba A11y" },
};

// Mock de /today/ con la subtarea en la columna "today"
const MOCK_TODAY_DATA = {
	overdue: [],
	today: [
		{
			id: 9010,
			name: "Subtarea A11y",
			status: "pending",
			target_date: TODAY_STR,
			estimated_hours: 2,
			postponement_note: null,
			activity: { id: 901, title: "Actividad de Prueba A11y" },
		},
	],
	upcoming: [],
	postponed: [],
	meta: { n_days: 7, filters: { courseId: null, status: null } },
};

// ─────────────────────────────────────────────────────────────────────────────

test.describe("QA-25 | US-11 — Auditoría A11y: Pantallas núcleo (Mocked)", () => {
	test.setTimeout(90000);
	test.describe.configure({ retries: 2 });

	test.beforeEach(async ({ page }) => {
		await page.route("**/me/**", (route) => route.fulfill({ json: MOCK_USER }));
		await page.route("**/subjects/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/conflicts/**", (route) => route.fulfill({ json: [] }));
		await page.route("**/today/**", (route) => route.fulfill({ json: MOCK_TODAY_DATA }));
		await page.route("**/activities/", (route) => {
			if (route.request().method() === "GET") {
				route.fulfill({ json: [ACTIVITY_901] });
			} else {
				route.continue();
			}
		});
		await page.route("**/activities/901/subtasks/", (route) =>
			route.fulfill({ json: [SUBTASK_9010] }),
		);
		await page.route("**/activities/*/subtasks/*/", (route) =>
			route.fulfill({ status: 200, json: SUBTASK_9010 }),
		);

		await loginWithMockedToken(page);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-1 | CreateActivityView (/crear) — Formulario de creación accesible
	//
	// Criterio: La vista de creación de actividad tiene sus campos principales
	// con etiquetas correctamente asociadas (htmlFor ↔ id). El botón de regreso
	// tiene nombre accesible. El formulario usa <label> semánticos.
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-1: CreateActivityView (/crear) tiene labels asociados y formulario accesible", async ({
		page,
	}) => {
		// La vista de creación de actividades vive en /crear
		await page.goto("/crear");
		await expect(page.locator('[data-testid="create-activity-view"]')).toBeVisible({
			timeout: 15000,
		});

		// ── Criterio 1: Input "Título" tiene label htmlFor asociado ───────────
		// El input tiene id="ca-title" y su label tiene htmlFor="ca-title"
		const titleInput = page.locator("#ca-title");
		await expect(titleInput).toBeVisible();
		const titleLabel = page.locator('label[for="ca-title"]');
		await expect(titleLabel).toBeVisible();
		const titleLabelText = await titleLabel.textContent();
		expect(titleLabelText?.toLowerCase()).toContain("título");

		// ── Criterio 2: Input "Fecha de entrega" tiene label htmlFor asociado ─
		const dueDateLabel = page.locator('label[for="ca-due-date"]');
		await expect(dueDateLabel).toBeVisible();
		const dueDateLabelText = await dueDateLabel.textContent();
		expect(dueDateLabelText?.toLowerCase()).toContain("fecha");

		// ── Criterio 3: Botón de regreso tiene nombre accesible ───────────────
		const backBtn = page.locator('[data-testid="create-activity-back-nav-btn"]');
		await expect(backBtn).toBeVisible();
		const backText = await backBtn.textContent();
		const backAriaLabel = await backBtn.getAttribute("aria-label");
		const backTitle = await backBtn.getAttribute("title");
		const backName =
			(backText ?? "").trim() || (backAriaLabel ?? "").trim() || (backTitle ?? "").trim();
		expect(backName.length).toBeGreaterThan(0);

		// ── Criterio 4: El combobox de materia es un input accesible ──────────
		const subjectInput = page.locator('[data-testid="create-activity-subject-input"]');
		await expect(subjectInput).toBeVisible();
		const subjectTag = await subjectInput.evaluate((el) => el.tagName.toLowerCase());
		expect(subjectTag).toBe("input");
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-2 | CreateActivityView (/crear) — Mensajes de error claros y visibles
	//
	// Criterio: Al intentar avanzar con campos vacíos, los mensajes de error
	// aparecen adyacentes al campo afectado. Cada mensaje de error tiene texto
	// descriptivo y no se usa únicamente color para comunicar el error.
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-2: CreateActivityView muestra mensajes de error claros al enviar formulario vacío", async ({
		page,
	}) => {
		await page.goto("/crear");
		await expect(page.locator('[data-testid="create-activity-view"]')).toBeVisible({
			timeout: 15000,
		});

		// Intentar avanzar al paso 2 sin rellenar nada
		// El botón "Siguiente" avanza al paso de subtareas
		const nextBtn = page.getByRole("button", { name: /siguiente|next|continuar/i });
		if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
			await nextBtn.click();
		} else {
			// Busca el último botón del formulario
			const formBtns = page.locator('[data-testid="create-activity-view"] button');
			const count = await formBtns.count();
			if (count > 0) await formBtns.nth(count - 1).click();
		}

		// ── Criterio 1: Aparecen mensajes de error ────────────────────────────
		const errorMessages = page.locator(".ca-field-error");
		await expect(errorMessages.first()).toBeVisible({ timeout: 3000 });

		// ── Criterio 2: Los mensajes tienen texto descriptivo (no solo iconos) ─
		const allErrors = await errorMessages.all();
		for (const err of allErrors) {
			const text = await err.textContent();
			expect(text?.trim().length).toBeGreaterThan(3);
		}

		// ── Criterio 3: Los campos afectados reciben clase de error visual ──────
		const titleInput = page.locator("#ca-title");
		if (await titleInput.isVisible()) {
			const cls = await titleInput.getAttribute("class");
			const hasAriaInvalid = await titleInput.getAttribute("aria-invalid");
			expect(cls?.includes("input-error") || hasAriaInvalid === "true").toBeTruthy();
		}
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-3 | TodayView — Botones de estado accesibles y navegación por teclado
	//
	// Criterio: Los botones de cambio de estado de subtareas tienen nombre
	// accesible (texto visible). Los elementos interactivos son alcanzables
	// mediante Tab. El foco es perceptible visualmente.
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-3: TodayView — botones de estado tienen nombre accesible y son alcanzables por Tab", async ({
		page,
	}) => {
		await page.goto("/hoy");
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		const subtaskCard = page.locator('[data-testid="today-subtask-card-9010"]');
		await expect(subtaskCard).toBeVisible({ timeout: 10000 });

		// ── Criterio 1: Botón de estado tiene texto visible (nombre accesible) ─
		const statusBtn = page.locator('[data-testid="today-subtask-status-btn-9010"]');
		await expect(statusBtn).toBeVisible();

		const btnText = await statusBtn.textContent();
		const btnAriaLabel = await statusBtn.getAttribute("aria-label");
		// El nombre accesible puede venir de textContent O de aria-label
		const accessibleName = (btnText ?? "").trim() || (btnAriaLabel ?? "").trim();
		expect(accessibleName.length).toBeGreaterThan(0);

		// ── Criterio 2: El botón de estado es un <button> nativo ─────────────
		const tagName = await statusBtn.evaluate((el) => el.tagName.toLowerCase());
		expect(tagName).toBe("button");

		// ── Criterio 3: El botón es focusable con Tab (tabindex ≥ 0) ─────────
		const tabIndex = await statusBtn.evaluate((el) =>
			(el as HTMLElement).tabIndex >= 0 ? "focusable" : "not-focusable",
		);
		expect(tabIndex).toBe("focusable");

		// ── Criterio 4: El dropdown de opciones tiene nombres accesibles ──────
		await statusBtn.click();
		const dropdown = page.locator('[data-testid="today-subtask-status-dropdown-9010"]');
		await expect(dropdown).toBeVisible({ timeout: 3000 });

		// Todas las opciones del dropdown deben tener texto visible
		const options = page.locator('[data-testid^="today-subtask-status-option-9010-"]');
		const optionCount = await options.count();
		expect(optionCount).toBeGreaterThan(0);

		for (let i = 0; i < optionCount; i++) {
			const optionText = await options.nth(i).textContent();
			expect(optionText?.trim().length).toBeGreaterThan(0);
		}

		// Cerrar dropdown
		await page.keyboard.press("Escape");
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-4 | SubtaskDetailPanel — Panel de detalle con semántica ARIA correcta
	//
	// Criterio: Al abrir el panel de detalle de una subtarea, el elemento raíz
	// tiene role="dialog", aria-modal="true" y aria-label. El botón de cierre
	// tiene nombre accesible. Los botones de editar y eliminar son accesibles.
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-4: SubtaskDetailPanel tiene role=dialog, aria-modal y botones con nombre accesible", async ({
		page,
	}) => {
		await page.goto("/hoy");
		await expect(page.locator("h1.page-title")).toContainText("Hoy", { timeout: 15000 });

		const subtaskCard = page.locator('[data-testid="today-subtask-card-9010"]');
		await expect(subtaskCard).toBeVisible({ timeout: 10000 });

		// Abrir el panel de detalle
		await subtaskCard.click();

		const panel = page.locator('[data-testid="subtask-detail-panel"]');
		await expect(panel).toBeVisible({ timeout: 5000 });

		// ── Criterio 1: role="dialog" ─────────────────────────────────────────
		await expect(panel).toHaveAttribute("role", "dialog");

		// ── Criterio 2: aria-modal="true" ────────────────────────────────────
		await expect(panel).toHaveAttribute("aria-modal", "true");

		// ── Criterio 3: aria-label no vacío ──────────────────────────────────
		const panelLabel = await panel.getAttribute("aria-label");
		expect(panelLabel?.trim().length).toBeGreaterThan(0);

		// ── Criterio 4: Botón de cierre tiene aria-label ─────────────────────
		const closeBtn = page.locator('[data-testid="subtask-detail-close-btn"]');
		await expect(closeBtn).toBeVisible();
		const closeBtnAriaLabel = await closeBtn.getAttribute("aria-label");
		expect(closeBtnAriaLabel?.trim().length).toBeGreaterThan(0);

		// ── Criterio 5: Botón "Editar" está visible y es un <button> nativo ──
		const editBtn = page.locator('[data-testid="subtask-detail-edit-btn"]');
		await expect(editBtn).toBeVisible();
		const editTag = await editBtn.evaluate((el) => el.tagName.toLowerCase());
		expect(editTag).toBe("button");

		// ── Criterio 6: Botón "Eliminar" está visible y tiene texto/aria-label
		const deleteBtn = page.locator('[data-testid="subtask-detail-delete-btn"]');
		await expect(deleteBtn).toBeVisible();
		const deleteBtnText = await deleteBtn.textContent();
		const deleteBtnLabel = await deleteBtn.getAttribute("aria-label");
		const deleteAccessibleName = (deleteBtnText ?? "").trim() || (deleteBtnLabel ?? "").trim();
		expect(deleteAccessibleName.length).toBeGreaterThan(0);

		// ── Criterio 7: El panel puede cerrarse con el botón de cierre ────────
		await closeBtn.click();
		await expect(panel).not.toBeVisible({ timeout: 3000 });
	});

	// ─────────────────────────────────────────────────────────────────────────
	// A11y-5 | OrganizationView — Elementos interactivos con nombres accesibles
	//
	// Criterio: Todos los botones visibles en la vista de organización tienen
	// nombre accesible (texto visible o aria-label). Los encabezados de materia
	// son alcanzables por teclado y expandibles con Enter. Las tarjetas de
	// actividad tienen botones de acción claramente etiquetados.
	// ─────────────────────────────────────────────────────────────────────────
	test("A11y-5: OrganizationView — todos los botones tienen nombre accesible y el header es operable por teclado", async ({
		page,
	}) => {
		await page.goto("/organizacion");
		await expect(page.locator('[data-testid="org-view"]')).toBeVisible({ timeout: 15000 });

		// ── Criterio 1: Expandir materia con Enter (acceso por teclado) ───────
		const subjectHeader = page.locator('[data-testid="org-subject-header-qa"]');
		await expect(subjectHeader).toBeVisible({ timeout: 8000 });

		// Tab hasta el encabezado y presionar Enter
		await subjectHeader.focus();
		await page.keyboard.press("Enter");
		await expect(page.locator('[data-testid="org-subject-body-qa"]')).toBeVisible({
			timeout: 5000,
		});

		// ── Criterio 2: Tarjeta de actividad visible ──────────────────────────
		const actCard = page.locator('[data-testid="org-activity-card-901"]');
		await expect(actCard).toBeVisible({ timeout: 5000 });

		// ── Criterio 3: Botón "Editar" tiene nombre accesible ─────────────────
		const editBtn = page.locator('[data-testid="org-activity-edit-btn-901"]');
		await expect(editBtn).toBeVisible();
		const editText = await editBtn.textContent();
		const editAriaLabel = await editBtn.getAttribute("aria-label");
		const editTitle = await editBtn.getAttribute("title");
		const editName =
			(editText ?? "").trim() || (editAriaLabel ?? "").trim() || (editTitle ?? "").trim();
		expect(editName.length).toBeGreaterThan(0);

		// ── Criterio 4: Botón "Eliminar" tiene nombre accesible ──────────────
		const deleteBtn = page.locator('[data-testid="org-activity-delete-btn-901"]');
		await expect(deleteBtn).toBeVisible();
		const deleteText = await deleteBtn.textContent();
		const deleteAriaLabel = await deleteBtn.getAttribute("aria-label");
		const deleteTitle = await deleteBtn.getAttribute("title");
		const deleteName =
			(deleteText ?? "").trim() || (deleteAriaLabel ?? "").trim() || (deleteTitle ?? "").trim();
		expect(deleteName.length).toBeGreaterThan(0);

		// ── Criterio 5: Ningún <button> visible carece de nombre accesible ────
		// Evalúa todos los botones visibles en la vista
		const unlabeledButtons = await page.evaluate(() => {
			const buttons = Array.from(document.querySelectorAll("button"));
			return buttons
				.filter((btn) => {
					// Solo botones visibles (offsetParent !== null)
					if (!btn.offsetParent) return false;
					const text = (btn.textContent ?? "").trim();
					const ariaLabel = btn.getAttribute("aria-label") ?? "";
					const ariaLabelledBy = btn.getAttribute("aria-labelledby") ?? "";
					const title = btn.getAttribute("title") ?? "";
					return !text && !ariaLabel && !ariaLabelledBy && !title;
				})
				.map((btn) => btn.getAttribute("data-testid") ?? btn.outerHTML.slice(0, 80));
		});

		expect(unlabeledButtons).toHaveLength(0);
	});
});
