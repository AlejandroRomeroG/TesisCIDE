# Mapa Semántico de Tesis CIDE

Proyecto para cosechar las tesis de todas las licenciaturas, maestrías y doctorados del repositorio digital del CIDE y construir un mapa semántico global con embeddings, UMAP, clustering, topic modeling y análisis por programa, nivel, tiempo y profesorado.

## Flujo Canónico

El proyecto usa Parquet como formato único de datos tabulares persistidos.

1. Ejecutar `ScrapingTesisLicEcoCIDE.qmd`.
2. Generar `tesis_cide.parquet` y `tesis_programas_resumen.parquet`.
3. Ejecutar `mapa_semantico_tesis.ipynb`.
4. Generar `clusters_tesis.parquet`, `clusters_resumen.parquet`, los Parquet de variantes de clustering/topic modeling y `semantic_dashboard.html`.

## Archivos Principales

- `ScrapingTesisLicEcoCIDE.qmd`: cosecha OAI-PMH de la comunidad completa de tesis, descubrimiento automático de programas, validación y homologación de profesorado.
- `mapa_semantico_tesis.ipynb`: lectura del Parquet canónico, embeddings multilingües, UMAP, diagnóstico de clusters, visualizaciones y exportación de resultados analíticos.
- `data-raw/asesores_alias.csv`: tabla editable de alias para normalizar nombres de asesores.
- `data-raw/asesores_canonicos_merge.csv`: fusiones revisadas entre grupos canónicos de nombres que pertenecen a la misma persona.
- `data-raw/topic_keyword_aliases.csv`: tabla editable de alias bilingües para homologar keywords temáticas en español e inglés.
- `data-quality/asesores_sin_alias.csv`: variantes sin alias explícito, con nombre canónico determinístico sugerido.
- `data-quality/asesores_posibles_duplicados.csv`: pares aproximados que aún requieren revisión; puede quedar vacío.
- `tesis_cide.parquet`: base canónica de todas las tesis y sus dimensiones de nivel, programa y colección.
- `tesis_programas_resumen.parquet`: cobertura, años e idiomas por colección académica.
- `asesores_catalogo.parquet`: catálogo canónico de profesorado, variantes observadas, programas y volumen de tesis.
- `tesis_lic_economia_cide.parquet`: snapshot legado de la antigua muestra exclusiva de Licenciatura en Economía.
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
- `topic_model_frontier.parquet`: variantes no dominadas en una frontera Pareto de coherencia, bajo traslape, balance, baja dependencia de idioma y estabilidad.
- `topic_stability.parquet`: métricas de robustez por variante, incluyendo estabilidad por semillas, bootstrap/submuestras y margen de asignación.
- `topic_memberships.parquet`: membresías suaves top-3 por tesis para los subtemas del consenso ensemble.
- `topic_taxonomy.parquet`: taxonomía jerárquica macrotema × subtema construida desde clusters principales y consenso entre modelos.
- `cluster_keyword_overlap.parquet`: pares de clusters con keywords compartidas para auditar solapamientos temáticos.
- `cluster_anio.parquet`: grilla completa año × cluster para evolución temporal, incluyendo ceros.
- `cluster_lifecycle.parquet`: resumen de ciclo de vida por cluster, con año de inicio, pico y cambio de participación por década.
- `cluster_idioma.parquet`: distribución de idioma por cluster.
- `cluster_programa.parquet`: composición de cada cluster por programa y perfil de temas dentro de cada programa.
- `cluster_nivel.parquet`: composición de cada cluster por nivel académico.
- `cluster_interdisciplinariedad.parquet`: entropía entre programas, concentración, programa dominante y número efectivo de programas por tema.
- `programa_cluster_resumen.parquet`: tema principal, diversidad y top de temas para cada combinación nivel-programa.
- `programa_similitud.parquet`: similitud coseno entre programas a partir de su distribución temática.
- `programa_anio.parquet`: producción anual por nivel y programa.
- `asesor_cluster_resumen.parquet`: cruce asesor-cluster.
- `asesor_resumen.parquet`: volumen y diversidad temática por asesor.
- `semantic_dashboard.html`: dashboard interactivo exportado desde la notebook.

## Dependencias

R:

