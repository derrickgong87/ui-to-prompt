export default {
  fetch(request) {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405 });
    }
    return new Response(JSON.stringify({ ok: true, product: 'UItoPrompt', mode: 'production-image-analysis' }), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
