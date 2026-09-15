import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Transactional email through the account's own Hostinger Business Email
 * mailbox over SMTP — no third-party ESP. Any Hostinger mailbox works:
 * SMTP_USER/SMTP_PASS are that mailbox's address and password.
 *
 * With no SMTP_USER configured the service logs each message instead of
 * sending, so local/dev/test runs never need real credentials and never
 * email real people.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>("SMTP_USER");
    const pass = config.get<string>("SMTP_PASS");
    this.from = config.get<string>("MAIL_FROM") ?? user ?? "no-reply@localhost";

    if (user && pass) {
      const port = Number(config.get<string>("SMTP_PORT") ?? 465);
      this.transporter = nodemailer.createTransport({
        host: config.get<string>("SMTP_HOST") ?? "smtp.hostinger.com",
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
      this.logger.warn("SMTP_USER/SMTP_PASS not set — emails will be logged, not sent");
    }
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[email:log-only] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...mail });
  }
}