```r
install.packages(c("arrow", "dplyr", "purrr", "stringi", "stringr", "tibble", "xml2"))
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
.venv/bin/jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=-1 --inplace mapa_semantico_tesis.ipynb
```

También puedes usar:

```bash
make scrape
make clusters
```

## Notas Metodológicas

- El scraper usa el endpoint OAI-PMH de DSpace. Descubre automáticamente las colecciones cuyo nombre corresponde a tesis de licenciatura, maestría o doctorado y cosecha la comunidad `com_11651_3` mediante `resumptionToken`.
- Los metadatos multivaluados se conservan: autores, resúmenes bilingües, materias y coasesores. Los acentos permanecen en UTF-8 dentro de Parquet y HTML.
- La homologación de profesorado combina alias explícitos, claves determinísticas sin títulos/acentos/puntuación, fusiones canónicas revisadas y un reporte conservador de similitudes pendientes. Los coasesores se analizan como personas separadas.
- El clustering principal usa K-Means sobre embeddings multilingües; UMAP se usa como layout visual. La notebook también calcula K-Means sobre UMAP 2D/3D, spherical K-Means, Ward, NMF, LDA y BERTopic/HDBSCAN con UMAP 10D, `min_cluster_size=25`, `min_samples=2` y c-TF-IDF.
- El `interpretability_score` combina coherencia, diversidad, bajo traslape, balance de tamaños, ausencia de singleton topics y penalización moderada por outliers. Sirve para ordenar candidatos, no como sustituto de revisión sustantiva.
- La variante BERTopic/HDBSCAN puede producir outliers; estos se conservan explícitamente para no forzar tesis ambiguas dentro de temas poco robustos.
- La proyección UMAP 3D se exporta como vista exploratoria (`umap_z`) y no cambia por sí sola el clustering principal; sirve para inspeccionar vecindades que el mapa 2D puede comprimir.
- La notebook calcula un consenso ensemble: combina co-asignaciones ponderadas de K-Means, UMAP 2D/3D, spherical K-Means, Ward, NMF y BERTopic, y luego reclusteriza esa matriz para obtener subtemas más estables.
- La taxonomía jerárquica cruza 20 macrotemas con 32 subtemas del consenso. Esto permite leer la colección en dos escalas: campos amplios del CIDE y especializaciones internas.
- `topic_memberships.parquet` evita forzar una tesis a un solo tema: conserva los tres subtemas de consenso más cercanos y un margen de ambigüedad para detectar tesis híbridas.
- `topic_model_frontier.parquet` evita elegir el "mejor" modelo con una sola métrica. Conserva los modelos no dominados entre coherencia, bajo traslape, balance, outliers, dependencia de idioma y estabilidad.
- `topic_stability.parquet` agrega una auditoría de robustez con semillas, submuestras y margen de asignación. El `robust_interpretability_score` combina el score interpretativo con esa estabilidad.
- `data-raw/topic_keyword_aliases.csv` homologa keywords bilingües como `inflation`/`inflacion`, `labor`/`mercado laboral` o `credit`/`credito`. Editar este CSV y volver a correr `make clusters` permite mejorar etiquetas sin tocar el scraper.
- El modelo de embeddings por defecto es `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`. Es más pesado que MiniLM, pero en el benchmark local produjo mejor cohesión semántica y menor dependencia del idioma. Puedes probar otro modelo con `ST_MODEL_NAME=... make clusters`.
- El número de macroclusters queda configurado en `ST_CLUSTER_K` y por defecto usa `20`; `ST_TOPIC_MODEL_K` controla los subtemas y usa `32`.
- Los clusters tienen dos identificadores: `cluster_label` conserva el id técnico y `cluster_theme` contiene el nombre interpretativo basado en keywords.
- El dashboard HTML incluye película acumulativa, carrera anual de temas, mapas 2D/3D, composición por nivel, heatmap programa-tema, similitud entre programas, clusters interdisciplinarios, perfiles de programas y redes de profesorado.
- Si el repositorio cambia, revisar `data-quality/asesores_sin_alias.csv` y `data-quality/asesores_posibles_duplicados.csv`; promover correcciones a las dos tablas editables de `data-raw/` y volver a correr `make scrape`.
