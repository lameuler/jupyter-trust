import { describe, expect, test } from 'vitest'

import { existsSync } from 'node:fs'

describe('check build', () => {
    test('has cjs build', () => {
        expect(existsSync('dist/cjs/index.js')).toBe(true)
        expect(existsSync('dist/cjs/package.json')).toBe(true)
    })
    test('has esm build', () => {
        expect(existsSync('dist/esm/index.js')).toBe(true)
        expect(existsSync('dist/esm/package.json')).toBe(true)
    })
    test('has types build', () => {
        expect(existsSync('dist/types/index.d.ts')).toBe(true)
    })
})
