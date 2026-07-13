import {
  ArrowUpRight,
  Binary,
  Braces,
  Database,
  Languages,
  MapPinned,
  Network,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import type { AtlasMeta } from '../types'
import { formatNumber, updatedDate } from '../lib/format'

interface MethodologyViewProps {
  meta: AtlasMeta
}

const PIPELINE = [
  {
    icon: Database,
    title: 'Fuente y cobertura',
    copy: 'Se cosecha la comunidad completa de tesis del Repositorio Digital del CIDE y se descubren automáticamente sus colecciones de licenciatura, maestría y doctorado.',
  },
  {
    icon: Braces,
    title: 'Metadatos limpios',
    copy: 'Se deduplican registros por identificador, se preservan campos multivaluados y se normaliza todo el texto en Unicode NFC. La exportación se detiene si detecta entidades HTML codificadas.',
  },
  {
    icon: UserRoundCheck,
    title: 'Profesorado homologado',
    copy: 'Los nombres se separan, limpian y resuelven con alias explícitos, claves determinísticas y fusiones canónicas revisadas. Las coincidencias dudosas quedan en reportes de control.',
  },
  {
    icon: Languages,
    title: 'Representación multilingüe',
    copy: 'Títulos y resúmenes se convierten en vectores semánticos con un transformer multilingüe probado para español e inglés; los casos sin resumen conservan el título como señal.',
  },
  {
    icon: Network,
    title: 'Comunidades temáticas',
    copy: 'K-Means opera directamente sobre los embeddings. Se contrastan variantes y modelos de tópicos con coherencia, estabilidad, balance, dependencia del idioma y traslape de palabras clave.',
  },
  {
    icon: MapPinned,
    title: 'Mapa y publicación',
    copy: 'UMAP proyecta el espacio en 2D y 3D para explorarlo. Los resultados canónicos se validan y después se exporta un extracto compacto para esta experiencia web.',
  },
]

export function MethodologyView({ meta }: MethodologyViewProps) {
  const modelName = meta.embeddingModel.split('/').at(-1) ?? meta.embeddingModel

  return (
    <section className="methodology-view" aria-label="Metodología del atlas">
      <div className="method-intro">
        <div className="method-lead">
          <span className="eyebrow">De la ficha al paisaje semántico</span>
          <h2>Una cadena reproducible, con la fuente siempre a la vista</h2>
          <p>
            El atlas no sustituye al catálogo institucional: organiza sus metadatos para descubrir cercanías,
            trayectorias y comunidades que serían difíciles de leer tesis por tesis.
          </p>
          <a href="https://repositorio-digital.cide.edu" target="_blank" rel="noreferrer">
            Consultar el Repositorio Digital CIDE
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <dl className="method-snapshot">
          <div><dt>Registros</dt><dd>{formatNumber(meta.thesisCount)}</dd></div>
          <div><dt>Cobertura</dt><dd>{meta.yearMin}–{meta.yearMax}</dd></div>
          <div><dt>Programas</dt><dd>{meta.programCount}</dd></div>
          <div><dt>Actualización</dt><dd>{updatedDate(meta.sourceUpdatedAt)}</dd></div>
        </dl>
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

      <div className="method-model-band">
        <div>
          <Binary size={22} strokeWidth={1.6} aria-hidden="true" />
          <span>Modelo semántico</span>
          <strong>{modelName}</strong>
        </div>
        <div>
          <Network size={22} strokeWidth={1.6} aria-hidden="true" />
          <span>Asignación principal</span>
          <strong>{meta.clusterCount} comunidades · {meta.clusterAlgorithm}</strong>
        </div>
      </div>

      <div className="method-reading">
        <section>
          <span className="eyebrow">Cómo leer el mapa</span>
          <h3>La distancia es una aproximación, no una medida absoluta</h3>
          <p>
            Puntos cercanos comparten señales semánticas en títulos y resúmenes. UMAP preserva sobre todo vecindades
            locales: la forma global, la orientación y los espacios vacíos pueden cambiar entre proyecciones.
          </p>
          <p>
            El mapa 3D recupera parte de la estructura comprimida en 2D, pero ambos muestran las mismas tesis y las
            mismas comunidades calculadas en el espacio original de embeddings.
          </p>
        </section>
        <section>
          <span className="eyebrow">Cómo leer los temas</span>
          <h3>Las etiquetas resumen comunidades, no clasifican verdades únicas</h3>
          <p>
            Cada nombre combina palabras clave bilingües homologadas, tesis representativas y revisión sustantiva.
            Las membresías secundarias conservan la ambigüedad de trabajos híbridos y alimentan una taxonomía de
            macrotemas y subtemas.
          </p>
          <p>
            La película mantiene fija la posición semántica y revela el año de incorporación. Los periodos sin
            registros se saltan explícitamente para no confundir ausencia documental con inmovilidad temática.
          </p>
        </section>
      </div>

      <div className="method-quality">
        <div>
          <ShieldCheck size={25} strokeWidth={1.6} aria-hidden="true" />
          <span className="eyebrow">Controles antes de publicar</span>
          <h3>El extracto web debe reconciliar con los resultados canónicos</h3>
        </div>
        <ul>
          <li>Identificadores de tesis únicos y coordenadas completas.</li>
          <li>Conteos por comunidad y programa reconciliados.</li>
          <li>Participaciones internas con suma igual a uno.</li>
          <li>Texto UTF-8 normalizado, sin entidades HTML residuales.</li>
        </ul>
      </div>

      <div className="method-limits">
        <span>Límites de interpretación</span>
        <p>
          La cobertura depende de los metadatos disponibles en el repositorio; una ficha sin resumen aporta menos
          contexto. Los clusters son instrumentos exploratorios sensibles a decisiones de modelado y deben leerse
          junto con títulos, resúmenes, programas y años. El último año puede ser parcial.
        </p>
      </div>
    </section>
  )
}
