import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("CORS", () => {
  it("responds to preflight OPTIONS", async () => {
    const app = createApp({ logger: false });

    const origin = "http://localhost:5173";
    const res = await app.inject({
      method: "OPTIONS",
      url: "/brands",
      headers: {
        origin,
        "access-control-request-method": "GET"
      }
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });
});

