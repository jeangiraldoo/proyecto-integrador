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
- [Python](https://www.python.org/) 3.14+

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
