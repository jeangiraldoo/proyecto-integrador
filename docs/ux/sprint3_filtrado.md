# Diagrama de flujo de decisiones para Filtrado (US-5)

Este diagrama documenta la interacción del usuario con la barra de filtros en la vista `/hoy`,
asegurando que la lista se actualice en tiempo real sin perder las reglas de prioridad del sistema.

````mermaid
flowchart TD
    subgraph USER["Usuario (Interacción)"]
        A(["Inicio: Vista /hoy"])
        PANEL_OPEN["Clic en 'Filtros'"]
        ACT{"¿Qué desea filtrar?"}
        FILTER_C["Selecciona Curso\n(Ej. Álgebra)"]
        FILTER_S["Selecciona Estado\n(Ej. Vencidas)"]
        CLEAR["Clic en 'Limpiar filtros'"]
        VIS(["Visualiza lista actualizada\nmanteniendo prioridad"])
    end

    subgraph FRONT["Frontend (React)"]
        STATE["Abre panel\n(setFiltersOpen)"]
        APPLY["Aplica filtro en estado local\n(toggleFilter)"]
        EVAL_U["Evalúa prioridades y desempate\n(Asegura regla de US-04)"]
        RESET["Restablece activeFilters = [ ]"]
        UI["Actualiza vista al instante\n(Sin recargar página)"]
    end

    A --> PANEL_OPEN
    PANEL_OPEN --> STATE
    STATE --> ACT
    ACT -- "Por Curso" --> FILTER_C
    ACT -- "Por Estado" --> FILTER_S
    ACT -- "Restablecer" --> CLEAR
    FILTER_C --> APPLY
    FILTER_S --> APPLY
    CLEAR --> RESET
    RESET --> UI
    APPLY --> EVAL_U
    EVAL_U --> UI
    UI --> VIS

    %% Estilos
    style A fill:#2c3e50,color:#fff,stroke:#1a252f
    style PANEL_OPEN fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style ACT fill:#fef9e7,color:#7d6608,stroke:#d4ac0d
    style FILTER_C fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style FILTER_S fill:#ecf0f1,color:#333,stroke:#bdc3c7
    style CLEAR fill:#e74c3c,color:#fff,stroke:#c0392b
    style VIS fill:#fff,color:#333,stroke:#555
    style STATE fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style APPLY fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style EVAL_U fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style RESET fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    style UI fill:#d5f5e3,color:#1e8449,stroke:#27ae60
    ```
````
