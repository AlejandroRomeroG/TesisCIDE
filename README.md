# ScrapUMAP Tesis Lic. Economía CIDE

Proyecto para extraer metadatos de tesis de Licenciatura en Economía del repositorio digital del CIDE y construir un mapa semántico con embeddings, UMAP y clustering.

## Flujo Canónico

El proyecto usa Parquet como formato único de datos tabulares persistidos.

1. Ejecutar `ScrapingTesisLicEcoCIDE.qmd`.
2. Generar `tesis_lic_economia_cide.parquet`.
3. Ejecutar `mapa_semantico_tesis.ipynb`.
4. Generar `clusters_tesis.parquet` y `clusters_resumen.parquet`.

## Archivos Principales

- `ScrapingTesisLicEcoCIDE.qmd`: scraping, extracción de metadatos, limpieza básica y normalización de asesores.
- `mapa_semantico_tesis.ipynb`: lectura del Parquet canónico, embeddings, UMAP, K-Means, visualizaciones y exportación de clusters.
- `data-raw/asesores_alias.csv`: tabla editable de alias para normalizar nombres de asesores.
- `tesis_lic_economia_cide.parquet`: base canónica de tesis.
- `clusters_tesis.parquet`: tesis con cluster y coordenadas UMAP.
- `clusters_resumen.parquet`: conteo de tesis por cluster.

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
- El clustering actual usa K-Means sobre las coordenadas UMAP 2D. Sirve para exploración, pero conviene validar la estabilidad de clusters antes de usarlo como clasificación sustantiva.
- La columna `asesor_unificado` reduce variantes textuales del nombre de asesor usando `data-raw/asesores_alias.csv`. Si el repositorio cambia o se agregan nuevas tesis, ampliar esa tabla y volver a correr `make scrape` antes de interpretar redes de asesoría.
