import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Create a new nonce for every request
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",

    // Allow scripts with the generated nonce
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""
    }`,

    // Allow inline styles and Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Allow Google Fonts
    "font-src 'self' https://fonts.gstatic.com data:",

    // Allow images from the app, data, and blob URLs
    "img-src 'self' data: blob:",

    // Allow API and WebSocket connections in development
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,

    // Block plugins
    "object-src 'none'",

    // Block base tag changes
    "base-uri 'self'",

    // Only allow forms on this site
    "form-action 'self'",

    // Allow the portfolio to display this app in an iframe
    "frame-ancestors 'self' https://loydnyx.vercel.app http://127.0.0.1:5500 http://localhost:5500",

    // Force HTTPS in production
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  // Pass the nonce and CSP to Next.js
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Send the CSP to the browser
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      // Apply middleware to pages only
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",

      // Skip prefetch requests
      missing: [
        {
          type: "header",
          key: "next-router-prefetch",
        },
        {
          type: "header",
          key: "purpose",
          value: "prefetch",
        },
      ],
    },
  ],
};