import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import sqlite3 from 'sqlite3'

// Portions of this file are adapted from nbformat
// https://github.com/jupyter/nbformat
// Copyright (c) IPython Development Team.
// Distributed under the terms of the Modified BSD License.

export interface SignatureStoreOptions {
    readonly?: boolean
    create?: boolean
    cull?: boolean
    cacheSize?: number
}

export class StoreReadonlyError extends Error {
    constructor() {
        super('store is readonly')
    }
}

export class SignatureStore {
    private readonly db: Promise<sqlite3.Database>
    private readonly options: Readonly<Required<SignatureStoreOptions>>

    constructor(filename: string, options?: SignatureStoreOptions) {
        this.options = {
            readonly: false,
            create: false,
            cull: false,
            cacheSize: 65535,
            ...options,
        }
        let mode = sqlite3.OPEN_READONLY
        if (!this.options.readonly) {
            mode = sqlite3.OPEN_READWRITE
            if (this.options.create) {
                mode |= sqlite3.OPEN_CREATE
            }
        }
        const dir = dirname(filename)
        const pre = !existsSync(dir) ? mkdir(dir, { recursive: true }) : Promise.resolve()
        this.db = pre.then(
            () =>
                new Promise((resolve, reject) => {
                    const db = new sqlite3.Database(filename, mode, (err) => {
                        if (err) {
                            reject(err)
                        } else if (!this.options.readonly) {
                            SignatureStore.init(db).then(() => resolve(db))
                        } else {
                            resolve(db)
                        }
                    })
                }),
        )
    }
    async ready(): Promise<void> {
        await this.db
        return
    }
    async close(): Promise<void> {
        const db = await this.db
        return new Promise<void>((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }
    static async init(db: sqlite3.Database): Promise<boolean> {
        const createdTable = await new Promise<boolean>((resolve, reject) => {
            db.run(
                `CREATE TABLE IF NOT EXISTS nbsignatures
                (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    algorithm text,
                    signature text,
                    path text,
                    last_seen timestamp
                );`,
                function (err) {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(this.changes > 0)
                    }
                },
            )
        })
        const createIndex = await new Promise<boolean>((resolve, reject) => {
            db.run(
                `CREATE INDEX IF NOT EXISTS algosig ON nbsignatures(algorithm, signature);`,
                function (err) {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(this.changes > 0)
                    }
                },
            )
        })
        return createdTable || createIndex
    }
    async check(signature: string, algorithm: string): Promise<boolean> {
        const db = await this.db
        const result = await new Promise<boolean>((resolve, reject) => {
            db.get(
                `SELECT id FROM nbsignatures WHERE
                algorithm = ? AND
                signature = ?;`,
                [algorithm, signature],
                function (err, row) {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(row !== undefined)
                    }
                },
            )
        })
        if (result && !this.options.readonly) {
            await new Promise<boolean>((resolve, reject) => {
                db.run(
                    `UPDATE nbsignatures SET last_seen = ? WHERE
                    algorithm = ? AND
                    signature = ?;`,
                    [timestamp(), algorithm, signature],
                    function (err) {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(this.changes > 0)
                        }
                    },
                )
            })
        }
        return result
    }
    async store(signature: string, algorithm: string): Promise<boolean> {
        if (this.options.readonly) {
            throw new StoreReadonlyError()
        }
        const db = await this.db
        const exists = await this.check(signature, algorithm)
        let stored = false
        if (!exists) {
            stored = await new Promise<boolean>((resolve, reject) => {
                db.run(
                    `INSERT INTO nbsignatures (algorithm, signature, last_seen)
                    VALUES (?, ?, ?);`,
                    [algorithm, signature, timestamp()],
                    function (err) {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(this.changes > 0)
                        }
                    },
                )
            })
        }
        if ((await this.count()) > this.options.cacheSize) {
            await this.cull()
        }
        return stored
    }
    async remove(signature: string, algorithm: string): Promise<boolean> {
        if (this.options.readonly) {
            throw new StoreReadonlyError()
        }
        const db = await this.db
        return new Promise<boolean>((resolve, reject) => {
            db.run(
                `DELETE FROM nbsignatures WHERE
                algorithm = ? AND
                signature = ?;`,
                [algorithm, signature],
                function (err) {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(this.changes > 0)
                    }
                },
            )
        })
    }
    async cull(): Promise<boolean> {
        if (this.options.readonly) {
            throw new StoreReadonlyError()
        }
        const db = await this.db
        return new Promise<boolean>((resolve, reject) => {
            const limit = Math.max(Math.floor(this.options.cacheSize * 0.75), 1)
            db.run(
                `DELETE FROM nbsignatures WHERE id IN (
                    SELECT id FROM nbsignatures ORDER BY last_seen DESC LIMIT -1 OFFSET ?
                );`,
                [limit],
                function (err) {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(this.changes > 0)
                    }
                },
            )
        })
    }
    async count(): Promise<number> {
        const db = await this.db
        return new Promise<number>((resolve, reject) => {
            db.get(`SELECT Count(*) AS count FROM nbsignatures`, function (err, row) {
                if (err) {
                    reject(err)
                } else if (row && typeof row === 'object' && 'count' in row) {
                    const count = typeof row.count === 'number' ? row.count : 0
                    resolve(count)
                } else {
                    resolve(0)
                }
            })
        })
    }
}

function timestamp(date?: Date): string {
    return (date ?? new Date()).toISOString().replace('T', ' ').replace('Z', '')
}
