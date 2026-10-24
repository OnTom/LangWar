// Přihlašovací token a údaje o hráči uložené v prohlížeči
const TOKEN_KEY = 'langwar_token';

let currentUser = null;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Prohlížeč nepovolil uložení – přihlášení vydrží jen do zavření stránky
  }
  currentUser = user;
}

export function setUser(user) {
  currentUser = user;
}

export function getUser() {
  return currentUser;
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  currentUser = null;
}
