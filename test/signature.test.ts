import { describe, test, expect, beforeAll, afterAll } from 'vitest'

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import { digest } from 'jupyter-trust'
import { generateSecret } from 'jupyter-trust/utils'

import { generate } from './utils/generate.js'
import { python } from './utils/python.js'

describe('compute signatures', () => {
    const dir = 'test/.tmp/signatures/'
    const result: Record<string, string> = {}
    const secret = generateSecret()

    beforeAll(async () => {
        await rm(dir, { recursive: true, force: true })
        await mkdir(dir, { recursive: true })

        await generate(20, dir)
        const test0 = JSON.stringify({
            '\ud83d\ude0dA': true,
            0: Math.sqrt(2) * 10 ** 16 + Math.sqrt(2),
            [-1]: -1234e16,
            '\ud800\udfffB': null,
            '': [],
            metadata: { [-2.5e-7]: -2.5e-6 },
            '\uffffC': 0.3 - 0.2,
        })
        await writeFile(dir + 'test-0.json', test0)

        await writeFile(dir + 'notebook_secret', secret)
    })

    beforeAll(async () => {
        await python('test/utils/sign.py', dir)

        const raw = JSON.parse(await readFile(dir + 'results.json', 'utf8'))
        if (typeof raw === 'object') {
            for (const name in raw) {
                if (typeof raw[name] === 'string') {
                    result[name] = raw[name]
                }
            }
        }
    })

    test('has valid results to check', () => {
        const keys = Object.keys(result)
        expect(keys.length).toBe(21)
        for (const key of keys) {
            expect(key.startsWith('test-')).toBe(true)
            expect(key.endsWith('.json')).toBe(true)
            expect(result[key]).toMatch(/^[0-9a-f]{64}$/)
        }
    })

    test('all signatures match', async () => {
        for (const name in result) {
            const file = await readFile(dir + name, 'utf8')
            const nb = JSON.parse(file)
            const signature = digest(nb, { secret })
            expect(name + ': ' + signature).toBe(name + ': ' + result[name])
        }
    })

    afterAll(async () => {
        rm(dir, { recursive: true, force: true })
    })
})
