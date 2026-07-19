export type ViewId = 'map' | 'time' | 'programs' | 'topics' | 'faculty' | 'methodology'
export type MapMode = '2d' | '3d'
export type CameraDragMode = 'rotate' | 'pan'

export interface ThesisPoint {
  id: string
  title: string
  author: string
  year: number
  advisor: string | null
  language: string
  level: string
  program: string
  degreeProgram: string
  url: string
  clusterId: number
  clusterTheme: string
  subtopic: string
  secondarySubtopic: string
  membershipMargin: number
  taxonomy: string
  x: number
  y: number
  z: number
}

export interface ThesisDetails {
  abstract: string | null
  subjects: string[]
}

export interface ClusterSummary {
  id: number
  label: string
  theme: string
  count: number
  share: number
  yearMean: number
  yearMin: number
  yearMax: number
  languages: string[]
  levels: string[]
  programCount: number
  topPrograms: string[]
  keywords: string[]
  representativeTheses: string[]
  topAdvisors: string[]
  interdisciplinarity: number
  effectivePrograms: number
  dominantProgram: string
  dominantProgramShare: number
  dominantLevel: string
  dominantLevelShare: number
  centroid: [number, number, number]
}

export interface TimelineDatum {
  year: number
  clusterId: number
  clusterTheme: string
  count: number
  yearTotal: number
  yearShare: number
}

export interface ProgramSummary {
  level: string
  program: string
  degreeProgram: string
  thesisCount: number
  clusterCount: number
  themeEntropy: number
  themeConcentration: number
  mainCluster: string
  mainClusterLabel: string
  mainClusterShare: number
  topThemes: string[]
}

export interface ProgramMatrixDatum {
  clusterId: number
  clusterTheme: string
  level: string
  program: string
  degreeProgram: string
  count: number
  clusterShare: number
  programShare: number
}

export interface ProgramSimilarityDatum {
  programA: string
  programB: string
  similarity: number
  thesisCountA: number
  thesisCountB: number
}

export interface ClusterLevelDatum {
  clusterId: number
  clusterTheme: string
  level: string
  count: number
  clusterTotal: number
  clusterShare: number
}

export interface AdvisorSummary {
  name: string
  thesisCount: number
  clusterCount: number
  mainCluster: string
  mainClusterId: number
  mainClusterShare: number
  yearMin: number
  yearMax: number
  programCount: number
}

export interface AdvisorTopicDatum {
  name: string
  clusterId: number
  clusterTheme: string
  thesisCount: number
  programCount: number
  yearMin: number
  yearMax: number
  advisorTotal: number
  advisorShare: number
}

export interface AtlasMeta {
  source: string
  sourceUpdatedAt: string
  thesisCount: number
  programCount: number
  advisorCount: number
  clusterCount: number
  abstractCount: number
  yearMin: number
  yearMax: number
  embeddingModel: string
  embeddingDimension: number
  clusterAlgorithm: string
  umapTrustworthiness: {
    twoD: number
    threeD: number
  }
  levelCounts: Record<string, number>
  languageCounts: Record<string, number>
  yearTotals: Record<string, number>
}

export interface AtlasPayload {
  points: ThesisPoint[]
}

export interface AnalyticsPayload {
  meta: AtlasMeta
  clusters: ClusterSummary[]
  timeline: TimelineDatum[]
  programs: ProgramSummary[]
  programMatrix: ProgramMatrixDatum[]
  programSimilarity: ProgramSimilarityDatum[]
  clusterLevels: ClusterLevelDatum[]
  advisors: AdvisorSummary[]
  advisorTopics: AdvisorTopicDatum[]
}

export interface DetailsPayload {
  details: Record<string, ThesisDetails>
}

export interface AtlasFilters {
  query: string
  level: string
  program: string
  clusterId: number | null
}
