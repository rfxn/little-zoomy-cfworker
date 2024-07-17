const API_KEY = 'your-secure-api-key';
const RATE_LIMIT = 100; // requests per minute per IP
const GTM_ID = 'GTM-XXXX'; // Google Tag Manager ID

// Cloudflare KV Namespace binding
const KV_NAMESPACE = ZOOM_KV;

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const clientIP = request.headers.get('cf-connecting-ip') || '';
  const isRateLimited = await checkRateLimit(clientIP);
  if (isRateLimited) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  const url = new URL(request.url);
  const apiKey = url.searchParams.get('api_key');
  const groupId = url.searchParams.get('group_id');
  const token = url.searchParams.get('token');

  if (request.method === 'POST') {
    if (apiKey !== API_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const zoomInfo = await request.json();
      const group_id = zoomInfo.group_id; // Ensure group_id is correctly extracted
      if (!group_id) {
        return new Response('group_id is missing in the request body', { status: 400 });
      }

      const token = generateToken();
      const key = `zoomInfo_${group_id}_${token}`;
      zoomInfo.token = token;
      await KV_NAMESPACE.put(key, JSON.stringify(zoomInfo));
      return new Response(JSON.stringify({ message: 'Zoom info updated successfully', token: token }), { status: 200 });
    } catch (err) {
      return new Response('Failed to update Zoom info', { status: 500 });
    }
  }

  if (groupId && token) {
    const cacheKey = new Request(request.url, request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      const key = `zoomInfo_${groupId}_${token}`;
      const zoomInfo = await KV_NAMESPACE.get(key);

      if (zoomInfo) {
        const zoomData = JSON.parse(zoomInfo);
        const html = generateZoomPage(zoomData);
        response = new Response(html, {
          headers: { 'Content-Type': 'text/html' }
        });
        response.headers.append('Cache-Control', 's-maxage=60');
        event.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        console.log(`No data found for key: ${key}`);
        response = new Response(generateGenericPage(), {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
    return response;
  }

  return new Response(generateGenericPage(), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function checkRateLimit(clientIP) {
  const currentTime = Math.floor(Date.now() / 1000);
  const rateLimitKey = `rate_limit_${clientIP}_${currentTime}`;
  const requestCount = (await KV_NAMESPACE.get(rateLimitKey)) || '0';

  if (parseInt(requestCount) >= RATE_LIMIT) {
    return true;
  }

  await KV_NAMESPACE.put(rateLimitKey, (parseInt(requestCount) + 1).toString(), { expirationTtl: 60 });
  return false;
}

function generateToken() {
  return Math.random().toString(36).substr(2, 9);
}

function generateGenericPage() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Zoom Call Information</title>
    <style>
      body { font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333; }
      .container { max-width: 600px; margin: 50px auto; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
      h1 { color: #0070f3; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
    <!-- Google Tag Manager -->
    <script>
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${GTM_ID}');
    </script>
    <!-- End Google Tag Manager -->
  </head>
  <body>
    <div class="container">
      <h1>Welcome to Zoom Call Information</h1>
      <p>Please provide a valid group ID and token to see specific call details.</p>
      <div class="footer">Powered by Your Brand</div>
    </div>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
  </body>
  </html>`;
}

function generateZoomPage(zoomData) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Zoom Call Information</title>
    <style>
      body { font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333; }
      .container { max-width: 600px; margin: 50px auto; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
      h1 { color: #0070f3; }
      .info { margin-bottom: 20px; }
      .info h2 { margin: 0; }
      .info p { margin: 5px 0; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
    <!-- Google Tag Manager -->
    <script>
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${GTM_ID}');
    </script>
    <!-- End Google Tag Manager -->
  </head>
  <body>
    <div class="container">
      <h1>Zoom Call Information</h1>
      <div class="info">
        <h2>Topic: ${zoomData.topic}</h2>
        <p>Start Time: ${zoomData.start_time}</p>
        <p>Duration: ${zoomData.duration} minutes</p>
        <p>Join URL: <a href="${zoomData.join_url}">${zoomData.join_url}</a></p>
      </div>
      <div class="footer">Powered by Your Brand</div>
    </div>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
  </body>
  </html>`;
}
