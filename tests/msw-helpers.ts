import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

export let capturedRequest: CapturedRequest | null = null;

export function resetCapturedRequest(): void {
  capturedRequest = null;
}

export function captureHandler(url: string) {
  return http.post(url, async ({ request }) => {
    capturedRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    };
    return HttpResponse.text("ok");
  });
}

export const server = setupServer();
