import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

export interface MailResult {
  status: 'success' | 'error';
  data: nodemailer.SentMessageInfo | null;
  message: string;
}

export const sendPasswordResetMail = async (mail: MailInput): Promise<MailResult> => {
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
  });

  if (info.accepted.length === 0) {
    return { status: 'error', data: null, message: 'Failed to send email' };
  }

  return { status: 'success', data: info, message: 'Email sent successfully' };
};
