import { Resend } from 'resend';

type MailContent = { to: string; subject: string; text: string; html: string; category?: string };

let resendClient: Resend | undefined;

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function configuration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  resendClient ??= new Resend(apiKey);
  return { resend: resendClient, from };
}

export async function sendEmail(content: MailContent) {
  const { resend, from } = configuration();
  const { data, error } = await resend.emails.send({
    from,
    to: content.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    tags: [{ name: 'category', value: content.category ?? 'admin-email-verification' }],
  });
  if (error) throw new Error(`Resend rejected the email (${error.name}): ${error.message}`);
  return data;
}

export async function sendKycReviewNotification(email: string, fullName: string, studentEmail: string, campus: string, reviewUrl: string) {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const name = escapeHtml(fullName);
  const address = escapeHtml(studentEmail);
  const school = escapeHtml(campus || 'Campus not provided');
  return sendEmail({
    to: email,
    subject: 'Student verification needs review',
    text: `A new student verification was submitted by ${fullName} (${studentEmail}, ${school}). Sign in to StudentXchange to review it: ${reviewUrl}\n\nFor privacy, the student ID number and photo are not included in this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:28px;border:1px solid #dce3ef;border-radius:14px;color:#111827"><div style="font-size:22px;font-weight:800;color:#1749d1">StudentXchange</div><h1 style="font-size:24px;margin:24px 0 12px">Student verification needs review</h1><p>A new student verification was submitted by <strong>${name}</strong>.</p><p>${address}<br/>${school}</p><p style="margin:28px 0"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#1749d1;color:white;text-decoration:none;font-weight:700">Review verification</a></p><p>The student ID number and photo are available only in the admin dashboard.</p></div>`,
    category: 'student-kyc-review',
  });
}

export async function sendKycApprovedEmail(email: string, fullName: string) {
  const name = fullName.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  return sendEmail({
    to: email,
    subject: 'Your StudentXchange account is verified',
    text: `Hi ${fullName},\n\nAn administrator approved your student verification. Your account is now verified and you can access seller features on StudentXchange. Sign in to continue: ${process.env.FRONTEND_URL || 'https://studentxchange.vercel.app'}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:28px;border:1px solid #dce3ef;border-radius:14px;color:#111827"><div style="font-size:22px;font-weight:800;color:#1749d1">StudentXchange</div><h1 style="font-size:24px;margin:24px 0 12px">Student verification approved</h1><p>Hi ${name},</p><p>An administrator approved your student verification. Your account is now verified and seller features are available.</p><p style="margin:28px 0"><a href="${(process.env.FRONTEND_URL || 'https://studentxchange.vercel.app').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#1749d1;color:white;text-decoration:none;font-weight:700">Go to StudentXchange</a></p></div>`,
    category: 'student-kyc-approved',
  });
}

export async function sendVerificationEmail(email: string, fullName: string, link: string) {
  const name = fullName.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  return sendEmail({
    to: email,
    subject: 'Verify your StudentXchange administrator email',
    text: `Hi ${fullName},\n\nVerify your administrator email using this link. It expires in 15 minutes and can only be used once:\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:28px;border:1px solid #dce3ef;border-radius:14px;color:#111827"><div style="font-size:22px;font-weight:800;color:#1749d1">StudentXchange</div><h1 style="font-size:24px;margin:24px 0 12px">Verify your administrator email</h1><p>Hi ${name},</p><p>Confirm this email address to activate administrator sign-in.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#1749d1;color:white;text-decoration:none;font-weight:700">Verify email address</a></p><p>This one-time link expires in 15 minutes. If you did not request this, you can ignore this message.</p></div>`,
  });
}

export async function sendVerifiedEmail(email: string, fullName: string) {
  const name = fullName.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  return sendEmail({
    to: email,
    subject: 'Your StudentXchange administrator email is verified',
    text: `Hi ${fullName},\n\nYour administrator email has been verified. You can now sign in to StudentXchange.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:28px;border:1px solid #dce3ef;border-radius:14px;color:#111827"><div style="font-size:22px;font-weight:800;color:#1749d1">StudentXchange</div><h1 style="font-size:24px;margin:24px 0 12px">Email verified</h1><p>Hi ${name},</p><p>Your administrator email address is verified. You can now sign in to StudentXchange.</p></div>`,
  });
}
