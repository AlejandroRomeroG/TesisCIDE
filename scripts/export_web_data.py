#!/usr/bin/env python3
"""Build compact, validated web payloads from the canonical Parquet outputs."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "web" / "public" / "data"
HTML_ENTITY_RE = re.compile(r"&(?:#[0-9]+|#x[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);|<U\+[0-9A-Fa-f]{4,6}>")


def read_parquet(name: str) -> pd.DataFrame:
    path = ROOT / name
    if not path.exists():
        raise FileNotFoundError(f"Missing canonical input: {path}")
    return pd.read_parquet(path)


def text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    return unicodedata.normalize("NFC", str(value).strip()) or None


def number(value: Any) -> int | float | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (int, np.integer)):
        return int(value)
    result = float(value)
    if not math.isfinite(result):
        return None
    return result


def split_pipe(value: Any) -> list[str]:
    normalized = text(value)
    if not normalized:
        return []
    return [part.strip() for part in normalized.split("|") if part.strip()]


def split_comma(value: Any) -> list[str]:
    normalized = text(value)
    if not normalized:
        return []
    return [part.strip() for part in normalized.split(",") if part.strip()]


def parse_cluster_id(value: Any) -> int:
    match = re.search(r"[0-9]+", text(value) or "")
    if not match:
        raise ValueError(f"Invalid cluster identifier: {value!r}")
    return int(match.group())


def write_json(name: str, payload: Any) -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / name
    serialized = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    path.write_text(serialized, encoding="utf-8")
    return path.stat().st_size


def validate_sources(
    theses: pd.DataFrame,
    clusters: pd.DataFrame,
    programs: pd.DataFrame,
    program_matrix: pd.DataFrame,
) -> None:
    if len(theses) != theses["item_handle"].nunique():
        raise ValueError("Thesis handles are not unique.")
    if theses[["umap_x", "umap_y", "umap_z", "cluster_id", "grado_programa"]].isna().any().any():
        raise ValueError("The semantic layout contains missing coordinates or dimensions.")

    observed_clusters = theses.groupby("cluster_id").size().sort_index()
    expected_clusters = clusters.set_index("cluster_id")["conteo"].sort_index()
    pd.testing.assert_series_equal(
        observed_clusters.astype("int64"),
        expected_clusters.astype("int64"),
        check_names=False,
        check_index_type=False,
    )

    observed_programs = theses.groupby("grado_programa").size().sort_index()
    expected_programs = programs.set_index("grado_programa")["n_tesis"].sort_index()
    pd.testing.assert_series_equal(
        observed_programs.astype("int64"),
        expected_programs.astype("int64"),
        check_names=False,
        check_index_type=False,
    )

    cluster_shares = program_matrix.groupby("cluster_id")["participacion_cluster"].sum()
    program_shares = program_matrix.groupby("grado_programa")["participacion_programa"].sum()
    if not np.allclose(cluster_shares.to_numpy(), 1.0, atol=1e-9):
        raise ValueError("Program shares do not reconcile within every cluster.")
    if not np.allclose(program_shares.to_numpy(), 1.0, atol=1e-9):
        raise ValueError("Cluster shares do not reconcile within every program.")

    for column in theses.select_dtypes(include=["object", "string"]).columns:
        for value in theses[column].dropna().astype(str):
            if not unicodedata.is_normalized("NFC", value):
                raise ValueError(f"Non-NFC text found in {column}.")
            if HTML_ENTITY_RE.search(value):
                raise ValueError(f"Encoded HTML entity found in {column}.")


def main() -> None:
    theses = read_parquet("clusters_tesis.parquet")
    clusters = read_parquet("clusters_resumen.parquet")
    interdisciplinarity = read_parquet("cluster_interdisciplinariedad.parquet")
    timeline = read_parquet("cluster_anio.parquet")
    programs = read_parquet("programa_cluster_resumen.parquet")
    program_matrix = read_parquet("cluster_programa.parquet")
    program_similarity = read_parquet("programa_similitud.parquet")
    cluster_levels = read_parquet("cluster_nivel.parquet")
    advisors = read_parquet("asesor_resumen.parquet")
    advisor_topics = read_parquet("asesor_cluster_resumen.parquet")
    embeddings = read_parquet("embeddings_tesis.parquet")
    umap_diagnostics = read_parquet("umap_diagnostics.parquet")

    validate_sources(theses, clusters, programs, program_matrix)

    cluster_details = clusters.merge(
        interdisciplinarity.drop(
            columns=[
                "cluster_label",
                "cluster_theme",
                "cluster_display_label",
                "conteo",
                "n_programas",
                "programas_top",
                "keywords",
            ]
        ),
        on="cluster_id",
        how="left",
        validate="one_to_one",
    )
    centroids = theses.groupby("cluster_id")[["umap_x", "umap_y", "umap_z"]].mean()

    points = [
        {
            "id": text(row.item_handle),
            "title": text(row.titulo),
            "author": text(row.autorx),
            "year": int(row.anio_pub),
            "advisor": text(row.asesor_unificado),
            "language": text(row.idioma),
            "level": text(row.nivel),
            "program": text(row.programa),
            "degreeProgram": text(row.grado_programa),
            "url": text(row.url),
            "clusterId": int(row.cluster_id),
            "clusterTheme": text(row.cluster_theme),
            "subtopic": text(row.consensus_primary_theme),
            "secondarySubtopic": text(row.consensus_secondary_theme),
            "membershipMargin": number(row.consensus_membership_margin),
            "taxonomy": text(row.taxonomy_label),
            "x": float(row.umap_x),
            "y": float(row.umap_y),
            "z": float(row.umap_z),
        }
        for row in theses.itertuples(index=False)
    ]

    details = {
        text(row.item_handle): {
            "abstract": text(row.resumen),
            "subjects": split_pipe(row.materias),
        }
        for row in theses.itertuples(index=False)
    }

    cluster_payload = []
    for row in cluster_details.sort_values("cluster_id").itertuples(index=False):
        centroid = centroids.loc[row.cluster_id]
        cluster_payload.append(
            {
                "id": int(row.cluster_id),
                "label": text(row.cluster_label),
                "theme": text(row.cluster_theme),
                "count": int(row.conteo),
                "share": float(row.participacion),
                "yearMean": float(row.anio_promedio),
                "yearMin": int(row.anio_min),
                "yearMax": int(row.anio_max),
                "languages": split_comma(row.idiomas),
                "levels": split_comma(row.niveles),
                "programCount": int(row.n_programas),
                "topPrograms": split_pipe(row.programas_top),
                "keywords": split_comma(row.keywords),
                "representativeTheses": split_pipe(row.tesis_representativas),
                "topAdvisors": split_comma(row.asesores_top),
                "interdisciplinarity": number(row.entropia_programas),
                "effectivePrograms": number(row.programas_efectivos),
                "dominantProgram": text(row.programa_dominante),
                "dominantProgramShare": number(row.participacion_programa_dominante),
                "dominantLevel": text(row.nivel_dominante),
                "dominantLevelShare": number(row.participacion_nivel_dominante),
                "centroid": [float(centroid.umap_x), float(centroid.umap_y), float(centroid.umap_z)],
            }
        )

    program_payload = [
        {
            "level": text(row.nivel),
            "program": text(row.programa),
            "degreeProgram": text(row.grado_programa),
            "thesisCount": int(row.n_tesis),
            "clusterCount": int(row.n_clusters),
            "themeEntropy": float(row.entropia_tematica),
            "themeConcentration": float(row.concentracion_tematica_hhi),
            "mainCluster": text(row.cluster_principal),
            "mainClusterLabel": text(row.cluster_principal_label),
            "mainClusterShare": float(row.participacion_cluster_principal),
            "topThemes": split_pipe(row.temas_top),
        }
        for row in programs.sort_values(["nivel", "n_tesis"], ascending=[True, False]).itertuples(index=False)
    ]

    year_totals = theses.groupby("anio_pub").size()
    level_counts = theses["nivel"].value_counts()
    language_counts = theses["idioma"].value_counts()
    abstract_count = int(theses["resumen"].fillna("").astype(str).str.strip().str.len().ge(40).sum())
    embedding_columns = [column for column in embeddings.columns if column.startswith("embedding_")]
    umap_trustworthiness = umap_diagnostics.set_index("projection")["trustworthiness"]
    if len(embeddings) != len(theses) or not embedding_columns:
        raise ValueError("Embedding cache does not match the canonical thesis dataset.")
    if not {"umap_2d", "umap_3d"}.issubset(umap_trustworthiness.index):
        raise ValueError("UMAP diagnostics must contain the 2D and 3D projections.")
    source_mtime = max(
        (ROOT / name).stat().st_mtime
        for name in [
            "clusters_tesis.parquet",
            "clusters_resumen.parquet",
            "cluster_anio.parquet",
            "programa_cluster_resumen.parquet",
            "asesor_resumen.parquet",
        ]
    )

    analytics = {
        "meta": {
            "source": "Repositorio Digital CIDE, cosecha OAI-PMH",
            "sourceUpdatedAt": datetime.fromtimestamp(source_mtime, tz=timezone.utc).isoformat(),
            "thesisCount": int(len(theses)),
            "programCount": int(theses["grado_programa"].nunique()),
            "advisorCount": int(len(advisors)),
            "clusterCount": int(theses["cluster_id"].nunique()),
            "abstractCount": abstract_count,
            "yearMin": int(theses["anio_pub"].min()),
            "yearMax": int(theses["anio_pub"].max()),
            "embeddingModel": text(clusters["embedding_model"].dropna().iloc[0]),
            "embeddingDimension": int(len(embedding_columns)),
            "clusterAlgorithm": text(clusters["cluster_algo"].dropna().iloc[0]),
            "umapTrustworthiness": {
                "twoD": float(umap_trustworthiness.loc["umap_2d"]),
                "threeD": float(umap_trustworthiness.loc["umap_3d"]),
            },
            "levelCounts": {text(key): int(value) for key, value in level_counts.items()},
            "languageCounts": {text(key): int(value) for key, value in language_counts.items()},
            "yearTotals": {str(int(key)): int(value) for key, value in year_totals.items()},
        },
        "clusters": cluster_payload,
        "timeline": [
            {
                "year": int(row.anio_pub),
                "clusterId": int(row.cluster_id),
                "clusterTheme": text(row.cluster_theme),
                "count": int(row.conteo),
                "yearTotal": int(row.total_anio),
                "yearShare": float(row.participacion_anio),
            }
            for row in timeline.sort_values(["anio_pub", "cluster_id"]).itertuples(index=False)
        ],
        "programs": program_payload,
        "programMatrix": [
            {
                "clusterId": int(row.cluster_id),
                "clusterTheme": text(row.cluster_theme),
                "level": text(row.nivel),
                "program": text(row.programa),
                "degreeProgram": text(row.grado_programa),
                "count": int(row.conteo),
                "clusterShare": float(row.participacion_cluster),
                "programShare": float(row.participacion_programa),
            }
            for row in program_matrix.sort_values(["grado_programa", "cluster_id"]).itertuples(index=False)
        ],
        "programSimilarity": [
            {
                "programA": text(row.programa_a),
                "programB": text(row.programa_b),
                "similarity": float(row.similitud_coseno),
                "thesisCountA": int(row.n_tesis_a),
                "thesisCountB": int(row.n_tesis_b),
            }
            for row in program_similarity.itertuples(index=False)
        ],
        "clusterLevels": [
            {
                "clusterId": int(row.cluster_id),
                "clusterTheme": text(row.cluster_theme),
                "level": text(row.nivel),
                "count": int(row.conteo),
                "clusterTotal": int(row.total_cluster),
                "clusterShare": float(row.participacion_cluster),
            }
            for row in cluster_levels.sort_values(["cluster_id", "nivel"]).itertuples(index=False)
        ],
        "advisors": [
            {
                "name": text(row.asesor_unificado),
                "thesisCount": int(row.n_tesis),
                "clusterCount": int(row.n_clusters),
                "mainCluster": text(row.cluster_principal),
                "mainClusterId": parse_cluster_id(row.cluster_principal_id),
                "mainClusterShare": float(row.participacion_cluster_principal),
                "yearMin": int(row.anio_min),
                "yearMax": int(row.anio_max),
                "programCount": int(row.n_programas),
            }
            for row in advisors.sort_values("n_tesis", ascending=False).itertuples(index=False)
        ],
        "advisorTopics": [
            {
                "name": text(row.asesor_unificado),
                "clusterId": int(row.cluster_id),
                "clusterTheme": text(row.cluster_theme),
                "thesisCount": int(row.n_tesis),
                "programCount": int(row.n_programas),
                "yearMin": int(row.anio_min),
                "yearMax": int(row.anio_max),
                "advisorTotal": int(row.total_asesor),
                "advisorShare": float(row.participacion_asesor),
            }
            for row in advisor_topics.sort_values(["asesor_unificado", "n_tesis"], ascending=[True, False]).itertuples(index=False)
        ],
    }

    atlas_size = write_json("atlas.json", {"points": points})
    details_size = write_json("details.json", {"details": details})
    analytics_size = write_json("analytics.json", analytics)

    reloaded = json.loads((OUTPUT_DIR / "atlas.json").read_text(encoding="utf-8"))
    if len(reloaded["points"]) != len(theses):
        raise ValueError("Serialized atlas row count does not reconcile.")

    print(
        "Web data ready: "
        f"{len(points):,} theses, {len(cluster_payload)} clusters, {len(program_payload)} programs, "
        f"{len(advisors)} advisors | "
        f"atlas={atlas_size / 1_000_000:.2f} MB, analytics={analytics_size / 1_000_000:.2f} MB, "
        f"details={details_size / 1_000_000:.2f} MB"
    )


if __name__ == "__main__":
    main()
