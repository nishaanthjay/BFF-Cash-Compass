/** The shared facilitator passcode lives only in sessionStorage (cleared when the tab closes). */
const KEY = 'mc.passcode';

export function getPasscode(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setPasscode(p: string) {
  try {
    sessionStorage.setItem(KEY, p);
  } catch {
    /* ignore */
  }
}
export function clearPasscode() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
