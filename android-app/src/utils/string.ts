/**
 * Normalizes a string for search/comparison:
 * 1. Converts to lowercase.
 * 2. Normalizes Unicode NFD (separating base characters from diacritics)
 *    and strips out diacritic marks (accents).
 * 3. Replaces all non-alphanumeric characters (including hyphens, commas, colons, etc.) with spaces.
 * 4. Collapses consecutive spaces into a single space.
 * 5. Trims leading/trailing whitespace.
 */
export function normalizeForSearch(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips all non-alphanumeric characters and spaces from a string.
 * Used as a fallback for ultra-fuzzy matching (e.g. matching "homemaranha" to "Homem-Aranha").
 */
export function stripAllNonAlphanumeric(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Checks if a name matches a search query using both normalized-space and fully-stripped matching.
 */
export function matchesSearch(name: string, query: string): boolean {
  const qNorm = normalizeForSearch(query);
  if (!qNorm) return true;

  const nameNorm = normalizeForSearch(name);
  if (nameNorm.includes(qNorm)) return true;

  // Fallback: match if stripped query is found in stripped name (minimum 3 characters query)
  const qStripped = stripAllNonAlphanumeric(query);
  if (qStripped.length >= 3) {
    const nameStripped = stripAllNonAlphanumeric(name);
    if (nameStripped.includes(qStripped)) return true;
  }

  return false;
}
