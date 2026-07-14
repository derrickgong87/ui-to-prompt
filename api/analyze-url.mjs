export default {
  fetch(request) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405 });
    }
    return new Response(JSON.stringify({ error: 'URL analysis is being hardened for public use. Use an image reference for now.' }), {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
