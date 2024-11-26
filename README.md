# `jupyter-trust`

[![CI](https://github.com/lameuler/jupyter-trust/actions/workflows/ci.yml/badge.svg)](https://github.com/lameuler/jupyter-trust/actions/workflows/ci.yml)

<!---
[![npm version](https://img.shields.io/npm/v/{PACKAGE})](https://www.npmjs.com/package/{PACKAGE})
-->

A utility for managing Jupyter Notebook trust in Node.js.

This package is available as both a CommonJS and ESM module.

## Basic Example

```ts
import { JupyterTrust, create, check, sign, unsign } from 'jupyter-trust'

// using an instance
const trust = new JupyterTrust(database, secret)
const trust = await create() // or JupyterTrust.create(...)

await trust.sign('path/to/notebook.ipynb')
await trust.check(parsedNotebookObject)

// using the static methods
await sign('path/to/notebook.ipynb') // or JupyterTrust.sign(...)
await check(parseNotebookObject)
await unsign(parseNotebookObject)
await check('path/to/notebook.ipynb')
```

## Reference

**Exports**

`jupyter-trust`

-   [`JupyterTrust`](#jupytertrust)
-   [`create()`](#create)
-   [`check()`](#check)
-   [`filter()`](#filter)
-   [`sign()`](#sign)
-   [`unsign()`](#unsign)
-   [`digest()`](#digest)
-   [`JupyterTrustOptions`](#jupytertrustoptions)
-   [`SignatureStore`](#signaturestore)
-   [`SignatureStoreOptions`](#signaturestoreoptions)

`jupyter-trust/utils`

-   [`parse()`](#parse)
-   [`serialize()`](#serialize)
-   [`omitSignature()`](#omitSignature)
-   [`generateSecret()`](#generatesecret)
-   [`defaultDataDir()`](#defaultdatadir)
-   [`defaultSecret()`](#defaultsecret)

---

### `JupyterTrust`

The `JupyterTrust` class is used to manage the trust and signing of notebooks.

There are static methods on the class which can be used to create a temporary instance of `JupyterTrust` and run the corresponding method. If you are handling multiple operations, it is better to create an instance either with the constructor or the [`create`](#create) method. All the static methods are also exported as named exports of `jupyter-trust`.

By default, all methods use your user level Jupyter trust database which is used by other apps like Jupyter Notebook and Jupyter Lab to store the trust of notebooks.

> [!IMPORTANT]
> For all methods which take in notebook data, note that all `number`s are treated like python `float`s, while `bigint` is treated like python's `int`. if you are parsing a notebook, you will need to parse all integers to [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt), which you can do with the [`parse()`](#parse) utility. This affects how the numbers are [serialized](#serialize) and therefore its signature.

```ts
class JupyterTrust {
    constructor(database: string, secret: string, algorithm?: string, opts?: SignatureStoreOptions)
}
```

Refer to [`JupyterTrustOptions`](#jupytertrustoptions) and [`SignatureStoreOptions`](#signaturestoreoptions) for more details on the parameters of the constructor.

---

### `create`

```ts
static create(opts?: JupyterTrustOptions): Promise<JupyterTrust>
```

Convenience method to create a `JupyterTrust` instance, including using and loading all defaults. See [`JupyterTrustOptions`](#jupytertrustoptions) for more information.

---

### `check`

```ts
check(notebook: string | object): Promise<boolean>
static check(notebook: string | object, opts?: JupyterTrustOptions): Promise<boolean>
```

Checks if a notebook is trusted. Accepts either the path to the ipynb file or the notebook data.

This will also update the last seen timestamp of the signature (unless the store is [readonly](#signaturestoreoptions)).

Returns true if notebook is trusted, or false if it is not signed.

---

### `filter`

```ts
filter<T extends string | object>(notebooks: T[]): Promise<T[]>
filter<T>(objs: T[], accessor: FilterAccessor<T>): Promise<T[]>
static filter<T extends string | object>(notebooks: T[], opts?: JupyterTrustOptions): Promise<T[]>
static filter<T>(objs: T[], accessor: FilterAccessor<T>, opts?: JupyterTrustOptions): Promise<T[]>

type FilterAccessor<T> = (obj: T) => string | object | Promise<string | object>
```

Given a list of notebooks, this will return the ones which are trusted. Optionally, an accessor function can be passed which is used to access the notebook from some wrapper object (or however it can get a notebook), in which case the wrapper objects will be returned instead.

Like with the other methods, a string will be treated as the file path, while an object is treated as the notebook data.

```ts
import { glob } from 'glob'
import { filter } from 'jupyter-trust'

await filter(await glob('src/**/*.ipynb')) // string[]
await filter(await glob('src/**/*.ipynb', { withFileTypes: true }), (path) => path.fullpath()) // Path[]
```

---

### `sign`

```ts
function sign(notebook: string | object): Promise<boolean>
```

Sign a notebook as trusted. Accepts either the path to the ipynb file or the notebook data.

Returns true if notebook was signed, or false if it has already been signed.

---

### `unsign`

```ts
unsign(notebook: string | object): Promise<boolean>
static unsign(notebook: string | object, opts?: JupyterTrustOptions): Promise<boolean>
```

Unsign a notebook. Accepts either the path to the ipynb file or the notebook data.

Returns true if notebook was unsigned, or false if it was not previously signed.

---

### `digest`

```ts
digest(nb: object): string
static digest(nb: object, options?: JupyterTrustOptions): Promise<string>
static digest(nb: object, options?: JupyterTrustOptions & { secret: string }): string
```

Used to manually compute the signature of a notebook. This only accepts the loaded notebook data as an object.

If no secret is provided in `options` for the static method, a Promise will be returned. The `database` field in `JupyterTrustOptions` is unused.

This generates a HMAC digest of the notebook using the `secret` and `algorithm`. You can recreate the behaviour of this function with help from [`serialize()`](#serialize) and [`omitSignature()`](#omitsignature) in `jupyter-trust/utils`

```ts
import { createHmac } from 'node:crypto'

import { omitSignature, serialize } from 'jupyter-trust/utils'

const hmac = createHmac('sha256', '<SECRET>')
for (const data of serialize(omitSignature(nb))) {
    hmac.update(data)
}
hmac.digest('hex')
```

There is also a [`generateSecret()`](#generatesecret) utility.

---

```ts
readonly store: SignatureStore
```

The underlying [`SignatureStore`](#signaturestore) used to manage signatures.

---

```ts
async close(): Promise<void>
```

Close the underlying store.

---

### `JupyterTrustOptions`

```ts
interface JupyterTrustOptions extends SignatureStoreOptions
```

-   **`database`**: `string` _(optional)_

    The path to the SQLite database.

    The default database locations are:

    ```
    ~/.local/share/jupyter/nbsignatures.db  # Linux
    ~/Library/Jupyter/nbsignatures.db       # OS X
    %APPDATA%/jupyter/nbsignatures.db       # Windows
    ```

    If the default does not work, try running `jupyter --paths` and look for a `nbsignatures.db` file in the listed `data` paths. (Not all the paths listed by `jupyter --paths` may necessarily exist.)

-   **`secret`**: `string` _(optional)_

    The secret used to sign notebooks. By default, Jupyter uses a 1024 byte secret encoded as base64 stored in a `notebook_secret` file in the same directory as the database. You can specify this directory with the `dataDir` option to load the secret instead.

-   **`dataDir`**: `string` _(optional)_

    The data directory containing the database and secret.

    If the default does not work, try running `jupyter --paths` and look for a directory in the listed `data` paths which has the `nbsignatures.db` and `notebook_secret` files. (Not all the paths listed by `jupyter --paths` may necessarily exist.)

-   **`algorithm`**: `string` _(optional)_

    The algorithm used to sign notebooks. The default is `sha256`. Any algorithm which is supported by [`node:crypto`](https://nodejs.org/api/crypto.html) should work.

All the options in [`SignatureStoreOptions`](#signaturestoreoptions) can also be passed in.

---

### `SignatureStore`

Class to interface more directly with the database storing notebook signatures.

```ts
class SignatureStore {
    constructor(filename: string, options?: SignatureStoreOptions)
}
```

---

```ts
async ready(): Promise<void>
```

Optionally wait for the database to be ready. If the database fails to open, it will throw.

---

```ts
async close(): Promise<void>
```

Close the database.

---

```ts
static async init(db: sqlite3.Database): Promise<boolean>
```

Utility function to initialize the database table and index. Returns true if it did anything. This is called automatically by `SignatureStore` when opening the database. This should only be necessary if you are directly working with the [node `sqlite3` library](https://github.com/TryGhost/node-sqlite3).

---

```ts
async check(signature: string, algorithm: string): Promise<boolean>
```

Checks if the signature with the specified algorithm exists in the database. If found (and the store is not readonly), this will update the last seen value of the signature.

---

```ts
async store(signature: string, algorithm: string): Promise<boolean>
```

Store a signature and its algorithm in the database.
Returns true if a new signature was stored, or false if it was already in the database.

---

```ts
async remove(signature: string, algorithm: string): Promise<boolean>
```

Remove a signature from the database. Returns true if the signature was removed, or false if it was not in the database.

---

```ts
async cull(): Promise<boolean>
```

Removes the oldest signatures from the database until the size of the database is 75% of the `cacheSize` option.

Returns true if signatures were removed, false otherwise.

---

```ts
async count(): Promise<number>
```

Returns the number of signatures stored in the database.

---

### `SignatureStoreOptions`

```ts
interface SignatureStoreOptions
```

-   **`readonly`**: `boolean` _(default `false`)_

    Disable any writing to the database. This will cause an error on any write operations.

-   **`create`**: `boolean` _(default `false`)_

    Create the database file if it does not exist. Note that as long as the database is not readonly, it will try to initialize the database even if `create` is `false`.

-   **`cull`**: `boolean` _(default `true`)_

    Whether to automatically run `cull()` on the store whenever the number of signatures exceeds the `cacheSize`.

-   **`cacheSize`**: `number` _(default `65535`)_

    The size limit of the database used when culling the database.

---

### `parse`

```ts
parse(text: string): any
```

Parse a JSON string. This parses all integer strings to `BigInt` to match the bahaviour of numbers in Python. In effect, the Javascript `number` type is used to represent the Python `float`, while `bigint` represents `int`. This also allows parsing large integer values without any loss of precision.

```ts
1234 // bigint
1234.0 // number
1.234e3 // number
1e3 // number
```

---

### `serialize`

```ts
serialize(obj: unknown): Generator<string>
```

Generator function used in generating the notebook's signature. The generator yields a the string representation of a single object key or (primitive) value at a time. The serialization of primitive values should exactly match the `str()` function in Python. This treats all `number`s like Python `float`s and `bigint` like `int`.
The function is intended to be called on objects which are parsed from JSON using [`parse()`](#parse).

Object keys are sorted to ensure the output is stable.

For example,

```ts
serialize({
    key1: [21, 'str'],
    other: 0.00001,
    int: 1n,
})
```

will yield the following

```
int
1
key1
21.0
str
other
1e-5
```

---

### `omitSignature`

```ts
omitSignature(obj: unknown): unknown
```

Returns a copy of the input object without the `metadata.signature` property. The object is only copied if it is valid and has a `metadata` object with a `signature` property.

---

### `generateSecret`

```ts
generateSecret(): Promise<string>
```

Asynchronously enerates a secure 1024 byte secret using [`node:crypto`](https://nodejs.org/api/crypto.html#cryptogeneratekeytype-options-callback) which can be used to sign notebooks. The result is encoded as base64.

If you need a synchronous version, you can also use [`randomBytes` from `node:crypto`](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback).

```ts
import { randomBytes } from 'node:crypto'

randomBytes(1024).toString('base64')
```

---

### `defaultDataDir`

```ts
defaultDataDir(): string
```

Returns the default data directory used by Jupyter. If the environment variable `JUPYTER_DATA_DIR` exists it will be used.
Otherwise the result depends on your operating system.

---

### `defaultSecret`

```ts
defaultSecret(dataDir?: string, refresh?: boolean): Promise<string>
```

Returns the default secret used for signing notebooks.

This reads the `notebook_secret` file in `dataDir` (defaults to `defaultDataDir()`). If no `dataDir` is specified, it may return a cached value. Set `refresh` to `true` to force it to re-read the secret file.

---

## Development

After cloning the repository, run:

```sh
npm install
```

For the tests to work, you will need to setup python and run:

```sh
pip install -r requirements.txt
```

**Building:**

```sh
npm run build
```

**Testing:**

```sh
npm run lint
npm run format:check
npm test
npm run coverage # run testing with coverage
```

**Release:**

```sh
npx changeset
```

Versioning and releasing are handled with [changesets](https://github.com/changesets/changesets).
