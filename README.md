<div align="center">
  <img src="web/public/favicon.svg" alt="Monograma AT CIDE" width="96">
  <h1>Atlas de Tesis del CIDE</h1>
  <p><strong>Un atlas semántico e interactivo de las tesis de licenciatura, maestría y doctorado del CIDE.</strong></p>
  <p>
    <a href="https://github.com/AlejandroRomeroG/TesisCIDE/actions/workflows/deploy-pages.yml"><img alt="GitHub Pages" src="https://github.com/AlejandroRomeroG/TesisCIDE/actions/workflows/deploy-pages.yml/badge.svg"></a>
    <a href="https://alejandroromerog.github.io/TesisCIDE/"><img alt="Abrir atlas" src="https://img.shields.io/badge/atlas-abrir-D8FF4F?style=flat-square&amp;labelColor=111815"></a>
    <img alt="2,388 tesis" src="https://img.shields.io/badge/tesis-2%2C388-356FD1?style=flat-square">
    <img alt="21 programas" src="https://img.shields.io/badge/programas-21-178B73?style=flat-square">
    <img alt="20 temas" src="https://img.shields.io/badge/temas-20-BC641F?style=flat-square">
    <img alt="Datos en Parquet" src="https://img.shields.io/badge/datos-Parquet-4B5563?style=flat-square">
  </p>
  <p>
    <a href="#qué-permite-explorar">Qué permite explorar</a> ·
    <a href="#metodología">Metodología</a> ·
    <a href="#inicio-rápido">Inicio rápido</a> ·
    <a href="#arquitectura-del-proyecto">Arquitectura</a> ·
    <a href="#validación">Validación</a>
  </p>
</div>

