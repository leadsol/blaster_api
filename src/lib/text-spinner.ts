/**
 * Text Spinning Engine
 * Supports syntax: {option1|option2|option3} for random selection
 * And variable replacement: {variable_name} with provided data
 */

export function spinText(text: string, variables: Record<string, string> = {}): string {
  // First, replace variables
  let result = text.replace(/\{([^{}|]+)\}/g, (match, varName) => {
    const trimmedName = varName.trim()
    // Check if it's a variable (no | character)
    if (variables[trimmedName] !== undefined) {
      return variables[trimmedName]
    }
    return match // Keep original if variable not found
  })

  // Then, handle spin syntax {option1|option2|option3}
  result = result.replace(/\{([^{}]+\|[^{}]+)\}/g, (match, options) => {
    const optionsArray = options.split('|').map((opt: string) => opt.trim())
    const randomIndex = Math.floor(Math.random() * optionsArray.length)
    return optionsArray[randomIndex]
  })

  return result
}

/**
 * Preview all possible variations of a spun text
 */
export function getSpinVariations(text: string): string[] {
  const variations: string[] = []
  const spinMatches = text.match(/\{[^{}]+\|[^{}]+\}/g)

  if (!spinMatches) {
    return [text]
  }

  // Get all options for each spin group
  const spinGroups = spinMatches.map(match => {
    const options = match.slice(1, -1).split('|').map(opt => opt.trim())
    return options
  })

  // Generate all combinations
  function generateCombinations(
    currentIndex: number,
    currentText: string,
    results: string[]
  ) {
    if (currentIndex >= spinGroups.length) {
      results.push(currentText)
      return
    }

    const currentMatch = spinMatches![currentIndex]
    const options = spinGroups[currentIndex]

    for (const option of options) {
      const newText = currentText.replace(currentMatch, option)
      generateCombinations(currentIndex + 1, newText, results)
    }
  }

  generateCombinations(0, text, variations)
  return variations
}

/**
 * Count total variations possible
 */
export function countVariations(text: string): number {
  const spinMatches = text.match(/\{[^{}]+\|[^{}]+\}/g)
  if (!spinMatches) return 1

  return spinMatches.reduce((total, match) => {
    const optionCount = match.slice(1, -1).split('|').length
    return total * optionCount
  }, 1)
}

/**
 * Extract variable names from text
 */
export function extractVariables(text: string): string[] {
  const variables: string[] = []
  const regex = /\{([^{}|]+)\}/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const varName = match[1].trim()
    if (!variables.includes(varName)) {
      variables.push(varName)
    }
  }

  return variables
}

/**
 * Validate spin syntax
 */
export function validateSpinSyntax(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check for unmatched braces
  let braceCount = 0
  for (const char of text) {
    if (char === '{') braceCount++
    if (char === '}') braceCount--
    if (braceCount < 0) {
      errors.push('יש סוגר מסולסל סוגר ללא פותח')
      break
    }
  }
  if (braceCount > 0) {
    errors.push('יש סוגר מסולסל פותח ללא סוגר')
  }

  // Check for nested braces
  if (/\{[^{}]*\{/.test(text)) {
    errors.push('סוגריים מקוננים אינם נתמכים')
  }

  // Check for empty options
  if (/\{\s*\||\|\s*\}|\|\s*\|/.test(text)) {
    errors.push('יש אופציה ריקה בתוך הסוגריים')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
