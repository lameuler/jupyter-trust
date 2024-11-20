import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export function* serialize(obj: unknown): Generator<string> {
    if (typeof obj === 'string') {
        yield obj
    } else if (Array.isArray(obj)) {
        for (const o of obj) {
            yield* serialize(o)
        }
    } else if (obj === null) {
        yield 'None'
    } else if (typeof obj === 'object') {
        const entries = Object.entries(obj)
        entries.sort()
        for (const [k, v] of entries) {
            if (v !== undefined) {
                yield k
                yield* serialize(v)
            }
        }
    } else if (obj !== undefined) {
        yield String(obj)
    }
}

export function omitSignature(obj: unknown) {
    if (!obj || typeof obj !== 'object') {
        return obj
    }
    if ('metadata' in obj && typeof obj.metadata === 'object') {
        const { metadata, ...rest } = obj
        if (metadata && 'signature' in metadata) {
            const { signature, ...meta } = metadata
            void signature
            return {
                metadata: meta,
                ...rest,
            }
        }
    }
    return obj
}

export function generateSecret() {
    return randomBytes(1024).toString('base64')
}

let secret: string | undefined = undefined

export async function defaultSecret(dataDir?: string, refresh?: boolean): Promise<string> {
    if (dataDir) {
        return await readFile(resolve(dataDir, 'notebook_secret'), 'utf8')
    } else if (refresh || !secret) {
        secret = await readFile(resolve(defaultDataDir(), 'notebook_secret'), 'utf8')
    }
    return secret
}

export function defaultDataDir(): string {
    const env = process.env['JUPYTER_DATA_DIR']
    if (typeof env === 'string') {
        return env
    } else {
        if (process.platform === 'darwin') {
            return resolve(homedir(), 'Library', 'Jupyter')
        } else if (process.platform === 'win32') {
            if (process.env.APPDATA) {
                return resolve(process.env.APPDATA, 'jupyter')
            } else {
                return resolve(homedir(), '.jupyter', 'data')
            }
        } else {
            const base = process.env.XDG_DATA_HOME ?? resolve(homedir(), '.local', 'share')
            return resolve(base, 'jupyter')
        }
    }
}
