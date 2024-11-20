import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { glob, GlobOptions } from 'glob'

import { SignatureStore, SignatureStoreOptions } from './store.js'
import { defaultDataDir, defaultSecret, omitSignature, serialize } from './utils.js'

export class JupyterTrust {
    readonly store: SignatureStore
    readonly algorithm: string
    readonly secret: string

    constructor(database: string, secret: string, algorithm = 'sha256', options?: SignatureStoreOptions) {
        this.store = new SignatureStore(database, options)
        this.secret = secret
        this.algorithm = algorithm
    }

    static async create(dataDir?: string, algorithm?: string): Promise<JupyterTrust> {
        const dir = dataDir ?? defaultDataDir()
        const database = resolve(dir, 'nbsignatures.db')
        const secret = await defaultSecret(dataDir)
        return new JupyterTrust(database, secret, algorithm)
    }

    async close() {
        await this.store.close()
    }

    static digest(nb: unknown, secret?: undefined, algorithm?: string): Promise<string>
    static digest(nb: unknown, secret: string, algorithm?: string): string
    static digest(nb: unknown, secret?: string, algorithm = 'sha256'): string | Promise<string> {
        if (secret === undefined) {
            return defaultSecret().then((s) => JupyterTrust.digest(nb, s, algorithm))
        }
        const hmac = createHmac(algorithm, secret)
        // TODO check if nbformat only removes notebook signature and not from cells
        for (const data of serialize(omitSignature(nb))) {
            hmac.update(data)
        }
        return hmac.digest('hex')
    }
    digest(nb: unknown): string {
        return JupyterTrust.digest(nb, this.secret, this.algorithm)
    }

    async check(notebook: string | object): Promise<boolean> {
        const nb = await getNotebook(notebook)
        if (nb === null) {
            return false
        }
        const signature = this.digest(notebook)
        return await this.store.check(signature, this.algorithm)
    }
    static async check(notebook: string | object): Promise<boolean> {
        const instance = await JupyterTrust.create()
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
    static async sign(notebook: string | object): Promise<boolean> {
        const instance = await JupyterTrust.create()
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
    static async unsign(notebook: string | object): Promise<boolean> {
        const instance = await JupyterTrust.create()
        const result = await instance.unsign(notebook)
        instance.close()
        return result
    }

    async glob(pattern: string | string[], options?: GlobOptions): Promise<string[]> {
        const paths = await glob(pattern, options ?? {})
        const strPaths = paths.map((path) => (typeof path === 'string' ? path : path.fullpath()))
        const results: string[] = []
        await Promise.all(
            strPaths.map((path) =>
                this.check(path).then((trusted) => {
                    if (trusted) {
                        results.push(path)
                    }
                }),
            ),
        )
        return results
    }
    static async glob(pattern: string | string[], options?: GlobOptions): Promise<string[]> {
        const instance = await JupyterTrust.create()
        const result = await instance.glob(pattern, options)
        instance.close()
        return result
    }
}

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
