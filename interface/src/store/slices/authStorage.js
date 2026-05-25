const AUTH_TOKEN_KEY = 'authToken';

export function persistAuthToken(token, rememberMe) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  if (rememberMe) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function readAuthToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}
