import type { SortsCollection } from './sortTypes'

const MAX_URL_SORTS_BYTES = 12000

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSortsToUrl(collection: SortsCollection): string | null {
  try {
    const payload = JSON.stringify({
      v: collection.version,
      a: collection.activeSortId,
      f: collection.farm,
      s: collection.sorts,
    })
    if (payload.length > MAX_URL_SORTS_BYTES) return null
    return toBase64Url(payload)
  } catch {
    return null
  }
}

export function decodeSortsFromUrl(encoded: string): SortsCollection | null {
  try {
    const json = fromBase64Url(encoded)
    const parsed = JSON.parse(json) as Record<string, unknown>
    if (!parsed.f || !parsed.s || !parsed.a) return null
    return {
      version: typeof parsed.v === 'number' ? parsed.v : 1,
      activeSortId: String(parsed.a),
      farm: parsed.f as SortsCollection['farm'],
      sorts: parsed.s as SortsCollection['sorts'],
    }
  } catch {
    return null
  }
}

export function exportSortsJson(collection: SortsCollection): string {
  return JSON.stringify(collection, null, 2)
}

export function importSortsJson(text: string): SortsCollection | null {
  try {
    const parsed = JSON.parse(text) as Partial<SortsCollection>
    if (!parsed.farm || !Array.isArray(parsed.sorts) || !parsed.activeSortId) return null
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      activeSortId: String(parsed.activeSortId),
      farm: parsed.farm,
      sorts: parsed.sorts,
    }
  } catch {
    return null
  }
}
