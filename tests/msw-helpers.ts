import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

const state: { request: CapturedRequest | null } = { request: null };

export function getCapturedRequest(): CapturedRequest | null {
  return state.request;
}

export function resetCapturedRequest(): void {
  state.request = null;
}

export function captureHandler(url: string) {
  return http.post(url, async ({ request }) => {
    state.request = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    };
    return HttpResponse.text("ok");
  });
}

export const server = setupServer();
