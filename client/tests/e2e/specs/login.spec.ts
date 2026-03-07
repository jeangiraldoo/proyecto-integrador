import { test, expect } from "@playwright/test";

test.describe("Login Page - Renderizado", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("debe mostrar el formulario de login", async ({ page }) => {
        // Verificar que el formulario existe
        const form = page.locator("form.login-form");
        await expect(form).toBeVisible();
    });

    test("debe mostrar el campo de usuario", async ({ page }) => {
        const usernameInput = page.locator("#username");
        await expect(usernameInput).toBeVisible();
        await expect(usernameInput).toHaveAttribute("placeholder", "tu@correo.com");
    });

    test("debe mostrar el campo de contraseña", async ({ page }) => {
        const passwordInput = page.locator("#password");
        await expect(passwordInput).toBeVisible();
        await expect(passwordInput).toHaveAttribute("type", "password");
    });

    test("debe mostrar el botón de iniciar sesión", async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeVisible();
        await expect(submitButton).toContainText("Iniciar sesión");
    });

    test("debe mostrar el logo de Luma", async ({ page }) => {
        const logo = page.locator("img.brand-logo-full");
        await expect(logo).toBeVisible();
    });

    test("debe mostrar el saludo dinámico", async ({ page }) => {
        const greeting = page.locator(".greeting-line");
        await expect(greeting).toBeVisible();
        // El saludo cambia según la hora, pero siempre debe tener texto
        await expect(greeting).not.toBeEmpty();
    });

    test("debe mostrar el enlace de '¿Olvidaste tu contraseña?'", async ({ page }) => {
        const forgotLink = page.locator("a.forgot-password");
        await expect(forgotLink).toBeVisible();
        await expect(forgotLink).toHaveText("¿Olvidaste tu contraseña?");
    });

    test("debe mostrar el enlace de 'Crea una cuenta'", async ({ page }) => {
        const createAccountLink = page.locator("a.highlight-link");
        await expect(createAccountLink).toBeVisible();
        await expect(createAccountLink).toHaveText("Crea una cuenta");
    });
});

test.describe("Login Page - Interacción con formulario", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("debe permitir escribir en el campo de usuario", async ({ page }) => {
        const usernameInput = page.locator("#username");
        await usernameInput.fill("testuser@email.com");
        await expect(usernameInput).toHaveValue("testuser@email.com");
    });

    test("debe permitir escribir en el campo de contraseña", async ({ page }) => {
        const passwordInput = page.locator("#password");
        await passwordInput.fill("mi-password-123");
        await expect(passwordInput).toHaveValue("mi-password-123");
    });

    test("debe alternar la visibilidad de la contraseña", async ({ page }) => {
        const passwordInput = page.locator("#password");
        const toggleButton = page.locator(".password-toggle");

        // Inicialmente debe ser tipo password
        await expect(passwordInput).toHaveAttribute("type", "password");

        // Hacer clic en el toggle
        await toggleButton.click();

        // Ahora debe ser tipo text
        await expect(passwordInput).toHaveAttribute("type", "text");

        // Hacer clic de nuevo para ocultar
        await toggleButton.click();

        // Debe volver a ser tipo password
        await expect(passwordInput).toHaveAttribute("type", "password");
    });

    test("debe mostrar error toast al enviar formulario vacío", async ({ page }) => {
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Verificar que aparece el toast de error (sonner)
        const toast = page.locator('[data-sonner-toast][data-type="error"]');
        await expect(toast).toBeVisible({ timeout: 5000 });
        await expect(toast).toContainText("Por favor, completa todos los campos");
    });

    test("debe mostrar error toast al enviar solo con usuario", async ({ page }) => {
        await page.locator("#username").fill("testuser");
        await page.locator('button[type="submit"]').click();

        const toast = page.locator('[data-sonner-toast][data-type="error"]');
        await expect(toast).toBeVisible({ timeout: 5000 });
    });

    test("debe mostrar error toast al enviar solo con contraseña", async ({ page }) => {
        await page.locator("#password").fill("password123");
        await page.locator('button[type="submit"]').click();

        const toast = page.locator('[data-sonner-toast][data-type="error"]');
        await expect(toast).toBeVisible({ timeout: 5000 });
    });
});

test.describe("Login Page - Sección decorativa (lado derecho)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("debe mostrar la tarjeta glass con el texto hero", async ({ page }) => {
        const glassCard = page.locator(".glass-card");
        await expect(glassCard).toBeVisible();
        await expect(glassCard).toContainText("Organiza tu agenda.");
    });

    test("debe mostrar las pills de características", async ({ page }) => {
        const pills = page.locator(".glass-pill");
        await expect(pills).toHaveCount(3);
        await expect(pills.nth(0)).toContainText("Automático");
        await expect(pills.nth(1)).toContainText("Rápido");
        await expect(pills.nth(2)).toContainText("Trazabilidad");
    });

    test("debe mostrar las floating cards", async ({ page }) => {
        const card1 = page.locator(".floating-card.card-1");
        const card2 = page.locator(".floating-card.card-2");

        await expect(card1).toBeVisible();
        await expect(card1).toContainText("Progreso");

        await expect(card2).toBeVisible();
        await expect(card2).toContainText("Actividades");
    });
});

test.describe("Login Page - Accesibilidad", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("los campos de formulario deben tener labels asociados", async ({ page }) => {
        // Verificar que hay un label apuntando al input de username
        const usernameLabel = page.locator('label[for="username"]');
        await expect(usernameLabel).toBeVisible();
        await expect(usernameLabel).toHaveText("Usuario");

        // Verificar que hay un label apuntando al input de password
        const passwordLabel = page.locator('label[for="password"]');
        await expect(passwordLabel).toBeVisible();
        await expect(passwordLabel).toHaveText("Contraseña");
    });

    test("el botón de toggle de contraseña debe tener aria-label", async ({ page }) => {
        const toggleButton = page.locator(".password-toggle");
        await expect(toggleButton).toHaveAttribute("aria-label", /contraseña/i);
    });

    test("debe poder navegar con Tab por los elementos interactivos", async ({ page }) => {
        // Focus en username primero
        await page.locator("#username").focus();
        await expect(page.locator("#username")).toBeFocused();

        // Tab al password
        await page.keyboard.press("Tab");
        await expect(page.locator("#password")).toBeFocused();

        // Tab al botón de submit
        await page.keyboard.press("Tab");
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeFocused();
    });

    test("debe poder enviar el formulario con Enter", async ({ page }) => {
        await page.locator("#username").fill("testuser");
        await page.locator("#password").fill("password123");

        // Presionar Enter en el campo de password
        await page.locator("#password").press("Enter");

        // Debe intentar enviar el formulario (mostrará toast de error porque el backend no está)
        // Verificamos que el botón muestra el spinner de loading
        const spinner = page.locator(".spinner");
        // Puede aparecer brevemente antes de la respuesta de error
        await expect(spinner).toBeVisible({ timeout: 5000 });
    });
});
