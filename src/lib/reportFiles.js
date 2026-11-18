// Generator file laporan tanpa dependency eksternal:
// - PDF: PDF 1.4 sederhana (Helvetica, multi-page)
// - XLSX: zip STORE berisi workbook XML (4 sheet)
// Semua data berasal dari DTO report backend.

function asciiBytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i) & 0xff;
  }
  return out;
}

function sanitizeAscii(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 110);
}

function pdfEscape(value) {
  return sanitizeAscii(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('id-ID') : '0';
}

export function buildReportLines(report, periodLabel) {
  const summary = report?.summary || {};
  const payment = report?.paymentSummary || {};
  const products = Array.isArray(report?.productSales) ? report.productSales : [];
  const categories = Array.isArray(report?.expenseSummary?.categories)
    ? report.expenseSummary.categories
    : [];

  const lines = [
    'LAPORAN PENJUALAN & KEUANGAN',
    'TEH TARIK SEROO',
    `Outlet: ${report?.outletId || '-'}`,
    `Periode: ${periodLabel}`,
    `Tipe: ${report?.period?.type || '-'}`,
    `Zona waktu: ${report?.period?.timezone || '-'}`,
    '',
    `Total Pendapatan: Rp ${money(summary.totalIncome)}`,
    `Total Pengeluaran: Rp ${money(summary.totalExpense)}`,
    `Saldo Bersih: Rp ${money(summary.netBalance)}`,
    `Jumlah Transaksi: ${summary.transactionCount ?? 0}`,
    `Jumlah Pengeluaran: ${summary.expenseCount ?? 0}`,
    '',
    'RINCIAN PEMBAYARAN',
    `CASH : ${payment.cash?.count ?? 0} trx - Rp ${money(payment.cash?.total)}`,
    `QRIS : ${payment.qris?.count ?? 0} trx - Rp ${money(payment.qris?.total)}`,
    `  Terverifikasi: ${payment.qris?.recorded?.count ?? 0} trx - Rp ${money(payment.qris?.recorded?.total)}`,
    `  Menunggu rekonsiliasi: ${payment.qris?.pendingReconciliation?.count ?? 0} trx - Rp ${money(payment.qris?.pendingReconciliation?.total)}`,
    '',
    'PENJUALAN PRODUK',
  ];

  if (products.length === 0) {
    lines.push('Tidak ada penjualan pada periode ini.');
  } else {
    products.forEach((item) => {
      lines.push(
        `${item.productName || '-'} ${item.variantName || ''} | ${item.quantity ?? 0} pcs | Rp ${money(item.total)}`,
      );
    });
  }

  lines.push('', 'PENGELUARAN PER KATEGORI');
  if (categories.length === 0) {
    lines.push('Tidak ada pengeluaran pada periode ini.');
  } else {
    categories.forEach((item) => {
      lines.push(
        `${item.categoryName || '-'} | ${item.count ?? 0} trx | Rp ${money(item.total)}`,
      );
    });
  }

  return lines;
}

export function createReportPdf(report, periodLabel) {
  const lines = buildReportLines(report, periodLabel);
  const pageSize = 56;
  const pages = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }

  const pageCount = pages.length;
  const fontObject = 3 + pageCount * 2;
  const objects = new Array(fontObject + 1);

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages
    .map((_, index) => `${3 + index * 2} 0 R`)
    .join(' ')}] /Count ${pageCount} >>`;

  pages.forEach((pageLines, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;

    let stream = 'BT\n/F1 11 Tf\n42 800 Td\n14 TL\n';
    pageLines.forEach((line) => {
      stream += `(${pdfEscape(line)}) Tj\nT*\n`;
    });
    stream += 'ET\n';
    objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  });

  objects[fontObject] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let output = '%PDF-1.4\n';
  const offsets = new Array(objects.length);
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = output.length;
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefPosition = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
  output += `startxref\n${xrefPosition}\n%%EOF\n`;

  return asciiBytes(output);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const checksum = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  });

  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  const total = centralOffset + centralSize + end.length;
  const output = new Uint8Array(total);
  let cursor = 0;
  locals.forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });
  centrals.forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });
  output.set(end, cursor);
  return output;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${reference}"><v>${value}</v></c>`;
          }
          if (value === null || value === undefined || value === '') {
            return `<c r="${reference}" t="inlineStr"><is><t></t></is></c>`;
          }
          return `<c r="${reference}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createReportXlsx(report, periodLabel) {
  const summary = report?.summary || {};
  const payment = report?.paymentSummary || {};
  const products = Array.isArray(report?.productSales) ? report.productSales : [];
  const categories = Array.isArray(report?.expenseSummary?.categories)
    ? report.expenseSummary.categories
    : [];

  const sheets = [
    [
      ['LAPORAN SEROO'],
      ['Outlet', report?.outletId || '-'],
      ['Periode', periodLabel],
      ['Tipe', report?.period?.type || '-'],
      ['Zona waktu', report?.period?.timezone || '-'],
      [],
      ['Total Pendapatan', number(summary.totalIncome)],
      ['Total Pengeluaran', number(summary.totalExpense)],
      ['Saldo Bersih', number(summary.netBalance)],
      ['Jumlah Transaksi', number(summary.transactionCount)],
      ['Jumlah Pengeluaran', number(summary.expenseCount)],
    ],
    [
      ['Metode', 'Jumlah Transaksi', 'Total (Rp)'],
      ['CASH', number(payment.cash?.count), number(payment.cash?.total)],
      ['QRIS', number(payment.qris?.count), number(payment.qris?.total)],
      ['QRIS Terverifikasi', number(payment.qris?.recorded?.count), number(payment.qris?.recorded?.total)],
      ['QRIS Menunggu', number(payment.qris?.pendingReconciliation?.count), number(payment.qris?.pendingReconciliation?.total)],
    ],
    [
      ['Produk', 'Varian', 'Qty', 'Total (Rp)'],
      ...products.map((item) => [
        item.productName || '-',
        item.variantName || '-',
        number(item.quantity),
        number(item.total),
      ]),
    ],
    [
      ['Kategori', 'Jumlah Transaksi', 'Total (Rp)'],
      ...categories.map((item) => [
        item.categoryName || '-',
        number(item.count),
        number(item.total),
      ]),
    ],
  ];

  const encoder = new TextEncoder();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheets
      .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('') +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    sheets
      .map((_, index) => {
        const names = ['Ringkasan', 'Pembayaran', 'Produk', 'Kategori'];
        return `<sheet name="${names[index]}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`;
      })
      .join('') +
    `</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
      .join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`;

  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: '_rels/.rels', data: encoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels) },
    { name: 'xl/styles.xml', data: encoder.encode(styles) },
  ];

  sheets.forEach((rows, index) => {
    files.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(sheetXml(rows)),
    });
  });

  return zipStore(files);
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes) {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const value = (first << 16) | (second << 8) | third;

    output += BASE64_CHARS[(value >> 18) & 63];
    output += BASE64_CHARS[(value >> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_CHARS[(value >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? BASE64_CHARS[value & 63] : '=';
  }
  return output;
}
