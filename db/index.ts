import { env } from 'cloudflare:workers';

export function getDb() {
  if (!env.DB) throw new Error('O banco de ações do quadro ainda não está disponível.');
  return env.DB;
}
