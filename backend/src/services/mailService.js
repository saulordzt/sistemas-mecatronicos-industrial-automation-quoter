import nodemailer from 'nodemailer';

let transporter;

function smtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'mail.sistemasmecatronicos.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false',
    auth: {
      user: process.env.SMTP_USER || 'saulo.rdz@sistemasmecatronicos.com',
      pass: process.env.SMTP_PASS || ''
    }
  };
}

function senderConfig() {
  return {
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'saulo.rdz@sistemasmecatronicos.com',
    fromName: process.env.SMTP_FROM_NAME || 'Sistemas Mecatronicos'
  };
}

function getTransporter() {
  if (!transporter) transporter = nodemailer.createTransport(smtpConfig());
  return transporter;
}

export async function verifyMailConfiguration() {
  const config = smtpConfig();
  if (!config.auth.pass) {
    const error = new Error('SMTP_PASS is not configured');
    error.statusCode = 503;
    throw error;
  }
  await getTransporter().verify();
}

export async function sendQuoteClientLinkEmail({ quote, company = {}, recipients, subject, message, clientUrl }) {
  await verifyMailConfiguration();
  const sender = senderConfig();
  const recipientLine = recipients.map((recipient) => recipient.email).join(', ');
  const projectName = quote.projectSnapshot?.projectName || '';
  const intro = message || `Compartimos la liga de la cotizacion ${quote.quoteNumber}${projectName ? ` para el proyecto ${projectName}` : ''}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #202327; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">${company.name || sender.fromName}</h2>
      <p>${intro}</p>
      <p><strong>Cotizacion:</strong> ${quote.quoteNumber}</p>
      <p><strong>Proyecto:</strong> ${projectName}</p>
      <p><strong>Cliente:</strong> ${quote.customerSnapshot?.companyName || ''}</p>
      <p><strong>Total:</strong> ${quote.commercial?.currency || ''} ${Number(quote.totals?.finalTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <p>
        <a href="${clientUrl}" style="display: inline-block; padding: 10px 16px; background: #15212f; color: #fff; text-decoration: none; border-radius: 4px;">
          Ver cotizacion
        </a>
      </p>
      <p>Si el boton no abre correctamente, copia esta liga en tu navegador:</p>
      <p><a href="${clientUrl}">${clientUrl}</a></p>
      <hr />
      <p style="font-size: 12px; color: #5f6670;">
        ${company.name || sender.fromName}<br/>
        ${company.phone || ''} ${company.email ? `| ${company.email}` : ''}<br/>
        ${company.website || ''}
      </p>
    </div>
  `;

  return getTransporter().sendMail({
    from: `"${sender.fromName}" <${sender.fromEmail}>`,
    to: recipientLine,
    subject,
    text: `${intro}\n\nCotizacion: ${quote.quoteNumber}\nProyecto: ${projectName}\nLiga: ${clientUrl}`,
    html
  });
}
