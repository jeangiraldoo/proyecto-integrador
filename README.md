# Planificador de Estudio

Aplicación web para gestionar actividades evaluativas universitarias: planificar, ejecutar,
reprogramar y visualizar progreso.

## Stack

| Capa          | Tecnología                |
| ------------- | ------------------------- |
| Frontend      | React + TypeScript (Vite) |
| Backend       | Django REST Framework     |
| Base de datos | Supabase (PostgreSQL)     |

## Prerrequisitos

- [Node.js](https://nodejs.org/) v20+
- [Python](https://www.python.org/) 3.12+

## Arranque rápido

### Frontend

```bash
cd client
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

### Backend

```bash
cd server
python -m venv .venv

# Windows
.venv\Scripts\activate

# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env
python manage.py migrate
python manage.py runserver
```

Abre [http://localhost:8000](http://localhost:8000).

## Scripts útiles

| Comando                      | Dónde     | Qué hace                         |
| ---------------------------- | --------- | -------------------------------- |
| `npm run dev`                | `client/` | Inicia el servidor de desarrollo |
| `npm run lint`               | `client/` | Ejecuta ESLint                   |
| `npm run build`              | `client/` | Build de producción              |
| `python manage.py runserver` | `server/` | Inicia la API                    |
| `python manage.py migrate`   | `server/` | Aplica migraciones               |

## Estructura del proyecto

```
proyecto-integrador/
├── client/              ← React + Vite + TypeScript
├── server/              ← Django REST Framework
│   ├── config/          ← Configuración del proyecto Django
│   └── planner/         ← App principal
├── .github/workflows/   ← CI/CD (lint, format, commits)
└── README.md
```

## Convenciones

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
  `docs:`, `chore:`, etc.)
- **Ramas**: ver [CONTRIBUTING.md](CONTRIBUTING.md)
