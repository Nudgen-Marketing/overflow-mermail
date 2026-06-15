import PostalMime from "postal-mime";
import { prisma } from "~/lib/prisma";
import {
  extractMessageId,
  generateMessageId,
  normalizeAddressList,
  previewBody,
} from "~/lib/email/helpers";
import { SendEmailRequestSchema, type SendEmailRequest } from "~/lib/email/schemas";
import { sendEmail } from "~/lib/server/mail/cloudflare-email";

type ParsedAddress = {
  address?: string;
  name?: string;
};

function firstAddress(value?: ParsedAddress[] | ParsedAddress | null) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.address || "";
}

function joinAddresses(value?: ParsedAddress[] | ParsedAddress | null) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map((item) => item.address).filter(Boolean).join(", ");
}

export async function parseInboundEmail(rawEmail: ArrayBuffer) {
  const parsed = await PostalMime.parse(rawEmail);
  const body = parsed.html || parsed.text || "";
  const messageId = extractMessageId(parsed.messageId) ?? crypto.randomUUID();
  const recipient = joinAddresses(parsed.to);
  return {
    id: messageId,
    mailboxId: recipient.toLowerCase(),
    folder: "inbox",
    subject: parsed.subject || "",
    sender: firstAddress(parsed.from).toLowerCase(),
    recipient: recipient.toLowerCase(),
    cc: joinAddresses(parsed.cc).toLowerCase() || null,
    bcc: joinAddresses(parsed.bcc).toLowerCase() || null,
    body,
    bodyPreview: previewBody(body),
    inReplyTo: extractMessageId(parsed.inReplyTo) ?? null,
    emailReferences: parsed.references?.length
      ? JSON.stringify(parsed.references.map((value) => extractMessageId(value)).filter(Boolean))
      : null,
    threadId: extractMessageId(parsed.inReplyTo) ?? messageId,
    messageId,
    rawHeaders: JSON.stringify(parsed.headers ?? []),
    attachments: (parsed.attachments ?? []).map((attachment) => ({
      id: crypto.randomUUID(),
      filename: attachment.filename || "attachment",
      mimetype: attachment.mimeType || "application/octet-stream",
      size: attachment.content.byteLength,
      contentId: attachment.contentId ?? null,
      disposition: attachment.disposition ?? "attachment",
      bytes: attachment.content,
    })),
  };
}

export async function persistInboundEmail(rawEmail: ArrayBuffer) {
  const parsed = await parseInboundEmail(rawEmail);
  await prisma.mailbox.upsert({
    where: { id: parsed.mailboxId },
    create: {
      id: parsed.mailboxId,
      email: parsed.mailboxId,
      name: parsed.mailboxId,
      owner: {
        connectOrCreate: {
          where: { address: "0x0000000000000000000000000000000000000000000000000000000000000000" },
          create: {
            address: "0x0000000000000000000000000000000000000000000000000000000000000000",
            email: "inbound-owner@example.com",
          },
        },
      },
    },
    update: {},
  });
  const email = await prisma.email.upsert({
    where: { id: parsed.id },
    create: {
      id: parsed.id,
      mailboxId: parsed.mailboxId,
      folder: parsed.folder,
      subject: parsed.subject,
      sender: parsed.sender,
      recipient: parsed.recipient,
      cc: parsed.cc,
      bcc: parsed.bcc,
      bodyPreview: parsed.bodyPreview,
      inReplyTo: parsed.inReplyTo,
      emailReferences: parsed.emailReferences,
      threadId: parsed.threadId,
      messageId: parsed.messageId,
      rawHeaders: parsed.rawHeaders,
      attachments: {
        create: parsed.attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.filename,
          mimetype: attachment.mimetype,
          size: attachment.size,
          contentId: attachment.contentId,
          disposition: attachment.disposition,
          harborFileId: `pending:${attachment.id}`,
        })),
      },
    },
    update: {
      subject: parsed.subject,
      sender: parsed.sender,
      recipient: parsed.recipient,
      bodyPreview: parsed.bodyPreview,
      rawHeaders: parsed.rawHeaders,
    },
  });
  return { id: email.id, mailboxId: email.mailboxId, status: "accepted" };
}

export async function createSentEmail(body: unknown) {
  const parsed = SendEmailRequestSchema.parse(body);
  const fromEmail = (typeof parsed.from === "string" ? parsed.from : parsed.from.email).toLowerCase();
  if (fromEmail !== parsed.mailboxId.toLowerCase()) {
    throw new Error("From address must match mailboxId.");
  }
  const domain = fromEmail.split("@")[1];
  if (!domain) throw new Error("Invalid from address.");
  const ids = generateMessageId(domain);
  await sendEmail(parsed);
  await prisma.email.create({
    data: {
      id: ids.id,
      mailbox: {
        connectOrCreate: {
          where: { id: parsed.mailboxId.toLowerCase() },
          create: {
            id: parsed.mailboxId.toLowerCase(),
            email: parsed.mailboxId.toLowerCase(),
            name: parsed.mailboxId.toLowerCase(),
            owner: {
              connectOrCreate: {
                where: { address: "0x0000000000000000000000000000000000000000000000000000000000000000" },
                create: {
                  address: "0x0000000000000000000000000000000000000000000000000000000000000000",
                  email: "outbound-owner@example.com",
                },
              },
            },
          },
        },
      },
      folder: "sent",
      subject: parsed.subject,
      sender: fromEmail,
      recipient: normalizeAddressList(parsed.to),
      cc: normalizeAddressList(parsed.cc),
      bcc: normalizeAddressList(parsed.bcc),
      bodyPreview: previewBody(parsed.html || parsed.text || ""),
      inReplyTo: parsed.inReplyTo ?? null,
      emailReferences: parsed.references ? JSON.stringify(parsed.references) : null,
      threadId: parsed.threadId || parsed.inReplyTo || ids.id,
      messageId: ids.messageId,
    },
  });
  return { id: ids.id, status: "sent" as const };
}
