/**
 * Ejemplo de tests usando el fixture personalizado `loginPage`.
 *
 * Esto demuestra cómo usar los fixtures para escribir tests
 * más limpios y fáciles de mantener.
 */
import { test, expect } from "./fixtures/base.fixture";

test.describe("Login - Usando fixtures", () => {
    test("debe mostrar el formulario al cargar la página", async ({ loginPage, page }) => {
        const form = page.locator("form.login-form");
        await expect(form).toBeVisible();
    });

    test("debe poder llenar credenciales con el helper", async ({ loginPage, page }) => {
        await loginPage.fillCredentials("usuario_test", "password123");

        await expect(page.locator("#username")).toHaveValue("usuario_test");
        await expect(page.locator("#password")).toHaveValue("password123");
    });

    test("debe mostrar error al enviar formulario vacío", async ({ loginPage }) => {
        await loginPage.submit();
        await loginPage.expectErrorToast("completa todos los campos");
    });

    test("debe alternar visibilidad de contraseña", async ({ loginPage, page }) => {
        await loginPage.fillCredentials("user", "secret");
        await expect(page.locator("#password")).toHaveAttribute("type", "password");

        await loginPage.togglePasswordVisibility();
        await expect(page.locator("#password")).toHaveAttribute("type", "text");

        await loginPage.togglePasswordVisibility();
        await expect(page.locator("#password")).toHaveAttribute("type", "password");
    });
});
