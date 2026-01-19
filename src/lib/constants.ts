/**
 * Shared constants used across the application
 */

// Campaign bulk pause settings
// Every MESSAGES_PER_BULK messages, add a pause to avoid rate limiting
export const MESSAGES_PER_BULK = 30

// Pause durations in seconds for each bulk (escalating pauses)
// First bulk: 30 minutes, second: 60 minutes, third+: 90 minutes
export const BULK_PAUSE_SECONDS = [30 * 60, 60 * 60, 90 * 60] // [1800, 3600, 5400]

// Device message limits per day
export const DEVICE_BASE_LIMIT = 90
export const DEVICE_VARIATION_BONUS = 10

// Batch processing
export const BATCH_SIZE = 5 // Messages to schedule per batch call

/**
 * Get the appropriate pause duration for a given bulk number (0-indexed)
 */
export function getBulkPauseDuration(bulkIndex: number): number {
  if (bulkIndex < 0) return 0
  if (bulkIndex >= BULK_PAUSE_SECONDS.length) {
    return BULK_PAUSE_SECONDS[BULK_PAUSE_SECONDS.length - 1]
  }
  return BULK_PAUSE_SECONDS[bulkIndex]
}
