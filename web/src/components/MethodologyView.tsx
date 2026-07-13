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
import { formatNumber, updatedDate } from '../lib/format'

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

const PIPELINE = [
  {
    icon: Database,
    title: 'Reunimos todas las tesis',
    copy: 'Leemos las fichas públicas del Repositorio Digital CIDE e incluimos licenciaturas, maestrías y doctorados en una sola colección.',
  },
  {
    icon: Braces,
    title: 'Ponemos orden en los datos',
    copy: 'Quitamos duplicados, conservamos autores y temas múltiples, corregimos texto codificado y cuidamos acentos, eñes y caracteres especiales.',
  },
  {
    icon: UserRoundCheck,
    title: 'Unimos variantes del mismo nombre',
    copy: 'Tratamos títulos, abreviaturas y formas distintas de escribir al profesorado para que una misma persona no aparezca varias veces.',
  },
  {
    icon: Languages,
    title: 'Comparamos de qué habla cada tesis',
    copy: 'Un modelo multilingüe lee títulos y resúmenes en español e inglés y convierte su significado en coordenadas comparables.',
  },
  {
    icon: Network,
    title: 'Formamos comunidades temáticas',
    copy: 'Agrupamos las tesis más cercanas y contrastamos varias soluciones antes de elegir veinte temas que sean útiles para explorar.',
  },
  {
    icon: MapPinned,
    title: 'Convertimos el resultado en un atlas',
    copy: 'Proyectamos las relaciones en 2D y 3D, sumamos tiempo, programas y profesorado, y comprobamos los totales antes de publicar.',
  },
]

export function MethodologyView({ meta }: MethodologyViewProps) {
  const modelName = meta.embeddingModel.split('/').at(-1) ?? meta.embeddingModel
  const spanishCount = meta.languageCounts.spa ?? 0
  const englishCount = meta.languageCounts.eng ?? 0

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
        <span className="eyebrow">El proceso, sin jerga</span>
        <h3>Seis pasos del repositorio al mapa</h3>
        <p>Cada punto conserva un vínculo con su ficha original y pasa por la misma cadena de limpieza y análisis.</p>
      </div>
      <ol className="method-pipeline">
        {PIPELINE.map(({ icon: Icon, title, copy }, index) => (
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
            La distancia resume similitud de contenido en títulos y resúmenes. No indica calidad, influencia,
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
          <li>Una ficha sin resumen aporta menos contexto que una ficha completa.</li>
          <li>Los temas son una ayuda para explorar; no sustituyen la lectura de cada tesis.</li>
          <li>El último año puede estar incompleto porque el repositorio sigue recibiendo registros.</li>
        </ul>
      </div>

      <details className="method-technical">
        <summary>
          <Braces size={23} strokeWidth={1.6} aria-hidden="true" />
          <span>
            <span className="eyebrow">Para quien quiera auditarlo</span>
            <strong>Ver ficha técnica y reproducibilidad</strong>
            <small>Modelo, parámetros, validaciones, formatos y comandos.</small>
          </span>
          <ChevronDown className="method-technical-chevron" size={21} aria-hidden="true" />
        </summary>
        <div className="method-technical-body">
          <section>
            <span className="eyebrow">Datos</span>
            <h3>Extracción y limpieza</h3>
            <dl>
              <div><dt>Origen</dt><dd>Repositorio Digital CIDE, cosechado por OAI-PMH con paginación por <code>resumptionToken</code>.</dd></div>
              <div><dt>Base canónica</dt><dd><code>tesis_cide.parquet</code>, con identificadores únicos y campos multivaluados preservados.</dd></div>
              <div><dt>Texto</dt><dd>Unicode NFC, UTF-8 y una validación que rechaza entidades HTML residuales.</dd></div>
              <div><dt>Profesorado</dt><dd>Alias explícitos, claves normalizadas, fusiones revisadas y reportes de posibles duplicados.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Representación semántica</span>
            <h3>Un vector por tesis</h3>
            <dl>
              <div><dt>Transformer</dt><dd><code>{modelName}</code></dd></div>
              <div><dt>Entrada</dt><dd>Título y resumen; cuando no hay resumen, el título conserva la señal disponible.</dd></div>
              <div><dt>Comparación</dt><dd>Embeddings normalizados y distancia coseno.</dd></div>
              <div><dt>Idiomas</dt><dd>{formatNumber(spanishCount)} registros en español y {formatNumber(englishCount)} en inglés.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Comunidades y mapa</span>
            <h3>El agrupamiento no depende del dibujo</h3>
            <dl>
              <div><dt>Solución principal</dt><dd><code>{meta.clusterAlgorithm}</code>, <code>k={meta.clusterCount}</code>, <code>n_init=60</code> y semilla <code>420</code>.</dd></div>
              <div><dt>Proyección</dt><dd>UMAP 2D y 3D con <code>n_neighbors=30</code>, <code>min_dist=0.04</code> y métrica coseno.</dd></div>
              <div><dt>Contrastes</dt><dd>K-Means sobre UMAP, spherical K-Means, Ward, NMF, LDA, BERTopic/HDBSCAN y consenso entre modelos.</dd></div>
              <div><dt>Etiquetas</dt><dd>Palabras clave bilingües homologadas y tesis representativas por comunidad.</dd></div>
            </dl>
          </section>

          <section>
            <span className="eyebrow">Validación y entrega</span>
            <h3>Varias pruebas, no una sola puntuación</h3>
            <dl>
              <div><dt>Estructura</dt><dd>Silhouette, Davies-Bouldin, Calinski-Harabasz y dependencia respecto del idioma.</dd></div>
              <div><dt>Interpretación</dt><dd>Coherencia <code>c_v</code>, diversidad, traslape Jaccard de palabras clave y estabilidad por semillas y submuestras.</dd></div>
              <div><dt>Mapa</dt><dd><em>Trustworthiness</em> para revisar cuánto conservan UMAP 2D y 3D las vecindades originales.</dd></div>
              <div><dt>Publicación</dt><dd>Los Parquet alimentan un extracto web que reconcilia identificadores, conteos y participaciones antes del build.</dd></div>
            </dl>
          </section>

          <div className="method-command" aria-label="Secuencia reproducible">
            <span>Secuencia reproducible</span>
            <code>make scrape</code>
            <code>make clusters</code>
            <code>make web-data</code>
            <code>make web-check</code>
          </div>
        </div>
      </details>
    </section>
  )
}
