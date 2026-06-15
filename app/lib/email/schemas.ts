import { z } from "zod";

const RecipientFieldSchema = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1),
]);

export const SendEmailRequestSchema = z
  .object({
    mailboxId: z.string().email(),
    to: RecipientFieldSchema,
    cc: RecipientFieldSchema.optional(),
    bcc: RecipientFieldSchema.optional(),
    from: z.union([
      z.string().email(),
      z.object({ email: z.string().email(), name: z.string().min(1) }),
    ]),
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
    attachments: z
      .array(
        z.object({
          content: z.string(),
          filename: z.string().min(1),
          type: z.string().min(1),
          disposition: z.enum(["attachment", "inline"]),
          contentId: z.string().optional(),
        }),
      )
      .optional(),
    inReplyTo: z.string().optional(),
    references: z.array(z.string()).optional(),
    threadId: z.string().optional(),
  })
  .refine((data) => data.html || data.text, {
    message: "Either html or text must be provided",
  });

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

export const SendEmailResponseSchema = z.object({
  id: z.string(),
  status: z.literal("sent"),
});
