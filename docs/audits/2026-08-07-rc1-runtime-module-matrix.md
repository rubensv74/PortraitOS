# PortraitOS — RC1 Runtime Module Matrix

Commit auditado: `b54a9b5d0f007c8b5bac54d61aadbb2834076e85`

## Bindings

| Módulo | Script en index | Init ejecutado | DOM asociado | Alcanzable | Estado |
|---|---:|---:|---:|---:|---|
| KnowledgeBinding | Sí | Sí | Sí | Sí | ACTIVE |
| ProfileBinding | Sí | Sí | Sí | Sí | ACTIVE |
| ProfileManagerBinding | Sí | Sí | Sí | Sí | ACTIVE |
| PhotosBinding | Sí | Sí | Sí | Sí | ACTIVE |
| IdentityBinding | Sí | Sí | Sí | Sí | ACTIVE |
| DirectionBinding | Sí | Sí | Sí | Sí | ACTIVE |
| ValidationBinding | Sí | Sí | Sí | Sí | ACTIVE |
| PromptBinding | Sí | Sí | Sí | Sí | ACTIVE |
| ExportBinding | Sí | Sí | Sí | Sí | ACTIVE |
| ReviewBinding | Sí | Sí | Sí (`data-review-binding`) | Sí | ACTIVE |
| HistoryBinding | **No** | **No** | **No (`data-history*`)** | **No** | **DEAD_RUNTIME_MODULE** |

## Core controllers

| Módulo | Carga | Inicialización | Estado |
|---|---:|---:|---|
| Router | Sí | Uso indirecto desde Wizard | INDIRECT_DEPENDENCY |
| Wizard | Sí | `UI.init()` llama `Wizard.init()` | ACTIVE |
| UI | Sí | Bootstrap llama `UI.init()` | ACTIVE |
| ProfileStorage | Sí | Bootstrap llama `ProfileStorage.init()` | ACTIVE |

## Services / engines principales

| Grupo | Estado |
|---|---|
| Photo services | ACTIVE |
| Profile services | ACTIVE |
| Identity / Creative engines | ACTIVE |
| Prompt engine / builder / compiler / optimizer | ACTIVE |
| Knowledge Pack service | ACTIVE |
| PromptHistoryService | ACTIVE |
| PromptExportService | ACTIVE |
| PortraitReviewService | ACTIVE |
| Object URL Registry | ACTIVE |
| Storage Integrity | ACTIVE |

## Review checklist end-to-end

| Categoría | Constant | Service | Binding | DOM | Sprint 6 test | Estado |
|---|---:|---:|---:|---:|---:|---|
| identity | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| hair | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| skin | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| proportions | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| distinctiveFeatures | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| permanentAccessories | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| creativeDirection | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| composition | Sí | Sí | Sí | Sí | Sí | ACTIVE |
| technicalQuality | Sí | Sí | Sí | Sí | Sí | ACTIVE |

## History runtime dependency

`HistoryBinding.init()` requiere:

- `PromptHistoryService`;
- root `[data-history]`;
- búsqueda `[data-history-search]`;
- filtros;
- lista `[data-history-list]`;
- paginación;
- estado vacío y contador.

El servicio está disponible, pero el script y el DOM no están integrados.
