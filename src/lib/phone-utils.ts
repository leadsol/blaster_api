/**
 * Phone number utilities for Israeli phone numbers
 * Storage: Always 972XXXXXXXX
 * Display: Always 05XXXXXXXX (or other Israeli format)
 */

/**
 * Normalize phone number to international format (972XXXXXXXX)
 * Used before saving to database
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')

  // If starts with 972, it's already normalized
  if (cleaned.startsWith('972')) {
    return cleaned
  }

  // If starts with 0, replace with 972
  if (cleaned.startsWith('0')) {
    return '972' + cleaned.substring(1)
  }

  // If it's 9 digits without prefix, assume Israeli mobile and add 972
  if (cleaned.length === 9) {
    return '972' + cleaned
  }

  // Otherwise return as-is (might be international number)
  return cleaned
}

/**
 * Format phone number for display (972XXXXXXXX -> 05XXXXXXXX)
 * Used when showing to user
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return ''

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')

  // If starts with 972, convert to 0X format
  if (cleaned.startsWith('972')) {
    return '0' + cleaned.substring(3)
  }

  // If starts with 0, already in display format
  if (cleaned.startsWith('0')) {
    return cleaned
  }

  // Otherwise return as-is
  return cleaned
}

/**
 * Validate Israeli phone number
 */
export function isValidIsraeliPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')

  // Check if it's in 972XXXXXXXX format (Israeli international)
  if (cleaned.startsWith('972') && cleaned.length === 12) {
    return true
  }

  // Check if it's in 0XXXXXXXXX format (Israeli local)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return true
  }

  return false
}

/**
 * Format phone with spaces for better readability
 * 972501234567 -> 050-123-4567
 * 05XXXXXXXX -> 05X-XXX-XXXX
 */
export function formatPhoneWithSpaces(phone: string): string {
  const display = formatPhoneForDisplay(phone)

  if (display.length === 10 && display.startsWith('0')) {
    // Format: 05X-XXX-XXXX
    return `${display.substring(0, 3)}-${display.substring(3, 6)}-${display.substring(6)}`
  }

  return display
}
