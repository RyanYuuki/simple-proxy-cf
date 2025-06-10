import { getBodyBuffer } from '@/utils/body';
import {
  getProxyHeaders,
  getBlacklistedHeaders
} from '@/utils/headers';

export default defineEventHandler(async (event) => {
  // Handle preflight CORS
  if (isPreflightRequest(event)) {
    handleCors(event, {});
    event.node.res.statusCode = 204;
    event.node.res.end();
    return;
  }

  if (event.node.req.method === 'OPTIONS') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing `destination` query param'
    });
  }

  const body = await getBodyBuffer(event);

  try {
    const response = await $fetch.raw(destination, {
      method: event.node.req.method,
      headers: {
        ...getProxyHeaders(event.headers),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36',
        'Origin': 'https://xprime.tv',
        'Referer': 'https://xprime.tv/',
      },
      body,
      redirect: 'follow',
    });

    // Set response headers (excluding blacklisted ones)
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (!getBlacklistedHeaders().includes(key.toLowerCase()) && value)
        filteredHeaders[key] = value.toString();
    }

    setResponseHeaders(event, filteredHeaders);
    return response._data; // return raw proxied body
  } catch (error: any) {
    console.error('Proxy Error:', error);
    throw createError({
      statusCode: error.response?.status || 500,
      statusMessage: error.message || 'Proxy fetch failed',
    });
  }
});
