# Diagrama de decisiones para Reprogramación (US-6)

Este flujo documenta la Heurística de Prevención de Errores: cómo el frontend evalúa y advierte al
usuario si su reprogramación generará un conflicto de carga _antes_ de enviar la petición al
backend.

```mermaid

flowchart TD
    subgraph USER["Usuario (Interacción)"]
        A(["Inicio: Modal Editar Tarea"])
        MOD["Modifica Fecha objetivo\no Horas estimadas"]
        WARN_UI["Visualiza alerta en rojo:\n'Conflicto de carga para esta fecha'"]
        SAVE["Clic 'Guardar cambios'"]
        VIS(["Visualiza Tarea\nen nueva fecha (/hoy)"])
    end

    subgraph FRONT["Frontend (React)"]
        CALC_CAP{"¿Horas planeadas >\nmax_daily_hours?"}
        VALID{"¿Campos\nVálidos?"}
        ERR["Error Local\n(Nombre/Horas vacías)"]
        LOAD["Loading spinner..."]
        UI["Actualiza Kanban\n(applyTodayDataPatchLocally)"]
    end

    subgraph BACK["Backend (Django)"]
        PATCH["PATCH /api/.../subtasks/:id/"]
        EVAL["_evaluate_day_conflicts()\nPara fecha antigua y nueva"]
        CONF["Crea o Actualiza Conflicto\n(Modelo Conflict)"]
        E200["200 OK"]
    end

    A --> MOD
    MOD --> CALC_CAP
    CALC_CAP -- "Sí (Advierte al usuario)" --> WARN_UI
    CALC_CAP -- "No (Muestra barra en verde)" --> SAVE
    WARN_UI --> SAVE
    SAVE --> VALID
    VALID -- "No" --> ERR
    ERR --> MOD
    VALID -- "Sí" --> LOAD
    LOAD --> PATCH
    PATCH --> EVAL
    EVAL --> CONF
    CONF --> E200
    E200 --> UI
    UI --> VIS

    %% Estilos
    style A fill:#2c3e50,color:#fff,stroke:#1a252f
    style MOD fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style WARN_UI fill:#fadbd8,color:#c0392b,stroke:#e74c3c
    style SAVE fill:#3498db,color:#fff,stroke:#2980b9
    style VIS fill:#fff,color:#333,stroke:#555
    style CALC_CAP fill:#fef9e7,color:#7d6608,stroke:#d4ac0d
    style VALID fill:#fef9e7,color:#7d6608,stroke:#d4ac0d
    style ERR fill:#fadbd8,color:#c0392b,stroke:#e74c3c
    style LOAD fill:#d6eaf8,color:#1a5276,stroke:#3498db
    style UI fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style PATCH fill:#d6eaf8,color:#1a5276,stroke:#3498db
    style EVAL fill:#d6eaf8,color:#1a5276,stroke:#3498db
    style CONF fill:#fadbd8,color:#c0392b,stroke:#e74c3c
    style E200 fill:#d5f5e3,color:#1e8449,stroke:#27ae60

```
