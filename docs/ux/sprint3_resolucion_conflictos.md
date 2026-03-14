# Diagrama de decisiones para Resolución de Conflictos (US-6)

Este diagrama ilustra el flujo crítico del sprint (Gating), detallando cómo el usuario percibe la
relación matemática de la sobrecarga y los pasos para recuperar un plan viable.

```mermaid
flowchart TD
    subgraph USER["Usuario (Interacción)"]
        A(["Inicio: Clic en 'Conflictos'\n(Sidebar)"])
        MODAL["Ve Modal de Conflicto\n(Muestra cifras: 7h / 6h max)"]
        ACT{"¿Estrategia de\nresolución?"}
        DATE["Clic 'Cambiar fecha'"]
        HOUR["Clic 'Reducir horas'"]
        INPUT["Ingresa nuevo valor o\nselecciona Sugerencia libre"]
        SAVE["Clic 'Guardar'"]
        VIS(["Conflicto resuelto:\nDesaparece de la lista"])
    end

    subgraph FRONT["Frontend (React)"]
        CF_UI["Renderiza ConflictModal"]
        RES_UI["Abre panel de resolución\n(cf-resolver-layer)"]
        VALID{"¿Valor válido?"}
        ERR["Muestra Error Local\n'Ingresa horas válidas'"]
        LOAD["Loading spinner..."]
        UI["Sincroniza UI local\ny cierra modal de resolución"]
    end

    subgraph BACK["Backend (Django)"]
        POST["POST /api/conflicts/:id/resolve/\n(reschedule o reduce_hours)"]
        LOG["Guarda acción en\nConflictResolution"]
        EVAL["Re-evalúa el día\n_evaluate_day_conflicts()"]
        E200["200 OK\nRetorna estado actualizado"]
    end

    A --> CF_UI
    CF_UI --> MODAL
    MODAL --> ACT
    ACT -- "Mover Fecha" --> DATE
    ACT -- "Bajar Horas" --> HOUR
    DATE --> RES_UI
    HOUR --> RES_UI
    RES_UI --> INPUT
    INPUT --> SAVE
    SAVE --> VALID
    VALID -- "No" --> ERR
    ERR --> INPUT
    VALID -- "Sí" --> LOAD
    LOAD --> POST
    POST --> LOG
    LOG --> EVAL
    EVAL --> E200
    E200 --> UI
    UI --> VIS

    %% Estilos
    style A fill:#2c3e50,color:#fff,stroke:#1a252f
    style MODAL fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style ACT fill:#fef9e7,color:#7d6608,stroke:#d4ac0d
    style DATE fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style HOUR fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style INPUT fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style SAVE fill:#3498db,color:#fff,stroke:#2980b9
    style VIS fill:#fff,color:#333,stroke:#555
    style CF_UI fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style RES_UI fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style VALID fill:#fef9e7,color:#7d6608,stroke:#d4ac0d
    style ERR fill:#fadbd8,color:#c0392b,stroke:#e74c3c
    style LOAD fill:#d6eaf8,color:#1a5276,stroke:#3498db
    style UI fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style POST fill:#d6eaf8,color:#1a5276,stroke:#3498db
    style LOG fill:#fef9e7,color:#7d6608,stroke:#d4ac0d
    style EVAL fill:#d6eaf8,color:#1a5276,stroke:#3498db
    style E200 fill:#d5f5e3,color:#1e8449,stroke:#27ae60
```
