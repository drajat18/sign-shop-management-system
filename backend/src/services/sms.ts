import twilio from "twilio";

export const SMS_CONFIGURED = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
);

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  }
  return client;
}

export interface SmsMessage {
  to: string;
  body: string;
}

// Same dummy-fallback shape as email.ts — logs instead of sending whenever
// Twilio isn't configured.
export async function sendSms(message: SmsMessage): Promise<void> {
  if (!SMS_CONFIGURED) {
    console.log(`[sms:dummy] To: ${message.to}\n\n${message.body}\n`);
    return;
  }
  await getClient().messages.create({
    to: message.to,
    from: process.env.TWILIO_FROM_NUMBER!,
    body: message.body,
  });
}
