// ============================================================
// SERVER UTIL: Client PayPal condiviso per le route server.
// Gestisce autenticazione OAuth2 e URL base (sandbox/live).
// ============================================================

function getConfig() {
  const config = useRuntimeConfig()
  return {
    baseUrl:      (config.paypalBaseUrl      as string) || 'https://api-m.sandbox.paypal.com',
    clientId:     config.paypalClientId      as string,
    clientSecret: config.paypalClientSecret  as string,
    planId:       config.paypalSwapPassPlanId as string | undefined,
    appBaseUrl:   (config.public as Record<string, unknown>).baseUrl as string || 'https://impero-waifu.vercel.app',
  }
}

export function getPayPalConfig() {
  return getConfig()
}

/** Ottiene un token OAuth2 dal server PayPal. */
export async function getPayPalAccessToken(): Promise<string> {
  const { baseUrl, clientId, clientSecret } = getConfig()
  if (!clientId || !clientSecret) throw new Error('Credenziali PayPal mancanti sul server')

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method:  'POST',
    headers: {
      Authorization:   `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string }
    throw new Error(`PayPal auth fallita: ${err.error_description || res.status}`)
  }
  return ((await res.json()) as { access_token: string }).access_token
}
