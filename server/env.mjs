import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

function getRootDir() {
  // esbuild bundles Netlify functions to CJS where import.meta.url is undefined
  if (typeof import.meta.url === 'string' && import.meta.url.length > 0) {
    return join(dirname(fileURLToPath(import.meta.url)), '..')
  }
  return process.cwd()
}

const rootDir = getRootDir()

function loadEnvFile() {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function applyNpmrcTls() {
  const npmrcPath = join(rootDir, '.npmrc')
  if (existsSync(npmrcPath) && readFileSync(npmrcPath, 'utf8').includes('strict-ssl=false')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }
}

loadEnvFile()
applyNpmrcTls()

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || process.env.TLS_INSECURE === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

if (!process.env.UNPAYWALL_EMAIL) {
  process.env.UNPAYWALL_EMAIL = 'research@scs-researchminds.local'
}
