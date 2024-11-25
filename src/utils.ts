import { generateKey, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export function parse(text: string) {
    const { before, reviver } = makeReviver()
    return JSON.parse(before(text), reviver)
}

function makeReviver() {
    if ('rawJSON' in JSON && typeof JSON.rawJSON === 'function') {
        return {
            before(text: string) {
                return text
            },
            reviver(key: string, value: unknown, context?: { source?: string }) {
                // treat all integers as bigint, all other numbers as float
                // this is to match python's handling of int and float
                if (typeof value === 'number' && typeof context?.source === 'string') {
                    if (/-?\d+/.test(context.source)) {
                        return BigInt(value)
                    }
                }
                return value
            },
        }
    } else {
        const randKey = randomBytes(12).toString('base64url')
        return {
            before(text: string) {
                // match string and number together so that numbers in strings are already part of string match
                return text.replace(/"(?:[^\\"]|\\[\\"/bfnrtu])*"|-?\d+[\deE.+-]*/g, (match) =>
                    // only care about integers, to turn to bigint later
                    /^-?\d+$/.test(match) ? `"<int <${match.trim()}> #${randKey}>"` : match,
                )
            },
            reviver(key: string, value: unknown) {
                if (typeof value === 'string') {
                    const regex = new RegExp(`^<int <(-?\\d+)> #${randKey}>$`)
                    const match = regex.exec(value)
                    if (match) {
                        return BigInt(match[1])
                    }
                }
                return value
            },
        }
    }
}

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
            } else if (str.includes('e')) {
                yield sign + str
            } else if (!str.includes('.')) {
                // python uses scientific notation for numbers from 1e16 and larger
                const match = str.match(/^[1-9]([1-9]*)0*$/)
                if (match) {
                    const d = match[1] ? '.' + match[1] : ''
                    yield sign + str.slice(0, 1) + d + 'e+' + (str.length - 1)
                }
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
                // large number with decimal places not in scientific notation
                // eg 1234567890123456.12345 but float should not have the precision for this
                // this case shouldn't be possible
                // a sufficiently large number will either already be in scientific notation
                // or not have any decimal places
                const i = str.indexOf('.')
                const e = (i > 10 ? 'e+0' : 'e+0') + (i - 1)
                yield sign + str.slice(0, 1) + '.' + str.slice(1, i) + str.slice(i + 1) + e
            }
        } else {
            // treat all numbers as float
            const str = obj.toString()
            if (str.includes('.')) {
                yield str
            } else {
                yield str + '.0'
            }
        }
    } else if (typeof obj === 'bigint') {
        // use bigint to represent python ints
        yield obj.toString()
    }
    // ignore function, symbol, and undefined types as they are not json-able
    // and have no meaningful equivalent string representation to python.
    // while yield_everything in python does stringify functions, it is not deterministic
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
            // create a copy of the original object
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
