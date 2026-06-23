/// <reference types="vite/client" />

declare module '@citation-js/core' {
  export class Cite {
    constructor(data?: unknown, options?: { forceType?: string })
    static async(data: unknown, options?: { forceType?: string }): Promise<Cite>
    data: unknown[]
    format(type: string, options?: Record<string, unknown>): unknown
  }
  export const plugins: {
    config: {
      get: (plugin: string) => { templates: { add: (name: string, xml: string) => void } }
    }
  }
}

declare module '@citation-js/plugin-bibtex'
declare module '@citation-js/plugin-ris'
declare module '@citation-js/plugin-csl'
declare module '@citation-js/plugin-doi'
