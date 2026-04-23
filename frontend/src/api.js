const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

export async function callApi(path, options = {}) {
  const { headers: optionHeaders = {}, ...restOptions } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...optionHeaders,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}
