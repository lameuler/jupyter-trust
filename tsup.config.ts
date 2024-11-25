import { mkdir, writeFile } from 'node:fs/promises'

import type { Format, Plugin } from 'esbuild'
import { glob } from 'glob'
import { defineConfig } from 'tsup'

export default defineConfig({
    entry: await glob(['src/**/*.ts'], { ignore: ['**/*.d.ts'], posix: true }),
    bundle: true,
    format: ['esm', 'cjs'],
    outExtension() {
        return { js: '.js' }
    },
    platform: 'node',
    esbuildPlugins: [plugin()],
    noExternal: ['@ungap/raw-json'],
})

const types: Partial<Record<Format | 'none', 'module' | 'commonjs'>> = {
    esm: 'module',
    cjs: 'commonjs',
}

function plugin(): Plugin {
    return {
        name: 'output-format',
        async setup(build) {
            const options = build.initialOptions
            options.outdir = options.outdir + '/' + options.format

            await mkdir(options.outdir, { recursive: true })

            const type = types[options.format ?? 'none']

            if (type) {
                build.onEnd(async () => {
                    await writeFile(
                        options.outdir + '/package.json',
                        JSON.stringify({
                            type,
                        }),
                    )
                })
            }
        },
    }
}
