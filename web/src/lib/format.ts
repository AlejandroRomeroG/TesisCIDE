const numberFormatter = new Intl.NumberFormat('es-MX')
const decimalFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value)
}

export function formatCoefficient(value: number, digits = 3): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function languageLabel(value: string): string {
  const labels: Record<string, string> = {
    spa: 'Español',
    eng: 'Inglés',
    es: 'Español',
    en: 'Inglés',
  }
  return labels[value.toLowerCase()] ?? value.toUpperCase()
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function searchTerms(value: string): string[] {
  const normalized = normalizeSearch(value)
  return normalized ? normalized.split(' ') : []
}

export function includesAllSearchTerms(value: string, terms: readonly string[]): boolean {
  const valueTerms = searchTerms(value)
  return terms.every((term) => valueTerms.some((valueTerm) => valueTerm.startsWith(term)))
}

export function includesAllSearchTermsInAnyValue(value: string, terms: readonly string[]): boolean {
  return value
    .split(/\s*\|\s*/)
    .some((part) => includesAllSearchTerms(part, terms))
}

export function shortProgram(value: string): string {
  return value.replace(/^(Licenciatura|Maestría|Doctorado) en /, '')
}

export function updatedDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
