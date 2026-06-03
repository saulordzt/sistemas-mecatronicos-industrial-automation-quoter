import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/brand/logo.png';
import dinProRegularUrl from '../assets/fonts/DINPro-Regular.ttf?url';
import dinProMediumUrl from '../assets/fonts/DINPro-Medium.ttf?url';
import dinProBoldUrl from '../assets/fonts/DINPro-Bold.ttf?url';

const brand = {
  green: [123, 172, 66],
  greenDark: [95, 143, 45],
  blue: [21, 33, 47],
  graphite: [32, 35, 39],
  steel: [95, 102, 112],
  silver: [194, 195, 201],
  pale: [244, 247, 241]
};

let fontRegistrationPromise;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function loadFont(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

async function registerFonts(doc) {
  if (!fontRegistrationPromise) {
    fontRegistrationPromise = Promise.all([
      loadFont(dinProRegularUrl),
      loadFont(dinProMediumUrl),
      loadFont(dinProBoldUrl)
    ]);
  }

  const [regular, medium, bold] = await fontRegistrationPromise;
  doc.addFileToVFS('DINPro-Regular.ttf', regular);
  doc.addFileToVFS('DINPro-Medium.ttf', medium);
  doc.addFileToVFS('DINPro-Bold.ttf', bold);
  doc.addFont('DINPro-Regular.ttf', 'DINPro', 'normal');
  doc.addFont('DINPro-Medium.ttf', 'DINPro', 'medium');
  doc.addFont('DINPro-Bold.ttf', 'DINPro', 'bold');
  doc.setFont('DINPro', 'normal');
}

function money(value, currency) {
  return `${currency || ''} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function safe(value, fallback = '') {
  return value || fallback;
}

function resolveRecipientContact(quote) {
  const contacts = Array.isArray(quote.customerSnapshot?.contacts) ? quote.customerSnapshot.contacts : [];
  return contacts.find((contact) => contact.id === quote.recipientContactId)
    || quote.customerSnapshot?.recipientContact
    || quote.customerSnapshot?.selectedContact
    || quote.customerSnapshot?.primaryContact
    || null;
}

function addSectionTitle(doc, title, y) {
  doc.setFillColor(...brand.blue);
  doc.rect(14, y - 4, 182, 7, 'F');
  doc.setFillColor(...brand.green);
  doc.rect(14, y - 4, 4, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('DINPro', 'bold');
  doc.text(title.toUpperCase(), 21, y + 1);
}

function tableTheme() {
  return {
    headStyles: {
      fillColor: brand.green,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: { fillColor: brand.pale },
    styles: {
      font: 'DINPro',
      fontSize: 8,
      cellPadding: 2,
      lineColor: [218, 221, 225],
      lineWidth: 0.1,
      textColor: brand.graphite
    }
  };
}

export async function generateQuotePdf(quote, company = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  await registerFonts(doc);
  const currency = quote.commercial?.currency || 'USD';
  const recipientContact = resolveRecipientContact(quote);

  doc.setFillColor(...brand.blue);
  doc.rect(0, 0, 216, 34, 'F');
  doc.setFillColor(...brand.green);
  doc.rect(0, 31, 216, 3, 'F');
  doc.addImage(logo, 'PNG', 14, 9.4, 46, 15.33);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('DINPro', 'bold');
  doc.text(['PROPUESTA DE', 'AUTOMATIZACION INDUSTRIAL'], 202, 12, { align: 'right', lineHeightFactor: 1.05 });
  doc.setFontSize(9);
  doc.setTextColor(224, 226, 230);
  doc.setFont('DINPro', 'normal');
  doc.text(`Cotizacion: ${safe(quote.quoteNumber)}`, 202, 25, { align: 'right' });
  doc.text(`Estatus: ${safe(quote.status, 'Draft')}`, 202, 30, { align: 'right' });

  autoTable(doc, {
    startY: 41,
    theme: 'plain',
    styles: { font: 'DINPro', fontSize: 9, cellPadding: 1.5, textColor: brand.graphite },
    body: [
      [
        {
          content: `${safe(company.name, 'Sistemas Mecatronicos')}\n${safe(company.address)}\n${safe(company.phone)} | ${safe(company.email)}\n${safe(company.website)}\nRFC / Tax ID: ${safe(company.taxId)}`,
          styles: { fontStyle: 'bold', fillColor: brand.pale }
        },
        {
          content: `Cliente\n${safe(quote.customerSnapshot?.companyName)}\n${safe(recipientContact?.name || quote.customerSnapshot?.contactName)}\n${safe(recipientContact?.email || quote.customerSnapshot?.email)}\n${safe(recipientContact?.phone || quote.customerSnapshot?.phone)}\n${safe(quote.customerSnapshot?.address)}`,
          styles: { fillColor: [250, 251, 250] }
        }
      ]
    ],
    columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 92 } }
  });

  let y = doc.lastAutoTable.finalY + 9;
  addSectionTitle(doc, 'Informacion del Proyecto', y);
  autoTable(doc, {
    startY: y + 6,
    theme: 'grid',
    ...tableTheme(),
    body: [
      ['Proyecto', safe(quote.projectSnapshot?.projectName)],
      ['Tipo', safe(quote.projectSnapshot?.projectType)],
      ['Industria', safe(quote.projectSnapshot?.industry)],
      ['Ubicacion', safe(quote.projectSnapshot?.location)],
      ['Descripcion', safe(quote.projectSnapshot?.description)]
    ],
    columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold' }, 1: { cellWidth: 144 } }
  });

  y = doc.lastAutoTable.finalY + 9;
  addSectionTitle(doc, 'Alcance del Trabajo', y);
  doc.setFont('DINPro', 'normal');
  doc.setTextColor(...brand.graphite);
  doc.setFontSize(9);
  const scopeLines = doc.splitTextToSize(safe(quote.scopeOfWork, 'Alcance por definir.'), 182);
  doc.text(scopeLines, 14, y + 10);
  y = y + 14 + scopeLines.length * 4;
  if (y > 245) {
    doc.addPage();
    y = 18;
  }

  addSectionTitle(doc, 'Lista de Materiales', y);
  autoTable(doc, {
    startY: y + 6,
    head: [['Parte #', 'Descripcion', 'Marca', 'Cant.', 'Precio Unitario', 'Total']],
    body: (quote.materials || []).map((item) => [
      safe(item.partNumber),
      safe(item.description),
      safe(item.brand),
      item.quantity || 0,
      money(item.unitPrice, currency),
      money(item.totalPrice, currency)
    ]),
    ...tableTheme()
  });

  y = doc.lastAutoTable.finalY + 9;
  addSectionTitle(doc, 'Mano de Obra y Servicios', y);
  autoTable(doc, {
    startY: y + 6,
    head: [['Servicio', 'Descripcion', 'Horas', 'Tarifa', 'Total']],
    body: (quote.services || []).map((item) => [
      safe(item.serviceType),
      safe(item.description),
      item.hours || 0,
      money(item.hourlyRate, currency),
      money(item.total, currency)
    ]),
    ...tableTheme()
  });

  y = doc.lastAutoTable.finalY + 9;
  if (y > 220) {
    doc.addPage();
    y = 18;
  }

  addSectionTitle(doc, 'Resumen Comercial', y);
  autoTable(doc, {
    startY: y + 6,
    theme: 'grid',
    ...tableTheme(),
    body: [
      ['Subtotal', money(Number(quote.totals?.directCost || 0) + Number(quote.totals?.contingency || 0), currency)],
      ['Descuento', money(quote.totals?.discount, currency)],
      ['IVA', money(quote.totals?.tax, currency)],
      [{ content: 'Precio total', styles: { fontStyle: 'bold', fillColor: brand.pale } }, { content: money(quote.totals?.finalTotal, currency), styles: { fontStyle: 'bold', fillColor: brand.pale } }]
    ],
    columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 92, halign: 'right' } }
  });

  y = doc.lastAutoTable.finalY + 9;
  addSectionTitle(doc, 'Terminos, Exclusiones y Notas', y);
  doc.setFont('DINPro', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...brand.graphite);
  const terms = [
    `Tiempo de entrega: ${safe(quote.commercial?.deliveryTime)}`,
    `Condiciones de pago: ${safe(quote.commercial?.paymentTerms)}`,
    `Vigencia: ${safe(quote.commercial?.quoteValidityDays)} dias`,
    `Exclusiones: ${safe(quote.exclusions)}`,
    `Notas: ${safe(quote.notes)}`
  ].join('\n');
  doc.text(doc.splitTextToSize(terms, 182), 14, y + 10);

  doc.setFillColor(...brand.green);
  doc.rect(0, 274, 216, 5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...brand.steel);
  doc.text('Sistemas Mecatronicos | Automatizacion, control, tableros electricos, integracion y puesta en marcha.', 14, 270);

  doc.save(`${safe(quote.quoteNumber, 'quote')}.pdf`);
}

export async function generateProviderRfqPdf({ quote, company = {}, provider = {}, dueDate = '', notes = '', materials = [] }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  await registerFonts(doc);

  doc.setFillColor(...brand.blue);
  doc.rect(0, 0, 216, 34, 'F');
  doc.setFillColor(...brand.green);
  doc.rect(0, 31, 216, 3, 'F');
  doc.addImage(logo, 'PNG', 14, 9.4, 46, 15.33);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('DINPro', 'bold');
  doc.text(['SOLICITUD DE', 'COTIZACION'], 202, 12, { align: 'right', lineHeightFactor: 1.05 });
  doc.setFontSize(9);
  doc.setTextColor(224, 226, 230);
  doc.setFont('DINPro', 'normal');
  doc.text(`Referencia: ${safe(quote.quoteNumber)}`, 202, 25, { align: 'right' });
  doc.text(`Proyecto: ${safe(quote.projectSnapshot?.projectName)}`, 202, 30, { align: 'right' });

  autoTable(doc, {
    startY: 41,
    theme: 'plain',
    styles: { font: 'DINPro', fontSize: 9, cellPadding: 1.5, textColor: brand.graphite },
    body: [
      [
        {
          content: `${safe(company.name, 'Sistemas Mecatronicos')}\n${safe(company.address)}\n${safe(company.phone)} | ${safe(company.email)}\n${safe(company.website)}\nRFC / Tax ID: ${safe(company.taxId)}`,
          styles: { fontStyle: 'bold', fillColor: brand.pale }
        },
        {
          content: `Proveedor\n${safe(provider.companyName)}\n${safe(provider.primaryContactName)}\n${safe(provider.primaryContactEmail)}\n${safe(provider.primaryContactPhone)}\n${safe(provider.address)}`,
          styles: { fillColor: [250, 251, 250] }
        }
      ]
    ],
    columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 92 } }
  });

  let y = doc.lastAutoTable.finalY + 9;
  addSectionTitle(doc, 'Datos de la Solicitud', y);
  autoTable(doc, {
    startY: y + 6,
    theme: 'grid',
    ...tableTheme(),
    body: [
      ['Proyecto', safe(quote.projectSnapshot?.projectName)],
      ['Tipo de proyecto', safe(quote.projectSnapshot?.projectType)],
      ['Fecha de solicitud', new Date().toLocaleDateString()],
      ['Fecha limite de respuesta', safe(dueDate)],
      ['Referencia interna', safe(quote.quoteNumber)]
    ],
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 132 } }
  });

  y = doc.lastAutoTable.finalY + 9;
  addSectionTitle(doc, 'Partidas Solicitadas', y);
  autoTable(doc, {
    startY: y + 6,
    head: [['Parte #', 'Descripcion', 'Marca', 'Cantidad']],
    body: materials.map((item) => [
      safe(item.partNumber),
      safe(item.description),
      safe(item.brand),
      item.quantity || 0
    ]),
    ...tableTheme()
  });

  y = doc.lastAutoTable.finalY + 9;
  if (y > 235) {
    doc.addPage();
    y = 18;
  }

  addSectionTitle(doc, 'Instrucciones y Notas', y);
  doc.setFont('DINPro', 'normal');
  doc.setTextColor(...brand.graphite);
  doc.setFontSize(9);
  const requestNotes = [
    notes || 'Favor de compartir precio, tiempo de entrega, disponibilidad, vigencia y condiciones comerciales.',
    provider.website ? `Sitio web proveedor: ${provider.website}` : ''
  ].filter(Boolean).join('\n');
  doc.text(doc.splitTextToSize(requestNotes, 182), 14, y + 10);

  doc.setFillColor(...brand.green);
  doc.rect(0, 274, 216, 5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...brand.steel);
  doc.text('Documento de solicitud de cotizacion a proveedor generado por Sistemas Mecatronicos.', 14, 270);

  const safeProviderName = safe(provider.companyName, 'proveedor').replace(/[^\w.-]+/g, '_');
  doc.save(`RFQ_${safe(quote.quoteNumber, 'quote')}_${safeProviderName}.pdf`);
}
