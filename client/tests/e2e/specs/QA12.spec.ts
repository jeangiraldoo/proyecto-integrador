import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:5173";
const USERNAME = "jean";
const PASSWORD = "superjean";

const TEST_SUBTASK_NAME = `[TEST] Subtarea E2E ${Date.now()}`;
const EDITED_SUBTASK_NAME = `[TEST] Subtarea E2E editada ${Date.now()}`;

async function login(page: Page) {
	await page.goto(`${BASE_URL}/login`);
	await page.locator("input[type='text'], input[type='email']").first().fill(USERNAME);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: /iniciar sesión|login|entrar/i }).click();
	await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}

function trackConsoleErrors(page: Page): () => string[] {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});
	page.on("pageerror", (err) => errors.push(err.message));
	return () =>
		errors.filter(
			(e) => e.includes("500") || e.includes("Minified React error") || e.includes("Uncaught"),
		);
}

test.describe("Flujo completo de subtarea (HU3)", () => {
	test("crear, editar y eliminar una subtarea sin errores en consola", async ({ page }) => {
		const getCriticalErrors = trackConsoleErrors(page);

		await login(page);
		await expect(page).toHaveURL(/\/hoy/);

		await page.getByRole("button", { name: /nueva subtarea/i }).click();
		const createDialog = page.getByRole("dialog", { name: /crear subtarea/i });
		await expect(createDialog).toBeVisible();

		await createDialog.getByRole("button", { name: /selecciona una actividad/i }).click();
		await createDialog.locator("button span", { hasText: "Taller 1" }).click();

		await createDialog.getByPlaceholder(/revisar capítulo/i).fill(TEST_SUBTASK_NAME);

		const today = new Date().toISOString().split("T")[0];
		await createDialog.locator("input[type='date']").fill(today);

		await createDialog.getByRole("button", { name: /crear subtarea/i }).click();
		await expect(page.getByText(/subtarea creada/i)).toBeVisible({ timeout: 8_000 });
		await expect(createDialog).not.toBeVisible({ timeout: 8_000 });

		await page.getByRole("button", { name: /para hoy/i }).click();
		await expect(page.getByText(TEST_SUBTASK_NAME)).toBeVisible({ timeout: 8_000 });

		await page.getByText(TEST_SUBTASK_NAME).first().click();
		await expect(page.locator("button[title='Editar']")).toBeVisible({ timeout: 5_000 });

		await page.locator("button[title='Editar']").click();

		await expect(page.getByText("Editar subtarea")).toBeVisible({ timeout: 5_000 });

		const nameInput = page.locator("input:not([type='number']):not([type='date'])").last();
		await nameInput.click();
		await page.keyboard.press("Control+a");
		await page.keyboard.type(EDITED_SUBTASK_NAME);

		await page.getByRole("button", { name: /guardar cambios/i }).click();

		await expect(page.getByText(/subtarea actualizada/i)).toBeVisible({ timeout: 8_000 });

		await expect(page.getByText(EDITED_SUBTASK_NAME).first()).toBeVisible({ timeout: 8_000 });

		await expect(page.locator("button[title='Eliminar']")).toBeVisible({ timeout: 5_000 });
		await page.locator("button[title='Eliminar']").click();

		await expect(page.getByText(/eliminar subtarea/i)).toBeVisible({ timeout: 5_000 });
		await page.getByRole("button", { name: /sí, eliminar/i }).click();
		await expect(page.getByText(/subtarea eliminada/i)).toBeVisible({ timeout: 8_000 });

		expect(getCriticalErrors()).toHaveLength(0);
	});
});
