# Luma — Planificador de Estudio

Aplicación web para gestionar actividades evaluativas universitarias: planificar, ejecutar,
reprogramar y visualizar progreso académico.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Django](https://img.shields.io/badge/Django-6-092E20?style=for-the-badge&logo=django&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Prerequisitos](#prerequisitos)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Configuración de variables de entorno](#configuración-de-variables-de-entorno)
5. [Levantar el proyecto localmente](#levantar-el-proyecto-localmente)
   - [Backend (Django)](#backend-django)
   - [Frontend (React + Vite)](#frontend-react--vite)
6. [Ejecutar tests](#ejecutar-tests)
7. [Cuenta demo](#cuenta-demo)
8. [Despliegue en producción](#despliegue-en-producción)

---

## Stack tecnológico

| Capa          | Tecnología                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=flat-square&logo=vite&logoColor=white) |
| Backend       | ![Django](https://img.shields.io/badge/Django_6-092E20?style=flat-square&logo=django&logoColor=white) ![DRF](https://img.shields.io/badge/DRF-A30000?style=flat-square&logo=django&logoColor=white)                                                                                                                 |
| Base de datos | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white) ![SQLite](<https://img.shields.io/badge/SQLite_(local)-003B57?style=flat-square&logo=sqlite&logoColor=white>)                                                                                             |
| Auth          | ![JWT](https://img.shields.io/badge/JWT-SimpleJWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)                                                                                                                                                                                                      |
| CI/CD         | ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)                                                                                                                                                                                          |
| Deploy        | ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=black)                                                                                                             |

---

## Prerequisitos

| Herramienta                                                                                              | Versión mínima      |
| -------------------------------------------------------------------------------------------------------- | ------------------- |
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) | v20                 |
| ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)      | 3.14                |
| ![pip](https://img.shields.io/badge/pip-3775A9?style=flat-square&logo=pypi&logoColor=white)              | cualquiera reciente |

---

## Estructura del proyecto

```
proyecto-integrador/
├── client/              ← React + Vite + TypeScript
│   ├── src/
│   │   ├── api/         ← Llamadas a la API (axios)
│   │   ├── components/  ← Vistas, modales, componentes UI
│   │   └── pages/       ← Auth, Dashboard, Landing
│   └── tests/e2e/       ← Tests Playwright (QA19–QA25)
├── server/              ← Django REST Framework
│   ├── config/          ← Configuración del proyecto Django
│   └── planner/         ← App principal (modelos, vistas, serializers)
├── .github/workflows/   ← CI/CD (lint, format, commits)
└── README.md
```

---

## Configuración de variables de entorno

### Backend — `server/.env`

Crea el archivo `server/.env` con el contenido de abajo. Sin este archivo el servidor usa **SQLite
local** como fallback (suficiente para desarrollo).

```env
# Clave secreta de Django (cambia este valor en producción)
DJANGO_SECRET_KEY=django-insecure-change-me-in-production

# Modo debug (True para local, False en producción)
DJANGO_DEBUG=True

# Hosts permitidos (separados por coma)
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# URL de conexión a Supabase (opcional — si se omite usa SQLite local)
# SUPABASE_DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Frontend — `client/.env.local`

```env
# URL base de la API (si se omite, apunta a la instancia de Render en producción)
VITE_API_BASE_URL=http://127.0.0.1:8000/
```

---

## Levantar el proyecto localmente

### Backend (Django)

```bash
# 1. Ir al directorio del servidor
cd server

# 2. Crear y activar entorno virtual
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 3. Instalar dependencias
pip install -e ".[dev]"

# 4. Aplicar migraciones (crea la base de datos SQLite local)
python manage.py migrate

# 5. (Opcional) Crear superusuario para el panel de administración
python manage.py createsuperuser

# 6. Iniciar el servidor de desarrollo
python manage.py runserver
# → disponible en http://127.0.0.1:8000/
```

### Frontend (React + Vite)

```bash
# 1. Ir al directorio del cliente
cd client

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
# → disponible en http://localhost:5173/
```

Abre `http://localhost:5173` en el navegador. El frontend se conecta al backend en
`http://127.0.0.1:8000/` (configurable con `VITE_API_BASE_URL`).

---

## Ejecutar tests

### Tests E2E (Playwright)

```bash
cd client

# Instalar los navegadores de Playwright (solo la primera vez)
npx playwright install chromium

# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar una suite específica
npx playwright test tests/e2e/specs/QA25-a11y-audit.spec.ts --reporter=list

# Abrir la interfaz visual de Playwright
npm run test:e2e:ui
```

> Los tests usan `page.route()` para simular la API. No requieren el backend activo.

### Tests de Django (pytest)

```bash
cd server

# Ejecutar todos los tests del servidor
DJANGO_USE_SQLITE_FOR_TESTS=True pytest

# Windows (PowerShell):
$env:DJANGO_USE_SQLITE_FOR_TESTS="True"; python -m pytest
```

---

## Cuenta demo

Para evaluar las funcionalidades sin crear un usuario, usa la cuenta registrada en producción:

[![Demo](https://img.shields.io/badge/🌐_Abrir_Demo-000000?style=for-the-badge)](https://proyecto-integrador-as97.onrender.com/)

| Campo      | Valor                                          |
| ---------- | ---------------------------------------------- |
| URL        | https://proyecto-integrador-as97.onrender.com/ |
| Usuario    | `jean`                                         |
| Contraseña | `superjean`                                    |

> La cuenta demo tiene actividades, subtareas y progreso precargados para demostrar todos los flujos
> del backlog.

---

## Despliegue en producción

[![Frontend - Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://proyecto-integrador-client.vercel.app)
[![Backend - Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://proyecto-integrador-as97.onrender.com)

### Variables de entorno requeridas en producción

**Render (backend):**

```env
DJANGO_SECRET_KEY=<valor secreto>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=proyecto-integrador-as97.onrender.com
SUPABASE_DATABASE_URL=<url de conexión a Supabase>
```

**Vercel (frontend):**

```env
VITE_API_BASE_URL=https://proyecto-integrador-as97.onrender.com/
```

---

