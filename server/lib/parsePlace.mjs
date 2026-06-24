/** Parse "City, State, Country" style venue strings from conference catalogs. */
export function parsePlace(place) {
  if (!place || typeof place !== 'string') {
    return { city: null, state: null, country: null, formatted: null }
  }

  const cleaned = place.replace(/\s+/g, ' ').trim()
  const parts = cleaned.split(/,\s*/).filter(Boolean)

  if (parts.length === 0) {
    return { city: null, state: null, country: null, formatted: cleaned }
  }

  if (parts.length === 1) {
    return { city: parts[0], state: null, country: null, formatted: cleaned }
  }

  if (parts.length === 2) {
    return {
      city: parts[0],
      state: null,
      country: parts[1],
      formatted: cleaned,
    }
  }

  return {
    city: parts[0],
    state: parts.slice(1, -1).join(', '),
    country: parts[parts.length - 1],
    formatted: cleaned,
  }
}
