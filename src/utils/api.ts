import { ndsdb } from './storage.js'

interface FetchFileOptions {
  force?: boolean
}

export async function fetchFile (filePath: string, options?: FetchFileOptions): Promise<ArrayBuffer | null> {
  const fileBuf = await ndsdb.get(filePath)
  if (fileBuf != null && (options?.force == null || !options.force)) return fileBuf
  return await fetch(filePath).then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch file: '${filePath}'`)
    const buf = await res.arrayBuffer()
    await ndsdb.set(filePath, new Uint8Array(buf))
    return buf
  })
}

export function download (data: ArrayBuffer | string, fileName: string): void {
  let url = String(data)
  if (typeof data !== 'string') {
    const blob = new Blob([data])
    url = URL.createObjectURL(blob)
  }
  const $a = document.createElement('a')
  $a.href = url
  $a.download = fileName
  $a.click()
  URL.revokeObjectURL(url)
}
