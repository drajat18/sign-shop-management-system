// Swap this for a real provider (Postmark/SES/etc.) before going to
// production — logging the link is fine for local dev and testing, but no
// shop's real password-reset email should end up only in server logs.
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  console.log(`[email:dev] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
}
