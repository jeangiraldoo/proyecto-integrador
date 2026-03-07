import { Page } from '@playwright/test';

/**
 * Función reutilizable para logearse y navegar al dashboard/hoy.
 */
export async function loginAndGoToDashboard(page: Page) {
    // 1. Ir a la ruta de inicio (formulario de login)
    await page.goto('/login');

    // 2. Llenar credenciales
    await page.locator('#username').fill('jean');
    await page.locator('#password').fill('superjean');

    // 3. Enviar y esperar navegación al dashboard u otra ruta
    await Promise.all([
        // Dependiendo de tu frontend, se puede esperar a la redirección
        // waitForURL puede ser algo como /dashboard o /hoy
        page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => { }),
        page.locator('button[type="submit"]').click()
    ]);

    // Si después del login cae al dashboard, y la vista que queremos es /hoy:
    await page.goto('/hoy');
}
