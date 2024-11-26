import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { rm } from 'node:fs/promises'

import { SignatureStore } from 'jupyter-trust'

describe('store', () => {
    const dir = 'test/.tmp/store/'

    beforeAll(async () => {
        await rm(dir, { recursive: true, force: true })
    })
    it('can store signatures', async () => {
        const store = new SignatureStore(dir + 'update.db', { create: true, cacheSize: 8 })
        expect(await store.store('fake9', 'sha1')).toBe(true)
        expect(await store.check('fake9', 'sha1')).toBe(true)
        expect(await store.store('fake9', 'sha1')).toBe(false)
        await store.close()
    })
    it('can remove signatures', async () => {
        const store = new SignatureStore(dir + 'remove.db', { create: true, cacheSize: 8 })
        await store.store('fake7', 'sha256')
        expect(await store.remove('fake7', 'sha256')).toBe(true)
        expect(await store.check('fake7', 'sha256')).toBe(false)
        expect(await store.remove('fake7', 'sha256')).toBe(false)
        await store.close()
    })
    it('can be culled manually with cull: false', async () => {
        const store = new SignatureStore(dir + 'cull.db', {
            create: true,
            cull: false,
            cacheSize: 8,
        })
        for (let i = 0; i < 12; i++) {
            await store.store('fake-signature-' + i, 'sha256')
        }
        expect(await store.count()).toBe(12)
        await store.cull()
        expect(await store.count()).toBe(6)
        await store.close()
    })
    it('culls when cacheSize is reached', async () => {
        const store = new SignatureStore(dir + 'autocull.db', { create: true, cacheSize: 8 })
        for (let i = 0; i < 8; i++) {
            await store.store('fake-signature-' + i, 'sha256')
        }
        expect(await store.count()).toBe(8)
        await store.store('fake-signature', 'sha256')
        expect(await store.count()).toBe(6)
        await store.close()
    })
    it('throws for writes when readonly', async () => {
        const writable = new SignatureStore(dir + 'readonly.db', { create: true })
        await writable.store('signature', 'sha256')
        await writable.close()
        const store = new SignatureStore(dir + 'readonly.db', { readonly: true })
        expect(await store.check('signature', 'sha256')).toBe(true)
        expect(await store.count()).toBe(1)
        await expect(store.store('signature-2', 'sha256')).rejects.toThrowError('store is readonly')
        await expect(store.remove('signature', 'sha256')).rejects.toThrowError('store is readonly')
        await expect(store.cull()).rejects.toThrowError('store is readonly')
        await store.close()
    })
    it('throws for non-existent database without create mode', async () => {
        const uncreated = new SignatureStore(dir + 'fake-0.db')
        await expect(uncreated.ready()).rejects.toThrowError()
        await expect(uncreated.close()).rejects.toThrowError()
    })
    it('throws for non-existent database on operations', async () => {
        const uncreated = new SignatureStore(dir + 'fake-1.db')
        await expect(uncreated.check('signature', 'sha256')).rejects.toThrowError()
    })
    afterAll(async () => {
        await rm(dir, { recursive: true, force: true })
    })
})
