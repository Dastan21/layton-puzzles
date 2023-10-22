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
