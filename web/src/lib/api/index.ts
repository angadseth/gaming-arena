import type { Api } from './types'

export * from './types'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

let instance: Promise<Api> | null = null

/** The backend: Supabase when configured, otherwise the in-browser dev database. */
export function getApi(): Promise<Api> {
  if (!instance) {
    instance =
      URL_ && KEY
        ? import('./supabase').then((m) => m.createSupabaseApi(URL_, KEY))
        : import.meta.env.DEV
          ? import('./pglite').then((m) => m.createPgliteApi())
          : Promise.reject(new Error('This build has no backend configured.'))
  }
  return instance
}
