import { test as base, expect } from "@playwright/test";

/**
 * Fixture base para reutilizar entre los tests.
 *
 * Extiende el test de Playwright con fixtures personalizados.
 * Puedes agregar helpers, páginas pre-cargadas, o mocks aquí.
 *
 * Ejemplo de uso:
 *   import { test, expect } from "../fixtures/base.fixture";
 *
 *   test("mi test", async ({ loginPage }) => {
 *     await loginPage.fillCredentials("user", "pass");
 *   });
 */

// ───────────────────────────────────────────────────
// Tipos de los fixtures personalizados
// ───────────────────────────────────────────────────
type CustomFixtures = {
    /** Fixture que navega a la página de login automáticamente */
    loginPage: ReturnType<typeof createLoginPageHelper>;
};

function createLoginPageHelper(page: import("@playwright/test").Page) {
    return {
        /** Navega a la página de login */
        async goto() {
            await page.goto("/");
        },

        /** Llena los campos de usuario y contraseña */
        async fillCredentials(username: string, password: string) {
            await page.locator("#username").fill(username);
            await page.locator("#password").fill(password);
        },

        /** Hace clic en el botón de iniciar sesión */
        async submit() {
            await page.locator('button[type="submit"]').click();
        },

        /** Llena y envía el formulario en un solo paso */
        async login(username: string, password: string) {
            await this.fillCredentials(username, password);
            await this.submit();
        },

        /** Alterna la visibilidad de la contraseña */
        async togglePasswordVisibility() {
            await page.locator(".password-toggle").click();
        },

        /** Verifica si un toast de error es visible */
        async expectErrorToast(textContains?: string) {
            const toast = page.locator('[data-sonner-toast][data-type="error"]');
            await expect(toast).toBeVisible({ timeout: 5000 });
            if (textContains) {
                await expect(toast).toContainText(textContains);
            }
        },

        /** Verifica si un toast de éxito es visible */
        async expectSuccessToast(textContains?: string) {
            const toast = page.locator('[data-sonner-toast][data-type="success"]');
            await expect(toast).toBeVisible({ timeout: 5000 });
            if (textContains) {
                await expect(toast).toContainText(textContains);
            }
        },
    };
}

// ───────────────────────────────────────────────────
// Test extendido con fixtures personalizados
// ───────────────────────────────────────────────────
export const test = base.extend<CustomFixtures>({
    loginPage: async ({ page }, use) => {
        const helper = createLoginPageHelper(page);
        await helper.goto();
        await use(helper);
    },
});

export { expect };
