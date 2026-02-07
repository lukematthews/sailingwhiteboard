export function uid(): string {
  // Simple UID good enough for UI state
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
