import { describe, expect, it, vi } from "vitest";

import { buildCloudflareEmailPayload, sendEmail } from "../app/lib/server/mail/cloudflare-email";
import { parseInboundEmail } from "../app/lib/server/mail/mail-service";

describe("Cloudflare email routing", () => {
  it("builds a Cloudflare Email Sending payload", () => {
    expect(
      buildCloudflareEmailPayload({
        mailboxId: "support@example.com",
        to: "customer@example.com",
        from: { email: "support@example.com", name: "Support" },
        subject: "Hello",
        html: "<p>Hello</p>",
      }),
    ).toEqual({
      to: "customer@example.com",
      from: { address: "support@example.com", name: "Support" },
      subject: "Hello",
      html: "<p>Hello</p>",
    });
  });

  it("skips outbound sending when Cloudflare env is missing", async () => {
    await expect(
      sendEmail(
        {
          mailboxId: "support@example.com",
          to: "customer@example.com",
          from: "support@example.com",
          subject: "Hello",
          text: "Hello",
        },
        { env: {} },
      ),
    ).resolves.toBeNull();
  });

  it("posts outbound email through Cloudflare when configured", async () => {
    const fetchFn = vi.fn(async () => Response.json({ success: true }));
    await sendEmail(
      {
        mailboxId: "support@example.com",
        to: "customer@example.com",
        from: "support@example.com",
        subject: "Hello",
        text: "Hello",
      },
      {
        env: {
          CLOUDFLARE_EMAIL_ACCOUNT_ID: "acct",
          CLOUDFLARE_EMAIL_API_TOKEN: "token",
        },
        fetchFn,
      },
    );

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acct/email/sending/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("parses inbound MIME into mailbox metadata", async () => {
    const raw = new TextEncoder().encode(
      [
        "From: Customer <customer@example.com>",
        "To: Support <support@example.com>",
        "Subject: Need help",
        "Message-ID: <message-1@example.com>",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "My order has not arrived.",
      ].join("\r\n"),
    );

    await expect(parseInboundEmail(raw.buffer)).resolves.toMatchObject({
      id: "message-1@example.com",
      mailboxId: "support@example.com",
      sender: "customer@example.com",
      recipient: "support@example.com",
      subject: "Need help",
      bodyPreview: "My order has not arrived.",
      threadId: "message-1@example.com",
    });
  });
});
