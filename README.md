# ScrapUMAP Tesis Lic. Economía CIDE

Proyecto para extraer metadatos de tesis de Licenciatura en Economía del repositorio digital del CIDE y construir un mapa semántico con embeddings, UMAP y clustering.

## Flujo Canónico

El proyecto usa Parquet como formato único de datos tabulares persistidos.

1. Ejecutar `ScrapingTesisLicEcoCIDE.qmd`.
2. Generar `tesis_lic_economia_cide.parquet`.
3. Ejecutar `mapa_semantico_tesis.ipynb`.
4. Generar `clusters_tesis.parquet`, `clusters_resumen.parquet`, los Parquet de variantes de clustering/topic modeling y `semantic_dashboard.html`.

## Archivos Principales

- `ScrapingTesisLicEcoCIDE.qmd`: scraping, extracción de metadatos, limpieza básica y normalización de asesores.
- `mapa_semantico_tesis.ipynb`: lectura del Parquet canónico, embeddings multilingües, UMAP, diagnóstico de clusters, visualizaciones y exportación de resultados analíticos.
- `data-raw/asesores_alias.csv`: tabla editable de alias para normalizar nombres de asesores.
- `data-quality/asesores_sin_alias.csv`: reporte generado con asesores que aún no tienen alias explícito.
- `tesis_lic_economia_cide.parquet`: base canónica de tesis.
- `embeddings_tesis.parquet`: cache de embeddings por tesis y modelo.
- `model_benchmark.parquet`: comparación local de modelos multilingües candidatos.
- `clusters_tesis.parquet`: tesis con cluster y coordenadas UMAP 2D/3D.
- `clusters_resumen.parquet`: resumen enriquecido por cluster, con nombre temático, keywords, tesis representativas y asesores principales.
- `cluster_diagnostics.parquet`: métricas para elegir número de clusters y comparar espacios de clustering.
- `umap_diagnostics.parquet`: comparación de trustworthiness entre la proyección UMAP 2D y la exploración UMAP 3D.
- `cluster_variants.parquet`: asignación de cada tesis bajo K-Means sobre embeddings, UMAP 2D y UMAP 3D.
- `cluster_variant_summary.parquet`: keywords, nombres automáticos y tesis representativas por variante experimental.
- `cluster_variant_metrics.parquet`: comparación de silhouette, dependencia de idioma y traslape de keywords entre variantes.
- `topic_model_metrics.parquet`: métricas interpretativas de topic modeling, incluyendo coherencia `c_v`, diversidad, outliers, balance, score interpretativo y traslape.
- `cluster_keyword_overlap.parquet`: pares de clusters con keywords compartidas para auditar solapamientos temáticos.
- `cluster_anio.parquet`: grilla completa año × cluster para evolución temporal, incluyendo ceros.
- `cluster_lifecycle.parquet`: resumen de ciclo de vida por cluster, con año de inicio, pico y cambio de participación por década.
- `cluster_idioma.parquet`: distribución de idioma por cluster.
- `asesor_cluster_resumen.parquet`: cruce asesor-cluster.
- `asesor_resumen.parquet`: volumen y diversidad temática por asesor.
- `semantic_dashboard.html`: dashboard interactivo exportado desde la notebook.

## Dependencias

R:

```r
install.packages(c("arrow", "dplyr", "purrr", "rvest", "stringr", "tibble", "xml2"))
```

Python:

```bash
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

Para reproducir exactamente el entorno probado en esta máquina:

```bash
uv pip install --python .venv/bin/python -r requirements.lock.txt
```

## Ejecución

Con Quarto instalado:

```bash
quarto render ScrapingTesisLicEcoCIDE.qmd --execute
```

En esta máquina también hay una instalación local ignorada por git en `.tools/quarto`, y `make scrape` la usa automáticamente si existe.

Para ejecutar el notebook desde terminal:

```bash
.venv/bin/jupyter nbconvert --to notebook --execute --inplace mapa_semantico_tesis.ipynb
```

También puedes usar:

```bash
make scrape
make clusters
```

## Notas Metodológicas

- La paginación del scraper no asume un número fijo de tesis; avanza hasta que el repositorio deja de devolver resultados.
- El clustering principal usa K-Means sobre embeddings multilingües; UMAP se usa como layout visual. La notebook también calcula variantes experimentales con K-Means sobre UMAP 2D/3D, spherical K-Means, clustering aglomerativo Ward, NMF sobre TF-IDF, LDA sobre conteos y una variante BERTopic/HDBSCAN con UMAP 10D, `min_cluster_size=10`, `min_samples=2` y c-TF-IDF para comparar compactación visual, coherencia, diversidad, balance y traslape de keywords antes de promover una solución.
- El `interpretability_score` combina coherencia, diversidad, bajo traslape, balance de tamaños, ausencia de singleton topics y penalización moderada por outliers. Sirve para ordenar candidatos, no como sustituto de revisión sustantiva.
- La variante BERTopic/HDBSCAN puede producir outliers; estos se conservan explícitamente para no forzar tesis ambiguas dentro de temas poco robustos.
- La proyección UMAP 3D se exporta como vista exploratoria (`umap_z`) y no cambia el clustering principal; sirve para inspeccionar vecindades que el mapa 2D puede comprimir.
- El modelo de embeddings por defecto es `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`. Es más pesado que MiniLM, pero en el benchmark local produjo mejor cohesión semántica y menor dependencia del idioma. Puedes probar otro modelo con `ST_MODEL_NAME=... make clusters`.
- El número de clusters queda configurado en `ST_CLUSTER_K` y por defecto usa `11`, para evitar soluciones demasiado gruesas aunque el máximo de silhouette favorezca menos grupos.
- Los clusters tienen dos identificadores: `cluster_label` conserva el id técnico y `cluster_theme` contiene el nombre interpretativo basado en keywords.
- El dashboard HTML incluye una película acumulativa del mapa semántico, una carrera anual de temas, comparación por periodos y tablas de ciclo de vida para explorar cómo cambian los clusters en el tiempo.
- La columna `asesor_unificado` reduce variantes textuales del nombre de asesor usando `data-raw/asesores_alias.csv`. Si el repositorio cambia o se agregan nuevas tesis, revisar `data-quality/asesores_sin_alias.csv`, ampliar la tabla de alias y volver a correr `make scrape` antes de interpretar redes de asesoría.
