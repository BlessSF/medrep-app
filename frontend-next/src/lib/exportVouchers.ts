// Builds one Excel workbook with a Summary tab plus one tab per voucher,
// coloured in the branch theme (HERO red, DOIS orange, STELLA green).
// ExcelJS is loaded on demand so it never weighs down the normal page load.

export type ExportItem = {
  series_no: number;
  date_given: string | null;
  customer_name: string;
  redeemed_by: string;
  payment_mode: string;
  remarks: string;
  date_availed: string | null;
  note: string;
};
export type ExportVoucher = { name: string; beginning: number; items: ExportItem[] };

const THEMES: Record<string, string> = {
  HERO: 'C0392B',   // red
  DOIS: 'D9640F',   // orange
  STELLA: '2D6A4F', // green
};
const FALLBACK = '2D6A4F';

const hexToRgb = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
// Mix a colour with white; amount 0 = white, 1 = the colour itself.
const tint = (hex: string, amount: number) =>
  hexToRgb(hex).map((c) => Math.round(255 - (255 - c) * amount).toString(16).padStart(2, '0')).join('').toUpperCase();

const isGivenOut = (i?: ExportItem) => !!i && (!!i.date_given || i.customer_name.trim() !== '');
const toDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
};

export async function exportVouchersWorkbook(branch: string | null, vouchers: ExportVoucher[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const main = THEMES[(branch || '').toUpperCase()] || FALLBACK;
  const soft = tint(main, 0.1);
  const mid = tint(main, 0.22);
  const WHITE = 'FFFFFFFF';
  const argb = (h: string) => 'FF' + h;
  const fill = (h: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: argb(h) } });
  const line = { style: 'thin' as const, color: { argb: 'FFE4DDD3' } };
  const box = { top: line, left: line, bottom: line, right: line };
  const font = (o: object = {}) => ({ name: 'Calibri', size: 11, color: { argb: 'FF241C15' }, ...o });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MEDREP';
  wb.created = new Date();

  const stamp = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const title = (ws: any, text: string, sub: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    ws.mergeCells(2, 1, 2, cols);
    const t = ws.getCell(1, 1);
    t.value = text; t.font = font({ size: 18, bold: true, color: { argb: WHITE } });
    t.fill = fill(main); t.alignment = { vertical: 'middle', indent: 1 };
    const s = ws.getCell(2, 1);
    s.value = sub; s.font = font({ size: 10, color: { argb: 'FF6B5E52' } });
    s.fill = fill(soft); s.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 34; ws.getRow(2).height = 20;
    for (let c = 2; c <= cols; c++) { ws.getCell(1, c).fill = fill(main); ws.getCell(2, c).fill = fill(soft); }
  };
  const headerRow = (ws: any, rowNo: number, labels: string[]) => {
    const r = ws.getRow(rowNo);
    labels.forEach((l, i) => {
      const c = r.getCell(i + 1);
      c.value = l; c.font = font({ bold: true, color: { argb: WHITE } });
      c.fill = fill(main); c.border = box;
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    });
    r.height = 26;
  };

  // Summary is created first so it is the first tab; it is filled in once the vouchers are counted.
  const sum = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: argb(main) } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  // ---------- one tab per voucher ----------
  const names = new Set<string>(['Summary']);
  const rows: { name: string; beginning: number; out: number; availed: number; sheet: string }[] = [];

  for (const v of vouchers) {
    const map = new Map<number, ExportItem>();
    v.items.forEach((i) => map.set(i.series_no, i));
    const pad = Math.max(3, String(v.beginning).length);

    let sheetName = v.name.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Voucher';
    let n = 2;
    while (names.has(sheetName.toLowerCase()) || names.has(sheetName)) sheetName = `${sheetName.slice(0, 28)} ${n++}`;
    names.add(sheetName);

    const ws = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: argb(main) } },
      views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });
    ws.columns = [
      { width: 11 }, { width: 14 }, { width: 18 }, { width: 28 }, { width: 24 },
      { width: 17 }, { width: 16 }, { width: 18 }, { width: 28 },
    ];

    let out = 0, availed = 0;
    for (let s = 1; s <= v.beginning; s++) {
      const it = map.get(s);
      if (it?.date_availed) availed++;
      if (isGivenOut(it)) out++;
    }
    title(ws, v.name.toUpperCase(), `Voucher Monitoring  ·  ${branch || 'All branches'}  ·  Exported ${stamp}`, 9);

    // stat tiles on rows 4-5
    const tiles: [string, number, string][] = [
      ['BEGINNING', v.beginning, '1F1A15'], ['GIVEN OUT', out, 'A96A0C'],
      ['AVAILED', availed, '2E7D4F'], ['IN STOCK', v.beginning - out, '1F1A15'],
    ];
    const tileCols: [number, number][] = [[1, 2], [3, 4], [5, 6], [7, 9]];
    tiles.forEach(([label, value, color], i) => {
      const [c1, c2] = tileCols[i];
      ws.mergeCells(4, c1, 4, c2); ws.mergeCells(5, c1, 5, c2);
      const l = ws.getCell(4, c1), val = ws.getCell(5, c1);
      l.value = label; l.font = font({ size: 9, bold: true, color: { argb: 'FF7A6C5F' } });
      val.value = value; val.numFmt = '#,##0'; val.font = font({ size: 20, bold: true, color: { argb: argb(color) } });
      for (let c = c1; c <= c2; c++) {
        ws.getCell(4, c).fill = fill('FAF7F2'); ws.getCell(5, c).fill = fill('FAF7F2');
        ws.getCell(4, c).border = { top: line, left: c === c1 ? line : undefined, right: c === c2 ? line : undefined };
        ws.getCell(5, c).border = { bottom: line, left: c === c1 ? line : undefined, right: c === c2 ? line : undefined };
      }
      l.alignment = { vertical: 'bottom', horizontal: 'left', indent: 1 }; val.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    });
    ws.getRow(4).height = 18; ws.getRow(5).height = 32;

    headerRow(ws, 8, ['Series no.', 'Status', 'Date given', 'Customer name', 'Redeemed by', 'Payment', 'Remarks', 'Date availed', 'Note (c/o Acctng)']);

    for (let s = 1; s <= v.beginning; s++) {
      const it = map.get(s);
      const state = it?.date_availed ? 'Availed' : isGivenOut(it) ? 'Given out' : 'In stock';
      const r = ws.getRow(8 + s);
      r.values = [
        String(s).padStart(pad, '0'), state, toDate(it?.date_given || null),
        it?.customer_name || '', it?.redeemed_by || '', it?.payment_mode || '', it?.remarks || '',
        toDate(it?.date_availed || null), it?.note || '',
      ];
      const band = s % 2 === 0 ? 'FFF9F6F1' : WHITE;
      r.eachCell({ includeEmpty: true }, (c: any, col: number) => {
        c.font = font({ size: 10.5 });
        c.border = box;
        c.fill = fill(band.slice(2));
        c.alignment = { vertical: 'middle', indent: 1, horizontal: 'left' };
        if (col === 3 || col === 8) c.numFmt = 'mmm d, yyyy';
      });
      const sc = r.getCell(1); sc.font = font({ size: 10.5, bold: true, name: 'Consolas' });
      const st = r.getCell(2); st.alignment = { vertical: 'middle', horizontal: 'center' };
      if (state === 'Availed') { st.fill = fill('E7F4EC'); st.font = font({ size: 10.5, bold: true, color: { argb: 'FF2E7D4F' } }); }
      else if (state === 'Given out') { st.fill = fill('FCF0D6'); st.font = font({ size: 10.5, bold: true, color: { argb: 'FFA96A0C' } }); }
      else { st.font = font({ size: 10.5, color: { argb: 'FF8A7D70' } }); }
      r.height = 20;
    }
    ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8 + Math.max(1, v.beginning), column: 9 } };
    ws.pageSetup.printTitlesRow = '8:8';
    rows.push({ name: v.name, beginning: v.beginning, out, availed, sheet: sheetName });
  }

  // ---------- fill the Summary tab ----------
  sum.columns = [{ width: 34 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }];
  title(sum, 'VOUCHER SUMMARY', `${branch || 'All branches'}  ·  ${rows.length} voucher${rows.length === 1 ? '' : 's'}  ·  Exported ${stamp}`, 7);
  headerRow(sum, 4, ['Voucher', 'Beginning', 'Given out', 'Availed', 'In stock', '% given out', '% availed']);
  [2, 3, 4, 5, 6, 7].forEach((c) => { sum.getRow(4).getCell(c).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }; });

  rows.forEach((v, i) => {
    const rn = 5 + i;
    const r = sum.getRow(rn);
    r.getCell(1).value = { text: v.name, hyperlink: `#'${v.sheet.replace(/'/g, "''")}'!A1` } as any;
    r.getCell(2).value = v.beginning;
    r.getCell(3).value = v.out;
    r.getCell(4).value = v.availed;
    r.getCell(5).value = { formula: `B${rn}-C${rn}`, result: v.beginning - v.out } as any;
    r.getCell(6).value = { formula: `IF(B${rn}=0,0,C${rn}/B${rn})`, result: v.beginning ? v.out / v.beginning : 0 } as any;
    r.getCell(7).value = { formula: `IF(C${rn}=0,0,D${rn}/C${rn})`, result: v.out ? v.availed / v.out : 0 } as any;
    r.eachCell({ includeEmpty: true }, (c: any, col: number) => {
      c.font = font(); c.border = box; c.fill = fill(i % 2 ? 'F9F6F1' : 'FFFFFF');
      c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right', indent: 1 };
      if (col >= 2 && col <= 5) c.numFmt = '#,##0';
      if (col >= 6) c.numFmt = '0%';
    });
    r.getCell(1).font = font({ bold: true, color: { argb: argb(main) }, underline: true });
    r.getCell(3).font = font({ bold: true, color: { argb: 'FFA96A0C' } });
    r.getCell(4).font = font({ bold: true, color: { argb: 'FF2E7D4F' } });
    r.height = 22;
  });
  if (rows.length) {
    const first = 5, last = 4 + rows.length, tr = last + 1;
    const t = sum.getRow(tr);
    t.getCell(1).value = 'TOTAL';
    (['B', 'C', 'D'] as const).forEach((col, k) => {
      const tot = rows.reduce((a, v) => a + (k === 0 ? v.beginning : k === 1 ? v.out : v.availed), 0);
      t.getCell(2 + k).value = { formula: `SUM(${col}${first}:${col}${last})`, result: tot } as any;
    });
    const tb = rows.reduce((a, v) => a + v.beginning, 0), to = rows.reduce((a, v) => a + v.out, 0), ta = rows.reduce((a, v) => a + v.availed, 0);
    t.getCell(5).value = { formula: `B${tr}-C${tr}`, result: tb - to } as any;
    t.getCell(6).value = { formula: `IF(B${tr}=0,0,C${tr}/B${tr})`, result: tb ? to / tb : 0 } as any;
    t.getCell(7).value = { formula: `IF(C${tr}=0,0,D${tr}/C${tr})`, result: to ? ta / to : 0 } as any;
    t.eachCell({ includeEmpty: true }, (c: any, col: number) => {
      c.font = font({ bold: true, size: 12 }); c.fill = fill(mid);
      c.border = { top: { style: 'medium', color: { argb: argb(main) } }, bottom: line, left: line, right: line };
      c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right', indent: 1 };
      if (col >= 2 && col <= 5) c.numFmt = '#,##0';
      if (col >= 6) c.numFmt = '0%';
    });
    t.height = 26;
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(branch || 'MEDREP').toUpperCase()}_Vouchers_${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}