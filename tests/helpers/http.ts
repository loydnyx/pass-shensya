import { NextRequest } from "next/server";

type RouteContext = { params: { id: string } };

// Route handlers take (request) or (request, { params }); one loose type covers both.
type Handler = (req: NextRequest, context: RouteContext) => Promise<Response>;

/** Calls a route handler with a JSON body and returns status, parsed body and headers. */
export async function call(
  handler: Handler,
  url: string,
  body?: unknown,
  options: { method?: string; ip?: string; params?: RouteContext } = {},
) {
  const request = new NextRequest(`http://localhost${url}`, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": options.ip ?? "203.0.113.10",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const response = await handler(request, options.params ?? { params: { id: "" } });

  return {
    status: response.status,
    // Routes return objects or arrays; the tests assert on the fields they care about.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: (await response.json().catch(() => null)) as any,
    headers: response.headers,
  };
}