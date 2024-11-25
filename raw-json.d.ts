/* eslint-disable @typescript-eslint/no-explicit-any */

declare module '@ungap/raw-json' {
    export function isRawJSON(value: any): value is { readonly rawJSON: string }
    export function parse(
        text: string,
        reviver?: (this: any, key: string, value: any, context: { source: string }) => any,
    ): any
    export function rawJSON(text: string): { readonly rawJSON: string }
    export function stringify(
        value: any,
        replacer?: (this: any, key: string, value: any) => any,
        space?: string | number,
    ): string
    export function stringify(
        value: any,
        replacer?: (number | string)[] | null,
        space?: string | number,
    ): string
}
