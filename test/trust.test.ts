import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import { glob } from 'glob'
import {
    JupyterTrust,
    SignatureStore,
    check,
    create,
    digest,
    filter,
    sign,
    unsign,
} from 'jupyter-trust'
import { generateSecret, parse } from 'jupyter-trust/utils'

import { python } from './utils/python.js'

describe('trust', () => {
    const samples = 'test/samples/'
    const dir = 'test/.tmp/trust/'
    let secret: string

    beforeAll(async () => {
        await rm(dir, { recursive: true, force: true })
        await mkdir(dir, { recursive: true })
        secret = await generateSecret()
        await writeFile(dir + 'notebook_secret', secret)
    })
    it('can sign notebook files', async () => {
        const database = dir + 'sign.db'
        const created = await create({ database, secret, create: true })
        expect(await created.sign(samples + 'sample-0.ipynb')).toBe(true)
        const constructed = new JupyterTrust(database, secret)
        expect(await constructed.sign(samples + 'sample-1.ipynb')).toBe(true)
        expect(await sign(samples + 'sample-2.ipynb', { database, secret })).toBe(true)

        expect(await check(samples + 'sample-0.ipynb', { database, secret })).toBe(true)
        expect(await created.check(samples + 'sample-1.ipynb')).toBe(true)
        await created.close()
        expect(await constructed.check(samples + 'sample-2.ipynb')).toBe(true)
        await constructed.close()
    })
    it('can filter notebook files', async () => {
        const database = dir + 'filter.db'
        const trust = new JupyterTrust(database, secret, 'sha256', { create: true })
        await trust.sign(samples + 'sample-2.ipynb')
        await trust.sign(samples + 'sample-5.ipynb')
        await trust.sign(samples + 'sample-7.ipynb')

        const strings = await filter(await glob('test/samples/*.ipynb', { posix: true }), {
            database,
            secret,
        })
        const objects = await filter(
            await glob('test/samples/*.ipynb', { withFileTypes: true }),
            (path) => path.fullpath(),
            { database, secret },
        )
        expect(strings.length).toBe(3)
        expect(strings.sort()).toStrictEqual([
            'test/samples/sample-2.ipynb',
            'test/samples/sample-5.ipynb',
            'test/samples/sample-7.ipynb',
        ])
        expect(objects.length).toBe(3)
        expect(objects.map((path) => path.name).sort()).toStrictEqual([
            'sample-2.ipynb',
            'sample-5.ipynb',
            'sample-7.ipynb',
        ])
        await trust.close()
    })
    it('can unsign notebook files', async () => {
        const database = dir + 'unsign.db'
        const created = await create({ database, secret, create: true })
        await created.sign(samples + 'sample-0.ipynb')
        await created.sign(samples + 'sample-2.ipynb')
        await created.sign(samples + 'sample-4.ipynb')
        await created.sign(samples + 'sample-6.ipynb')

        const constructed = new JupyterTrust(database, secret)
        expect(await constructed.unsign(samples + 'sample-7.ipynb')).toBe(false)
        expect(await constructed.unsign(samples + 'sample-6.ipynb')).toBe(true)
        expect(await created.check(samples + 'sample-6.ipynb')).toBe(false)
        await constructed.close()

        expect(await unsign(samples + 'sample-2.ipynb', { database, secret })).toBe(true)
        expect(await created.check(samples + 'sample-2.ipynb')).toBe(false)

        expect(await created.unsign(samples + 'sample-0.ipynb')).toBe(true)
        expect(await check(samples + 'sample-0.ipynb', { database, secret })).toBe(false)
        await created.close()
    })
    it('creates database in static methods', async () => {
        const database = dir + 'create.db'
        expect(await check(samples + 'sample-0.ipynb', { database, secret, create: true })).toBe(
            false,
        )
        expect(await sign(samples + 'sample-0.ipynb', { database, secret, create: false })).toBe(
            true,
        )
        expect(await check(samples + 'sample-0.ipynb', { database, secret })).toBe(true)
    })
    it('works with signature store', async () => {
        const database = dir + 'store.db'
        const store = new SignatureStore(database, { create: true })
        await store.ready()
        const trust = new JupyterTrust(database, secret)

        expect(await trust.sign(samples + 'sample-0.ipynb')).toBe(true)
        expect(await trust.sign(samples + 'sample-3.ipynb')).toBe(true)

        const nb0 = parse(await readFile(samples + 'sample-0.ipynb', 'utf8'))
        const signature0 = trust.digest(nb0)
        const nb1 = parse(await readFile(samples + 'sample-1.ipynb', 'utf8'))
        const signature1 = await digest(nb1, { dataDir: dir })
        const nb2 = parse(await readFile(samples + 'sample-2.ipynb', 'utf8'))
        const signature2 = await digest(nb2, { dataDir: dir })
        const nb3 = parse(await readFile(samples + 'sample-3.ipynb', 'utf8'))
        const signature3 = await digest(nb3, { dataDir: dir })

        expect(await store.check(signature0, 'sha256')).toBe(true)
        expect(await store.remove(signature0, 'sha256')).toBe(true)
        expect(await store.store(signature1, 'sha256')).toBe(true)
        expect(await store.store(signature2, 'sha256')).toBe(true)
        expect(await store.store(signature3, 'sha256')).toBe(false)

        expect(await trust.check(samples + 'sample-0.ipynb')).toBe(false)
        expect(await trust.unsign(samples + 'sample-0.ipynb')).toBe(false)
        expect(await trust.unsign(samples + 'sample-2.ipynb')).toBe(true)

        expect(await store.check(signature2, 'sha256')).toBe(false)
        await store.close()

        expect(await trust.check(samples + 'sample-1.ipynb')).toBe(true)
        await trust.close()
    })
    it('works with python nbformat', async () => {
        const trust = new JupyterTrust(dir + 'python.db', secret, 'sha256', { create: true })
        expect(await trust.sign(samples + 'sample-0.ipynb')).toBe(true)
        await python('test/utils/trust.py', dir)
        expect(await trust.check(samples + 'sample-0.ipynb')).toBe(false)
        expect(await trust.check(samples + 'sample-1.ipynb')).toBe(true)
        await trust.close()
    })
    afterAll(async () => {
        await rm(dir, { recursive: true, force: true })
    })
})
