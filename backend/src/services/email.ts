import nodemailer, { type Transporter } from "nodemailer";

export const EMAIL_CONFIGURED = Boolean(process.env.SMTP_HOST);

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Falls back to logging the message whenever SMTP isn't configured — same
// "dummy provider" pattern used for billing/payments/storage elsewhere in
// this app, so the whole notification flow is testable without a real
// mail account.
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!EMAIL_CONFIGURED) {
    console.log(`[email:dummy] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
