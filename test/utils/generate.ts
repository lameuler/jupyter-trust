import { randomBytes, randomInt } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DEPTH = 12
const LIMIT = 256

export function randomObject(depth = DEPTH, limit = LIMIT, meta = true) {
    const obj: Record<string | number, unknown> = {}
    for (let i = 0; i < randomInt(Math.max(1, Math.min(32, limit))); i++) {
        const key = randomInt(3) > 0 ? randomBytes(randomInt(64)).toString('utf8') : randomNumber()
        const value = randomAny(depth - 1, --limit)
        obj[key] = value
    }
    if (meta) {
        obj.metadata = {
            signature: randomInt(2) ? randomAny(Math.min(2, depth), --limit, false) : undefined,
            ...randomObject(Math.min(3, depth), --limit, false),
        }
    }
    return obj
}

export function randomArray(depth = DEPTH, limit = LIMIT, meta = true) {
    const arr: unknown[] = []
    for (let i = 0; i < randomInt(Math.max(1, Math.min(32, limit))); i++) {
        arr.push(randomAny(depth - 1, --limit, meta))
    }
    return arr
}

function randomNumber() {
    const n = (Math.random() - 0.5) * 10 ** randomInt(-10, 30)
    return Math.abs(n) > 100 && randomInt(2) ? Math.round(n) : n
}

export function randomAny(depth = DEPTH, limit = LIMIT, meta = true) {
    const min = depth <= 0 ? 2 : 0
    if (limit <= 0) {
        return undefined
    }
    switch (randomInt(min, 6)) {
        case 0:
            return randomObject(depth - 1, --limit, meta)
        case 1:
            return randomArray(depth - 1, --limit, meta)
        case 2:
            return randomNumber()
        case 3:
            return randomBytes(randomInt(256)).toString('utf8')
        case 4:
            return randomInt(2) === 0
        case 5:
            return null
    }
    return undefined
}

export async function generate(n = 10, dir = 'test/.cache/signatures') {
    const promises: Promise<void>[] = []
    for (let i = 0; i < n; i++) {
        const obj = randomObject()
        obj.nbformat = 4
        obj.nbformat_minor = randomInt(6)
        promises.push(
            writeFile(resolve(dir, `test-random${i}.json`), JSON.stringify(obj, undefined, 4)),
        )
    }
    await Promise.all(promises)
}
