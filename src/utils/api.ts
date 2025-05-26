import { ndsdb } from './storage.js'

interface FetchFileOptions {
  force?: boolean
  progress: (percent: number) => void
}

export async function fetchFile (filePath: string, options?: FetchFileOptions): Promise<ArrayBuffer | null> {
  let fileBuf: ArrayBuffer | null = await ndsdb.get(filePath)
  if (fileBuf != null && (options?.force == null || !options.force)) return fileBuf

  if (typeof options?.progress === 'function') {
    fileBuf = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.responseType = 'arraybuffer'
      xhr.addEventListener('progress', e => { options.progress(Math.round((e.loaded / e.total) * 100)) })
      xhr.addEventListener('load', () => {
        resolve(xhr.response)
      })
      xhr.addEventListener('error', () => { reject(new Error(`Failed to fetch file: '${filePath}'`)) })
      xhr.addEventListener('abort', () => { reject(new Error(`Failed to fetch file: '${filePath}'`)) })
      xhr.open('GET', filePath)
      xhr.send()
    })
  } else {
    fileBuf = await fetch(filePath).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to fetch file: '${filePath}'`)
      return await res.arrayBuffer()
    })
  }

  if (fileBuf == null) return null
  await ndsdb.set(filePath, new Uint8Array(fileBuf).buffer)
  return fileBuf
}
