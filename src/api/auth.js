export async function getCurrentUser() {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not check your GitHub sign-in.');

  const result = await response.json();
  return result.authenticated ? result.user : null;
}

export async function logoutCurrentUser() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Could not disconnect the GitHub account.');
}
