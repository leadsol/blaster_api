import { Client } from '@upstash/qstash'

// QStash client - created lazily to ensure env vars are loaded
let qstashClient: Client | null = null

function getQStashClient(): Client | null {
  if (qstashClient) return qstashClient

  const token = process.env.QSTASH_TOKEN
  console.log('[QSTASH] Checking token:', token ? `Found (${token.substring(0, 20)}...)` : 'NOT FOUND')

  if (token) {
    qstashClient = new Client({ token })
    console.log('[QSTASH] Client created successfully')
  }

  return qstashClient
}

export const isQStashConfigured = (): boolean => {
  const client = getQStashClient()
  const configured = client !== null
  console.log('[QSTASH] isQStashConfigured:', configured)
  return configured
}

// Helper to get the app URL for QStash callbacks
export const getAppUrl = (): string => {
  // Use NEXT_PUBLIC_APP_URL for stable production URL
  // VERCEL_URL changes per deployment and won't work for callbacks
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000') {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  // Fallback to VERCEL_URL for preview deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

// Schedule a message to be sent after a delay
export async function scheduleMessage(
  campaignId: string,
  messageId: string,
  delaySeconds: number
): Promise<{ messageId: string } | null> {
  const client = getQStashClient()
  if (!client) {
    console.error('[QSTASH] Client not configured - cannot schedule message')
    return null
  }

  const appUrl = getAppUrl()
  const endpoint = `${appUrl}/api/campaigns/${campaignId}/send-message`
  console.log(`[QSTASH] Scheduling message to endpoint: ${endpoint}`)

  try {
    const result = await client.publishJSON({
      url: endpoint,
      body: { messageId },
      delay: delaySeconds,
      retries: 3,
    })

    console.log(`[QSTASH] Scheduled message ${messageId} with ${delaySeconds}s delay, QStash ID: ${result.messageId}`)
    return { messageId: result.messageId }
  } catch (error) {
    console.error('[QSTASH] Failed to schedule message:', error)
    return null
  }
}

// Schedule the next batch of messages for a campaign
export async function scheduleNextBatch(
  campaignId: string,
  delaySeconds: number = 0
): Promise<{ messageId: string } | null> {
  const client = getQStashClient()
  if (!client) {
    console.error('[QSTASH] Client not configured - cannot schedule batch')
    return null
  }

  const appUrl = getAppUrl()
  const endpoint = `${appUrl}/api/campaigns/${campaignId}/process-batch`
  console.log(`[QSTASH] Scheduling batch to endpoint: ${endpoint}`)

  try {
    const result = await client.publishJSON({
      url: endpoint,
      body: { campaignId },
      delay: delaySeconds,
      retries: 3,
    })

    console.log(`[QSTASH] Scheduled next batch for campaign ${campaignId} with ${delaySeconds}s delay, QStash ID: ${result.messageId}`)
    return { messageId: result.messageId }
  } catch (error) {
    console.error('[QSTASH] Failed to schedule batch:', error)
    return null
  }
}
