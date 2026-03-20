import type { Application } from './declarations'

export function getReversedPublicBaseDomain(app: Application): string {
  const baseUrl = app.get('publicBaseUrl') as string
  const host = new URL(baseUrl).hostname
  return host.split('.').reverse().join('.')
}
