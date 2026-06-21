import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(() => ({ OPENAI_API_KEY: "test-key" })),
  getEnokiJwt: vi.fn(),
  getZkLogin: vi.fn(),
  parse: vi.fn((value: unknown) => value),
  runRagMailAgent: vi.fn(),
}));

vi.mock("../app/lib/server/env", () => ({
  getServerEnv: mocks.getServerEnv,
}));

vi.mock("../app/lib/server/enoki", () => ({
  getEnokiJwt: mocks.getEnokiJwt,
  getEnokiZkLoginClient: () => ({ getZkLogin: mocks.getZkLogin }),
}));

vi.mock("../app/lib/server/agent/mail-agent", () => ({
  MailAgentRequestSchema: { parse: mocks.parse },
  runRagMailAgent: mocks.runRagMailAgent,
}));

import { POST } from "../app/api/agent/mailbox/route";

function request(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/agent/mailbox", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as never;
}

describe("mail agent route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnokiJwt.mockReturnValue("jwt");
    mocks.getZkLogin.mockResolvedValue({ address: "0xabc" });
    mocks.runRagMailAgent.mockResolvedValue({
      text: "Grounded answer",
      model: "agent-model",
      toolCalls: [],
      ragAttached: true,
      ragSources: ["blob-1"],
    });
  });

  it("scopes agent recall to the address from the Enoki session", async () => {
    const body = { prompt: "What is our refund policy?" };
    const response = await POST(request(body, { authorization: "Bearer jwt" }));

    expect(response.status).toBe(200);
    expect(mocks.runRagMailAgent).toHaveBeenCalledWith(
      { OPENAI_API_KEY: "test-key" },
      "0xabc",
      body,
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ ragAttached: true, ragSources: ["blob-1"] }),
    );
  });

  it("rejects requests without an Enoki JWT", async () => {
    mocks.getEnokiJwt.mockReturnValue(null);

    const response = await POST(request({ prompt: "Help" }));

    expect(response.status).toBe(401);
    expect(mocks.runRagMailAgent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Missing Enoki JWT" });
  });
});
