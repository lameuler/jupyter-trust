import { generateKey } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

// this needs to exactly match the behaviour of yield_everything in nbformat.sign
export function* serialize(obj: unknown): Generator<string> {
    if (typeof obj === 'string') {
        yield obj
    } else if (Array.isArray(obj)) {
        for (const o of obj) {
            yield* serialize(o)
        }
    } else if (obj === true) {
        // use python literals for true, false, and null
        yield 'True'
    } else if (obj === false) {
        yield 'False'
    } else if (obj === null) {
        yield 'None'
    } else if (typeof obj === 'object') {
        const entries = Object.entries(obj)
        entries.sort(([s1], [s2]) => compareString(s1, s2))
        for (const [k, v] of entries) {
            if (v !== undefined) {
                yield k
                yield* serialize(v)
            }
        }
    } else if (typeof obj === 'number') {
        // match python scientific notation
        if (Math.abs(obj) < 1e-4 || Math.abs(obj) >= 1e16) {
            const str = Math.abs(obj).toString()
            const sign = obj < 0 ? '-' : ''
            if (/e[+-]\d$/.test(str)) {
                // zero pad the exponent if it is only 1 digit
                yield sign + str.slice(0, -1) + '0' + str.slice(-1)
            } else if (str.includes('e') || !str.includes('.')) {
                yield sign + str
            } else if (str.startsWith('0.')) {
                // python uses scientific notation for numbers smaller than 1e-4
                // while javascript only does for numbers smaller than 1e-6
                // eg 0.000025392 in javascript -> 2.5392e-5 in python
                const match = str.match(/[1-9]/)
                if (match?.index) {
                    const i = match.index
                    const e = (i > 10 ? 'e-' : 'e-0') + (i - 1)
                    yield sign + str.slice(i, i + 1) + '.' + str.slice(i + 1) + e
                } else {
                    yield '0.0'
                }
            } else {
                // this case shouldn't be possible
                // a sufficiently large number will either already be in scientific notation
                // or not have any decimal places
                const i = str.indexOf('.')
                const e = (i > 10 ? 'e+0' : 'e+0') + (i - 1)
                yield sign + str.slice(0, 1) + '.' + str.slice(1, i) + str.slice(i + 1) + e
            }
        } else {
            yield obj.toString()
        }
    } else if (obj !== undefined) {
        yield String(obj)
    }
}

function compareString(s1: string, s2: string) {
    let i1 = 0,
        i2 = 0
    while (i1 < s1.length || i2 < s2.length) {
        // compare using unicode code points instead of char code
        // to match the behaviour of sorting strings in python
        // eg '\uD83D\uDE0E' (U+1F60E 😎) vs '\uFFFD' (U+FFFD �)
        // python: U+FFFD < U+1F60E
        // javascript: \uFFFD > \uD83D
        const c1 = s1.codePointAt(i1) ?? -1
        const c2 = s2.codePointAt(i2) ?? -1
        if (c1 < c2) {
            return -1
        } else if (c1 > c2) {
            return 1
        }
        // skip the trailing surrogate
        if (c1 >= 0x10000) {
            i1++
        }
        if (c2 >= 0x10000) {
            i2++
        }
        i1++
        i2++
    }
    return 0
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

export async function generateSecret(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        generateKey('hmac', { length: 1024 * 8 }, (err, key) => {
            if (err) {
                reject(err)
            } else {
                resolve(key.export().toString('base64'))
            }
        })
    })
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
