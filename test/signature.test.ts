import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'

import { digest } from 'jupyter-trust'
import { generateSecret, parse } from 'jupyter-trust/utils'

import { generate } from './utils/generate.js'
import { python } from './utils/python.js'

describe('compute signatures', () => {
    const dir = 'test/.tmp/signatures/'
    const result: Record<string, string> = {}
    let secret: string

    beforeAll(async () => {
        await rm(dir, { recursive: true, force: true })
        await mkdir(dir, { recursive: true })

        const samples = await readdir('test/samples/')
        for (const file of samples) {
            if (file.endsWith('.ipynb')) {
                await copyFile('test/samples/' + file, dir + 'test-' + file)
            }
        }

        await generate(20, dir)
        const test0 = `{
            "\\ud83d\\ude0dA": true,
            "0": 9.876543210987654321e10,
            "-1": -12345678901234567890123456789,
            "\\u0000": -12345678901234567890123456789.0,
            "\\ud800\\udfffB": null,
            "": [],
            "metadata": {
                "": -2.5e-6,
                "\\"": 1e16,
                "'": 1e15,
                "\\\\": 1e5,
                "\\\\\\\\": 10000
            },
            "\\uffffC": ${0.3 - 0.2}
        }`
        await writeFile(dir + 'test-0.json', test0)

        secret = await generateSecret()
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

    it('has valid results to check', () => {
        const keys = Object.keys(result)
        expect(keys.length).toBe(29)
        for (const key of keys) {
            expect(key.startsWith('test-')).toBe(true)
            expect(key.endsWith('.json') || key.endsWith('.ipynb')).toBe(true)
            expect(result[key]).toMatch(/^[0-9a-f]{64}$/)
        }
    })

    it('generates matching signatures for all files', async () => {
        for (const name in result) {
            const file = await readFile(dir + name, 'utf8')
            const nb = parse(file)
            const signature = digest(nb, { secret })
            expect(name + ': ' + signature).toBe(name + ': ' + result[name])
        }
    })

    afterAll(async () => {
        await rm(dir, { recursive: true, force: true })
    })
})
