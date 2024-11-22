import { spawn } from 'cross-spawn'

export function python(file: string, ...args: string[]) {
    const py = spawn('python3', [file, ...args])
    return new Promise<string[]>((resolve, reject) => {
        const out: string[] = []
        const err: string[] = []
        py.stdout.on('data', (data) => {
            out.push(data.toString())
        })
        py.stderr.on('data', (data) => {
            err.push(data.toString())
        })
        py.on('exit', (code) => {
            if (code) {
                reject(new Error(err.join('')))
            } else {
                resolve(out)
            }
        })
        py.on('error', reject)
    })
}
