import { Client } from '@upstash/qstash'

// QStash client for scheduling delayed API calls
const QSTASH_TOKEN = process.env.QSTASH_TOKEN

export const qstash = QSTASH_TOKEN
  ? new Client({
      token: QSTASH_TOKEN,
    })
  : null

export const isQStashConfigured = (): boolean => {
  return qstash !== null
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
  if (!qstash) {
    console.error('QStash not configured')
    return null
  }

  const appUrl = getAppUrl()
  const endpoint = `${appUrl}/api/campaigns/${campaignId}/send-message`

  try {
    const result = await qstash.publishJSON({
      url: endpoint,
      body: { messageId },
      delay: delaySeconds,
      retries: 3,
    })

    console.log(`[QSTASH] Scheduled message ${messageId} with ${delaySeconds}s delay`)
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
  if (!qstash) {
    console.error('QStash not configured')
    return null
  }

  const appUrl = getAppUrl()
  const endpoint = `${appUrl}/api/campaigns/${campaignId}/process-batch`

  try {
    const result = await qstash.publishJSON({
      url: endpoint,
      body: { campaignId },
      delay: delaySeconds,
      retries: 3,
    })

    console.log(`[QSTASH] Scheduled next batch for campaign ${campaignId} with ${delaySeconds}s delay`)
    return { messageId: result.messageId }
  } catch (error) {
    console.error('[QSTASH] Failed to schedule batch:', error)
    return null
  }
}
