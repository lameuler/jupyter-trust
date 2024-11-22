import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { SignatureStore, SignatureStoreOptions } from './store.js'
import { defaultDataDir, defaultSecret, omitSignature, serialize } from './utils.js'

export interface JupyterTrustOptions extends SignatureStoreOptions {
    dataDir?: string
    database?: string
    secret?: string
    algorithm?: string
}

export class JupyterTrust {
    readonly store: SignatureStore
    readonly algorithm: string
    readonly secret: string

    constructor(
        database: string,
        secret: string,
        algorithm = 'sha256',
        options?: SignatureStoreOptions,
    ) {
        this.store = new SignatureStore(database, options)
        this.secret = secret
        this.algorithm = algorithm
    }

    static async create(options: JupyterTrustOptions = {}): Promise<JupyterTrust> {
        const { dataDir, database, secret, algorithm, ...rest } = options
        const dir = dataDir ?? defaultDataDir()
        const _database = database ?? resolve(dir, 'nbsignatures.db')
        const _secret = secret ?? await defaultSecret(dir)
        return new JupyterTrust(_database, _secret, algorithm, rest)
    }

    async close() {
        await this.store.close()
    }

    static digest(nb: unknown, options?: JupyterTrustOptions & { secret: undefined }): Promise<string>
    static digest(nb: unknown, options?: JupyterTrustOptions & { secret: string }): string
    static digest(nb: unknown, options?: JupyterTrustOptions): string | Promise<string> {
        if (options?.secret === undefined) {
            return defaultSecret(options?.dataDir).then((secret) => JupyterTrust.digest(nb, { ...options, secret }))
        }
        const hmac = createHmac(options.algorithm ?? 'sha256', options.secret)
        // TODO check if nbformat only removes notebook signature and not from cells
        for (const data of serialize(omitSignature(nb))) {
            hmac.update(data)
        }
        return hmac.digest('hex')
    }
    digest(nb: unknown): string {
        return JupyterTrust.digest(nb, { secret: this.secret, algorithm: this.algorithm })
    }

    async check(notebook: string | object): Promise<boolean> {
        const nb = await getNotebook(notebook)
        if (nb === null) {
            return false
        }
        const signature = this.digest(notebook)
        return await this.store.check(signature, this.algorithm)
    }
    static async check(notebook: string | object, options?: JupyterTrustOptions): Promise<boolean> {
        const instance = await JupyterTrust.create(options)
        const result = await instance.check(notebook)
        instance.close()
        return result
    }

    async sign(notebook: string | object): Promise<boolean> {
        const nb = await getNotebook(notebook)
        if (nb === null) {
            return false
        }
        const signature = this.digest(nb)
        return await this.store.store(signature, this.algorithm)
    }
    static async sign(notebook: string | object, options?: JupyterTrustOptions): Promise<boolean> {
        const instance = await JupyterTrust.create(options)
        const result = await instance.sign(notebook)
        instance.close()
        return result
    }

    async unsign(notebook: string | object): Promise<boolean> {
        const nb = await getNotebook(notebook)
        if (nb === null) {
            return false
        }
        const signature = this.digest(nb)
        return await this.store.remove(signature, this.algorithm)
    }
    static async unsign(notebook: string | object, options?: JupyterTrustOptions): Promise<boolean> {
        const instance = await JupyterTrust.create(options)
        const result = await instance.unsign(notebook)
        instance.close()
        return result
    }

    async #filter<T>(objs: T[], accessor?: FilterAccessor<T>): Promise<T[]> {
        const result: T[] = []
        await Promise.all(
            objs.map(async (obj) => {
                const notebook = typeof accessor === 'function' ? await accessor(obj) : obj
                if (notebook && (typeof notebook === 'string' || typeof notebook === 'object')) {
                    if (await this.check(notebook)) {
                        result.push(obj)
                    }
                }
            }),
        )
        return result
    }
    async filter<T extends string | object>(notebooks: T[]): Promise<T[]>
    async filter<T>(objs: T[], accessor: FilterAccessor<T>): Promise<T[]>
    async filter<T>(objs: T[], accessor?: FilterAccessor<T>): Promise<T[]> {
        return this.#filter(objs, accessor)
    }
    static async filter<T extends string | object>(notebooks: T[], options?: JupyterTrustOptions): Promise<T[]>
    static async filter<T>(objs: T[], accessor: FilterAccessor<T>, options?: JupyterTrustOptions): Promise<T[]>
    static async filter<T>(objs: T[], p2?: FilterAccessor<T> | JupyterTrustOptions, p3?: JupyterTrustOptions): Promise<T[]> {
        const options = typeof p2 === 'function' ? p3 : p2
        const accessor = typeof p2 === 'function' ? p2 : undefined
        const instance = await JupyterTrust.create(options)
        const result = instance.#filter(objs, accessor)
        instance.close()
        return result
    }
}

export type FilterAccessor<T> = (obj: T) => string | object | Promise<string | object>

async function getNotebook(nb: string | object) {
    if (typeof nb === 'string') {
        nb = JSON.parse(await readFile(nb, 'utf8'))
    }
    if (!nb || typeof nb !== 'object') {
        return null
    }
    if ('nbformat' in nb && typeof nb.nbformat === 'number') {
        if (nb.nbformat >= 3) {
            return nb
        }
    }
    return null
}