> [!NOTE]
> Los metadatos proceden del [Repositorio Digital CIDE](https://repositorio-digital.cide.edu/). El atlas es una herramienta independiente de exploración: conserva el enlace a cada ficha original y no sustituye al repositorio institucional.

El proyecto cosecha, normaliza y analiza la producción de tesis del CIDE como un solo corpus. Un modelo multilingüe representa el contenido de cada tesis como un embedding; K-Means estima veinte comunidades temáticas y UMAP organiza sus vecindades en mapas 2D y 3D. El resultado combina exploración semántica, evolución temporal, perfiles de programas y redes de profesorado homologado.

**Sitio público:** [alejandroromerog.github.io/TesisCIDE](https://alejandroromerog.github.io/TesisCIDE/)

## Qué permite explorar

| Vista | Pregunta que ayuda a responder |
| --- | --- |
| **Mapa 2D y 3D** | ¿Qué tesis tratan asuntos parecidos, incluso si pertenecen a programas o idiomas distintos? |
| **Tiempo** | ¿Cuándo aparecen las comunidades temáticas y cómo crece el corpus año con año? |
| **Programas** | ¿Qué mezcla temática caracteriza a cada programa y cuáles tienen perfiles más cercanos? |
| **Temas** | ¿Qué comunidades son más recientes, voluminosas o interdisciplinarias? |
| **Profesorado** | ¿Qué personas conectan más tesis, programas y territorios temáticos? |
| **Método** | ¿Cómo se obtuvo, limpió, representó, agrupó y validó la información? |

La aplicación conserva el contexto durante la búsqueda: las tesis o personas que no coinciden se atenúan en lugar de desaparecer. Los filtros de nivel, programa y tema pueden combinarse con búsquedas por título, autoría, asesoría, año o contenido temático.

## Cobertura actual

| Dimensión | Cobertura |
| --- | ---: |
| Tesis | 2,388 |
| Abstracts utilizables | 2,388 (100%) |
| Programas por nivel | 21 |
| Profesorado homologado | 465 |
| Macrotemas | 20 |
| Subtemas de consenso | 32 |
| Periodo | 1978-2026 |
| Idiomas | 2,250 español · 137 inglés · 1 sin identificar |

El corte publicado corresponde al 12 de julio de 2026. El último año puede estar incompleto porque el repositorio continúa incorporando registros.

## Metodología

| Etapa | Implementación |
| --- | --- |
| **1. Cosecha** | Descubrimiento de colecciones y paginación OAI-PMH sobre DSpace mediante `resumptionToken`. |
| **2. Base canónica** | Deduplicación por `item_handle`, preservación de campos multivaluados y almacenamiento tabular en Parquet. |
| **3. Identidades** | Homologación conservadora de profesorado mediante alias, claves normalizadas, fusiones revisadas y reportes editables. |
| **4. Embeddings** | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`, 768 dimensiones, entrada formada por título, abstract y materias, con normalización L2. |
| **5. Comunidades** | K-Means sobre embeddings originales, `k=20`, `n_init=60` y semilla `420`; UMAP se reserva para visualización. |
| **6. Atlas** | Proyecciones UMAP 2D/3D, agregados por año, nivel, programa y profesorado, reconciliación de conteos y exportación web. |

### Representación semántica

El modelo de lenguaje usado es un Transformer multilingüe especializado en embeddings. La distancia coseno aproxima afinidad de contenido, no calidad, influencia, causalidad ni citación. Autoría, asesoría, nivel, programa y año se excluyen del texto de entrada para evitar que esos metadatos determinen artificialmente la geometría semántica.

Los embeddings se almacenan en `embeddings_tesis.parquet` junto con el modelo y un hash del texto. Si ambos coinciden con el corpus vigente, el notebook reutiliza el cache y permite iterar sobre clustering y visualizaciones sin volver a descargar ni codificar las tesis.

### Comunidades y topic modeling

La solución principal usa K-Means sobre los embeddings multilingües. Se contrasta con K-Means sobre UMAP 2D/3D, spherical K-Means, Ward, NMF, LDA y BERTopic con UMAP 10D, HDBSCAN y c-TF-IDF. Un consenso de coasignaciones produce 32 subtemas y conserva las tres membresías más cercanas de cada tesis junto con un margen de ambigüedad.

Las etiquetas combinan keywords bilingües homologadas, términos distintivos y tesis representativas. `data-raw/topic_keyword_aliases.csv` permite revisar equivalencias como `inflation`/`inflacion`, `labor`/`mercado laboral` o `credit`/`credito` sin modificar el scraper.

### Reducción dimensional

UMAP se ajusta de manera independiente en dos y tres dimensiones con `n_neighbors=30`, `min_dist=0.04`, métrica coseno y semilla `420`. La proyección 3D conserva mejor las vecindades en el corte actual (`trustworthiness=0.895`) que la 2D (`0.874`), pero ambas representan los mismos documentos y comunidades.

## Inicio rápido

### Explorar el frontend con los datos publicados

Requiere Node.js 22 o una versión compatible con Vite 8.

```bash
git clone https://github.com/AlejandroRomeroG/TesisCIDE.git
cd TesisCIDE
npm --prefix web ci
npm --prefix web run dev -- --host 127.0.0.1
```

Vite mostrará la URL local. Los JSON de `web/public/data/` son derivados de los Parquet canónicos y ya están incluidos para facilitar la revisión del sitio.

### Preparar el entorno analítico

Requiere R, Quarto, Python 3.11 y `uv`.

```bash
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.lock.txt
Rscript -e 'install.packages("renv"); renv::restore()'
```

El archivo `requirements.lock.txt` fija el entorno de Python probado. `renv.lock` hace lo propio para R.

### Ejecutar el pipeline

```bash
make scrape
make clusters
make web-data
make web-check
```

| Comando | Resultado |
| --- | --- |
| `make scrape` | Cosecha OAI-PMH, normaliza metadatos, homologa profesorado y genera el Parquet canónico. |
| `make clusters` | Ejecuta embeddings, UMAP, clustering, topic modeling, diagnósticos y agregados analíticos. |
| `make web-data` | Produce y reconcilia los extractos JSON usados por el navegador. |
| `make web-build` | Regenera los datos web y compila la aplicación. |
| `make web-check` | Ejecuta exportación, lint, build y pruebas Playwright responsive. |
| `make web-dev` | Regenera el extracto y abre el servidor de desarrollo. |

La cosecha requiere acceso al Repositorio Digital CIDE. Las etapas posteriores trabajan exclusivamente con archivos locales y no vuelven a scrapear.

## Arquitectura del proyecto

| Ruta | Responsabilidad |
| --- | --- |
| `ScrapingTesisCIDE.qmd` | Cosecha OAI-PMH, controles de calidad, clasificación de programas y homologación de profesorado. |
| `tesis_cide.parquet` | Base canónica de tesis; fuente tabular primaria de todo el análisis. |
| `mapa_semantico_tesis.ipynb` | Embeddings, benchmark de modelos, UMAP, clustering, topic modeling, validación y exportaciones analíticas. |
| `scripts/export_web_data.py` | Contrato entre los Parquet y el frontend; rechaza inconsistencias antes de escribir JSON. |
| `web/src/` | Aplicación React/TypeScript con deck.gl, Apache ECharts y Motion. |
| `web/e2e/` | Pruebas Playwright de interacción, cámara, tooltips, responsive y contenido de canvases. |
| `data-raw/` | Tablas editables de alias y fusiones canónicas. |
| `data-quality/` | Reportes conservadores de nombres pendientes o posibles duplicados. |

### Productos tabulares principales

| Archivo | Contenido |
| --- | --- |
| `clusters_tesis.parquet` | Tesis, comunidad principal, subtemas y coordenadas UMAP 2D/3D. |
| `clusters_resumen.parquet` | Nombre, keywords, cobertura, tesis representativas y profesorado principal por comunidad. |
| `cluster_diagnostics.parquet` | Diagnósticos por `k` y espacio de agrupamiento. |
| `cluster_variant_metrics.parquet` | Métricas comparables de estructura, interpretación y dependencia de metadatos. |
| `topic_model_frontier.parquet` | Soluciones no dominadas en la frontera de coherencia, traslape, balance y estabilidad. |
| `topic_stability.parquet` | Estabilidad entre semillas, submuestras y márgenes de asignación. |
| `topic_memberships.parquet` | Membresías suaves top-3 y ambigüedad por tesis. |
| `topic_taxonomy.parquet` | Taxonomía de macrotemas y subtemas de consenso. |
| `programa_similitud.parquet` | Similitud coseno entre distribuciones temáticas de programas. |
| `asesor_resumen.parquet` | Volumen, cobertura temporal, programas y diversidad temática por persona. |

Todos los datos tabulares persistentes usan Parquet. `semantic_dashboard.html` se conserva como respaldo analítico autocontenido; la experiencia pública recomendada es la aplicación en `web/`.

## Homologación de profesorado

La normalización separa decisiones curatoriales del código:

| Archivo | Uso |
| --- | --- |
| `data-raw/asesores_alias.csv` | Asigna variantes observadas a una forma canónica. |
| `data-raw/asesores_canonicos_merge.csv` | Fusiona grupos canónicos confirmados como la misma persona. |
| `data-quality/asesores_sin_alias.csv` | Lista variantes todavía resueltas solo por reglas determinísticas. |
| `data-quality/asesores_posibles_duplicados.csv` | Sugiere pares similares para revisión; no los fusiona automáticamente. |

Después de una nueva cosecha deben revisarse ambos reportes y promoverse únicamente las correcciones confirmadas a las tablas de `data-raw/`.

## Validación

La calidad no se decide con una sola puntuación.

- **Integridad:** unicidad de identificadores, coordenadas completas, Unicode NFC, ausencia de entidades HTML y reconciliación de totales.
- **Estructura:** silhouette, Davies-Bouldin y Calinski-Harabasz.
- **Sesgo de metadatos:** NMI entre comunidades e idioma, programa y nivel.
- **Interpretación:** coherencia `c_v`, diversidad temática, balance, outliers y traslape Jaccard de keywords.
- **Robustez:** estabilidad entre semillas, bootstraps y submuestras, más una frontera de Pareto entre objetivos rivales.
- **Proyección:** `trustworthiness` para evaluar cuánto preservan UMAP 2D y 3D las vecindades originales.
- **Frontend:** lint, TypeScript, build de producción y pruebas E2E en escritorio, móvil, retrato compacto y paisaje compacto.

```bash
npm --prefix web run lint
npm --prefix web run build
npm --prefix web run test:e2e
```

## Configuración analítica

El notebook acepta variables de entorno para experimentar sin editar sus celdas.

| Variable | Valor predeterminado | Propósito |
| --- | --- | --- |
| `ST_MODEL_NAME` | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | Modelo de embeddings. |
| `ST_CLUSTER_K` | `20` | Número de macrocomunidades. |
| `ST_TOPIC_MODEL_K` | `32` | Número de subtemas para variantes y consenso. |
| `ST_BATCH_SIZE` | `8` para MPNet | Tamaño de lote de codificación. |
| `ST_DEVICE` | CUDA si está disponible; CPU en otro caso | Dispositivo de inferencia. |
| `ST_TOPIC_STABILITY_BOOTSTRAPS` | `6` | Número de submuestras para la auditoría de estabilidad. |

## Alcance y límites

- Las comunidades son una ayuda analítica, no categorías oficiales del CIDE.
- La cercanía en el mapa aproxima similitud semántica local y no demuestra citación, influencia, calidad o causalidad.
- UMAP puede comprimir o separar vecindades; los ejes, la orientación y la escala absoluta no tienen significado sustantivo.
- Las etiquetas resumen grupos y no agotan la posible lectura de tesis híbridas.
- El año más reciente puede estar incompleto mientras el repositorio incorpora nuevos registros.
- El snapshot legado `tesis_lic_economia_cide.parquet` se conserva por compatibilidad histórica, pero no alimenta el atlas global.

## Autor

Creado y mantenido por **Alejandro Romero González**.

- Sitio personal: [alejandroromerog.github.io](https://alejandroromerog.github.io/)
- Fuente institucional: [Repositorio Digital CIDE](https://repositorio-digital.cide.edu/)
