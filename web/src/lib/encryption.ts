export function encrypt(text: string): string {
  return btoa(text)
}

export function decrypt(encoded: string): string {
  return atob(encoded)
}
