import {
  ArrowUpRight,
  Braces,
  ChevronDown,
  Clock3,
  Database,
  Languages,
  MapPinned,
  Network,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import type { AtlasMeta } from '../types'
import { formatCoefficient, formatNumber, formatPercent, updatedDate } from '../lib/format'

interface MethodologyViewProps {
  meta: AtlasMeta
}

const OUTCOMES = [
  {
    icon: Search,
    title: 'Encontrar relaciones',
    copy: 'Ubica tesis que hablan de asuntos parecidos, aunque pertenezcan a programas distintos o no usen exactamente las mismas palabras.',
  },
  {
    icon: Clock3,
    title: 'Seguir las ideas en el tiempo',
    copy: 'Muestra cuándo aparecen los temas, cuáles ganan espacio y cómo se transforma la conversación académica del CIDE.',
  },
  {
    icon: Network,
    title: 'Cruzar trayectorias',
    copy: 'Permite comparar programas y reconocer al profesorado que conecta temas, generaciones y áreas de estudio.',
  },
]

function methodologyPipeline(modelName: string, embeddingDimension: number) {
  return [
    {
      icon: Database,
      title: 'Reunimos el corpus de tesis',
      copy: 'Cosechamos las fichas públicas del Repositorio Digital CIDE mediante OAI-PMH y reunimos licenciaturas, maestrías y doctorados en una base canónica con identificadores únicos.',
    },
    {
      icon: Braces,
      title: 'Estandarizamos los metadatos',
      copy: 'Preservamos autores, asesores, materias y abstracts multivaluados; eliminamos duplicados y normalizamos Unicode, espacios, entidades HTML, acentos y caracteres especiales.',
    },
    {
      icon: UserRoundCheck,
      title: 'Homologamos los nombres del profesorado',
      copy: 'Comparamos títulos, abreviaturas, orden de apellidos y variantes ortográficas con catálogos editables y revisión conservadora para reunir cada identidad sin fusionar personas distintas.',
    },
    {
      icon: Languages,
      title: 'Representamos el contenido como vectores',
      copy: `Un modelo de lenguaje (LLM) de tipo Transformer especializado en embeddings, ${modelName}, procesa título, abstract y materias en español e inglés y produce un vector de ${embeddingDimension} dimensiones por tesis.`,
    },
    {
      icon: Network,
      title: 'Estimamos comunidades temáticas',
      copy: 'Aplicamos K-Means en el espacio semántico original y contrastamos la solución con métodos alternativos, métricas internas, estabilidad y traslape de palabras clave antes de interpretar veinte comunidades.',
    },
    {
      icon: MapPinned,
      title: 'Construimos y validamos el Atlas',
      copy: 'UMAP proyecta las vecindades en 2D y 3D sin definir los grupos. Después integramos tiempo, programas y profesorado, reconciliamos todos los conteos y publicamos el resultado interactivo.',
    },
  ]
}

export function MethodologyView({ meta }: MethodologyViewProps) {
  const modelName = meta.embeddingModel.split('/').at(-1) ?? meta.embeddingModel
  const spanishCount = meta.languageCounts.spa ?? 0
  const englishCount = meta.languageCounts.eng ?? 0
  const unknownLanguageCount = meta.languageCounts.desconocido ?? 0
  const pipeline = methodologyPipeline(modelName, meta.embeddingDimension)

  return (
    <section className="methodology-view" aria-label="Metodología del atlas">
      <div className="method-intro">
        <div className="method-lead">
          <span className="eyebrow">Del repositorio a una vista de conjunto</span>
          <h2>{formatNumber(meta.thesisCount)} tesis conectadas por lo que dicen</h2>
          <p>
            Convertimos las fichas públicas del Repositorio Digital CIDE en un atlas para descubrir qué trabajos se
            parecen, cómo cambian los temas y dónde se cruzan programas y profesorado.
          </p>
          <a href="https://repositorio-digital.cide.edu" target="_blank" rel="noreferrer">
            Ver la fuente original
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <small>Último corte: {updatedDate(meta.sourceUpdatedAt)}</small>
        </div>
        <dl className="method-snapshot" aria-label="Cobertura del método">
          <div><dt>Tesis</dt><dd>{formatNumber(meta.thesisCount)}</dd></div>
          <div><dt>Programas</dt><dd>{meta.programCount}</dd></div>
          <div><dt>Temas</dt><dd>{meta.clusterCount}</dd></div>
          <div><dt>Periodo</dt><dd>{meta.yearMin}–{meta.yearMax}</dd></div>
        </dl>
      </div>

      <section className="method-value">
        <div className="method-value-copy">
          <span className="eyebrow">Qué aporta</span>
          <h3>Una forma distinta de leer la producción del CIDE</h3>
          <p>Una lista muestra registros. El atlas deja ver patrones, cambios y conexiones entre ellos.</p>
        </div>
        <div className="method-outcomes">
          {OUTCOMES.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              <h4>{title}</h4>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="method-pipeline-intro">
        <h3>Seis pasos para llegar al Atlas desde el repositorio del CIDE</h3>
        <p>Cada tesis conserva su identificador y vínculo de origen mientras pasa por una cadena común de limpieza, representación semántica, agrupamiento y validación.</p>
      </div>
      <ol className="method-pipeline">
        {pipeline.map(({ icon: Icon, title, copy }, index) => (
          <li key={title}>
            <div className="method-step-index">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="method-reading">
        <section>
          <span className="eyebrow">Qué significa estar cerca</span>
          <h3>Dos puntos cercanos suelen tratar asuntos parecidos</h3>
          <p>
            La distancia resume similitud de contenido en títulos, abstracts y materias. No indica calidad, influencia,
            causalidad ni que una tesis cite a la otra.
          </p>
          <p>
            El mapa 3D puede separar vecindades que se enciman en 2D, pero ambos contienen las mismas tesis y usan
            los mismos grupos temáticos.
          </p>
        </section>
        <section>
          <span className="eyebrow">Qué significa un color</span>
          <h3>Cada color resume un tema, no encierra una tesis</h3>
          <p>
            El nombre de cada comunidad combina palabras frecuentes, trabajos representativos y revisión del
            contenido. Una tesis híbrida puede quedar cerca de más de un tema.
          </p>
          <p>
            En la vista temporal, la posición no cambia: sólo aparecen las tesis disponibles hasta cada año. Así se
            puede comparar el crecimiento sin mover el mapa.
          </p>
        </section>
      </div>

      <div className="method-quality">
        <div>
          <ShieldCheck size={25} strokeWidth={1.6} aria-hidden="true" />
          <span className="eyebrow">Antes de publicar</span>
          <h3>Todo tiene que cuadrar</h3>
        </div>
        <ul>
          <li>Cada tesis aparece una sola vez y mantiene su enlace al repositorio.</li>
          <li>Las {formatNumber(meta.abstractCount)} fichas, equivalentes al {formatPercent(meta.abstractCount / meta.thesisCount)}, incluyen un abstract utilizable.</li>
          <li>Los totales por tema y programa coinciden con la base principal.</li>
          <li>Los nombres homologados pasan por tablas editables y reportes de revisión.</li>
          <li>Los acentos y caracteres especiales llegan completos al sitio.</li>
        </ul>
      </div>

      <div className="method-limits">
        <div>
          <span className="eyebrow">Leer con criterio</span>
          <h3>Lo que el atlas no puede afirmar</h3>
        </div>
        <ul>
          <li>Las distancias y comunidades dependen del modelo y de decisiones analíticas; no son categorías oficiales del CIDE.</li>
          <li>Los temas son una ayuda para explorar; no sustituyen la lectura de cada tesis.</li>
          <li>El último año puede estar incompleto porque el repositorio sigue recibiendo registros.</li>
        </ul>
      </div>

      <details className="method-technical">
        <summary>
          <Braces size={23} strokeWidth={1.6} aria-hidden="true" />
          <span>
            <span className="eyebrow">Para las personas más curiosas</span>
            <strong>Ver ficha técnica ampliada</strong>
            <small>Corpus, modelo, parámetros, criterios de validación y formatos.</small>
          </span>
          <ChevronDown className="method-technical-chevron" size={21} aria-hidden="true" />
        </summary>
        <div className="method-technical-body">
          <section>
            <span className="eyebrow">Diseño del corpus</span>
            <h3>Fuente, unidad de análisis y cobertura</h3>
            <dl>
              <div><dt>Origen</dt><dd>Repositorio Digital CIDE sobre DSpace; cosecha OAI-PMH de la comunidad institucional con paginación mediante <code>resumptionToken</code>.</dd></div>
              <div><dt>Unidad</dt><dd>Una tesis identificada por su <code>item_handle</code>; el enlace al registro original se conserva como referencia primaria.</dd></div>
              <div><dt>Cobertura</dt><dd>{formatNumber(meta.thesisCount)} tesis de {meta.programCount} combinaciones nivel-programa entre {meta.yearMin} y {meta.yearMax}.</dd></div>
              <div><dt>Abstracts</dt><dd>{formatNumber(meta.abstractCount)} registros con abstract utilizable; cobertura de {formatPercent(meta.abstractCount / meta.thesisCount)}.</dd></div>
              <div><dt>Base canónica</dt><dd><code>tesis_cide.parquet</code>, con un registro por tesis y metadatos multivaluados preservados.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Preparación de datos</span>
            <h3>Normalización textual y de identidades</h3>
            <dl>
              <div><dt>Codificación</dt><dd>UTF-8 y normalización Unicode NFC; la exportación rechaza entidades HTML residuales y coordenadas o identificadores faltantes.</dd></div>
              <div><dt>Campos múltiples</dt><dd>Autores, asesores, abstracts y materias se conservan como listas; no se reducen al primer valor disponible.</dd></div>
              <div><dt>Duplicados</dt><dd>El identificador persistente funciona como clave primaria y se valida su unicidad antes del análisis.</dd></div>
              <div><dt>Profesorado</dt><dd>Alias explícitos, claves sin títulos ni puntuación, fusiones canónicas revisadas y reportes conservadores de posibles duplicados.</dd></div>
              <div><dt>Tablas editables</dt><dd><code>asesores_alias.csv</code> y <code>asesores_canonicos_merge.csv</code> separan las decisiones de homologación del código.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Representación semántica</span>
            <h3>Un embedding normalizado por tesis</h3>
            <dl>
              <div><dt>Familia</dt><dd>Sentence-Transformers con arquitectura MPNet multilingüe, usada como modelo de lenguaje especializado en similitud semántica.</dd></div>
              <div><dt>Modelo</dt><dd><code>{meta.embeddingModel}</code></dd></div>
              <div><dt>Entrada</dt><dd>Concatenación de título, abstract y materias después de normalizar espacios; no se incluyen autoría, programa, nivel ni año.</dd></div>
              <div><dt>Dimensión</dt><dd>{formatNumber(meta.embeddingDimension)} componentes de punto flotante por tesis.</dd></div>
              <div><dt>Geometría</dt><dd>Normalización L2 durante la codificación y comparación mediante similitud o distancia coseno.</dd></div>
              <div><dt>Idiomas</dt><dd>{formatNumber(spanishCount)} tesis en español, {formatNumber(englishCount)} en inglés y {formatNumber(unknownLanguageCount)} sin idioma identificado.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Estimación temática</span>
            <h3>Las comunidades se calculan antes del mapa</h3>
            <dl>
              <div><dt>Solución principal</dt><dd><code>{meta.clusterAlgorithm}</code> sobre los embeddings originales, con <code>k={meta.clusterCount}</code>, <code>n_init=60</code> y semilla <code>420</code>.</dd></div>
              <div><dt>Granularidad</dt><dd>Se diagnostican valores pares de <code>k</code> entre 8 y 30; veinte macrotemas se conservan por utilidad interpretativa y cobertura sustantiva.</dd></div>
              <div><dt>Contrastes</dt><dd>K-Means sobre UMAP 2D/3D, spherical K-Means, Ward, NMF, LDA y BERTopic con UMAP 10D, HDBSCAN y c-TF-IDF.</dd></div>
              <div><dt>Consenso</dt><dd>Las coasignaciones entre modelos producen 32 subtemas y membresías top-3 con margen de ambigüedad por tesis.</dd></div>
              <div><dt>Etiquetas</dt><dd>Keywords bilingües homologadas, términos distintivos, tesis representativas y revisión sustantiva de cada comunidad.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Reducción dimensional</span>
            <h3>UMAP organiza la vista, no decide los grupos</h3>
            <dl>
              <div><dt>Parámetros</dt><dd><code>n_neighbors=30</code>, <code>min_dist=0.04</code>, métrica coseno y semilla <code>420</code>.</dd></div>
              <div><dt>Proyecciones</dt><dd>Ajustes independientes de UMAP con 2 y 3 componentes sobre los mismos embeddings normalizados.</dd></div>
              <div><dt>Calidad 2D</dt><dd><em>Trustworthiness</em> = {formatCoefficient(meta.umapTrustworthiness.twoD, 3)} para vecindades de 30 observaciones.</dd></div>
              <div><dt>Calidad 3D</dt><dd><em>Trustworthiness</em> = {formatCoefficient(meta.umapTrustworthiness.threeD, 3)} bajo la misma especificación.</dd></div>
              <div><dt>Lectura</dt><dd>Las distancias son aproximaciones locales; ejes, orientación y escala absoluta no tienen interpretación sustantiva.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Validación y publicación</span>
            <h3>Evaluación multcriterio y trazabilidad</h3>
            <dl>
              <div><dt>Estructura</dt><dd>Silhouette, Davies-Bouldin y Calinski-Harabasz; NMI frente a idioma, programa y nivel para detectar particiones dominadas por metadatos.</dd></div>
              <div><dt>Interpretación</dt><dd>Coherencia <code>c_v</code>, diversidad temática, traslape Jaccard de keywords, balance de tamaños y tasa de outliers.</dd></div>
              <div><dt>Robustez</dt><dd>Estabilidad entre semillas, bootstraps y submuestras; selección de alternativas no dominadas mediante frontera de Pareto.</dd></div>
              <div><dt>Trazabilidad</dt><dd>Embeddings, asignaciones, diagnósticos, taxonomía y agregados se conservan en Parquet con identificadores de tesis.</dd></div>
              <div><dt>Publicación</dt><dd>El extracto web reconcilia identificadores, totales y participaciones; después se ejecutan lint, build y pruebas E2E responsive.</dd></div>
            </dl>
          </section>
        </div>
      </details>
    </section>
  )
}
