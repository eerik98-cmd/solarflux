import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// ─── DOCX XML helpers ────────────────────────────────────────────────────────

/** Walk all <w:p> in document order, returning start/end offsets + plain text */
function extractDocxParagraphs(docXml: string) {
  const results: Array<{ start: number; end: number; text: string }> = [];
  const re = /<w:p[ >]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(docXml)) !== null) {
    const start = match.index;
    const close = docXml.indexOf('</w:p>', start);
    if (close === -1) continue;
    const end = close + 6; // '</w:p>'.length
    results.push({ start, end, text: getWtText(docXml.slice(start, end)) });
  }
  return results;
}

/** Concatenate all <w:t> text inside an XML fragment */
function getWtText(xml: string): string {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map(m => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
    .join('');
}

/** Extract <w:pPr>...</w:pPr> block from paragraph XML, or '' */
function getPpr(xml: string): string {
  const m = xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  return m ? m[0] : '';
}

/** Extract the first run's <w:rPr>...</w:rPr>, or '' */
function getFirstRpr(xml: string): string {
  const m = xml.match(/<w:r[ >][\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/);
  return m ? `<w:rPr>${m[1]}</w:rPr>` : '';
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function encodeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Convert HTML inline content into DOCX <w:r> run XML.
 * Inherits baseRpr (original run properties: font, size, color).
 * Applies bold/italic/underline from HTML tags as OOXML properties.
 */
function buildRunsFromHtml(innerHtml: string, baseRpr: string): string {
  interface Seg { text: string; b: boolean; i: boolean; u: boolean }
  const segs: Seg[] = [];
  const tagRe = /<(\/?)((strong|b|em|i|u|span|a|code)[^>]*)>/gi;
  const stack: Array<{ b: boolean; i: boolean; u: boolean }> = [];
  let cur = { b: false, i: false, u: false };
  let last = 0;
  let tm: RegExpExecArray | null;

  // flatten block tags to plain text flow; convert <br> to newline
  const flat = innerHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|ul|ol|li|table|tr|td|th|thead|tbody)[^>]*>/gi, '');

  while ((tm = tagRe.exec(flat)) !== null) {
    if (tm.index > last) {
      const t = decodeEntities(flat.slice(last, tm.index));
      if (t) segs.push({ ...cur, text: t });
    }
    last = tm.index + tm[0].length;
    const closing = tm[1] === '/';
    const tag = tm[2].replace(/\s.*/, '').toLowerCase();
    if (!closing) {
      stack.push({ ...cur });
      if (tag === 'strong' || tag === 'b') cur = { ...cur, b: true };
      else if (tag === 'em' || tag === 'i')  cur = { ...cur, i: true };
      else if (tag === 'u')                  cur = { ...cur, u: true };
    } else {
      cur = stack.pop() ?? { b: false, i: false, u: false };
    }
  }
  if (last < flat.length) {
    const t = decodeEntities(flat.slice(last));
    if (t) segs.push({ ...cur, text: t });
  }

  if (segs.length === 0) {
    return `<w:r>${baseRpr}<w:t xml:space="preserve"></w:t></w:r>`;
  }

  return segs.map(({ text, b, i, u }) => {
    let rpr = baseRpr;
    if (b || i || u) {
      const add = [
        b ? '<w:b/><w:bCs/>' : '',
        i ? '<w:i/><w:iCs/>' : '',
        u ? '<w:u w:val="single"/>' : '',
      ].join('');
      rpr = rpr
        ? rpr.replace('</w:rPr>', `${add}</w:rPr>`)
        : `<w:rPr>${add}</w:rPr>`;
    }
    const encoded = encodeXml(text);
    const space   = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
    return `<w:r>${rpr}<w:t${space}>${encoded}</w:t></w:r>`;
  }).join('');
}

/**
 * Rebuild a single paragraph: keep <w:pPr> and first-run <w:rPr> from original,
 * replace run content with content derived from the edited HTML block.
 */
function patchParagraph(paraXml: string, newInnerHtml: string): string {
  const openTagMatch = paraXml.match(/^(<w:p[^>]*>)/);
  const openTag = openTagMatch ? openTagMatch[1] : '<w:p>';
  return `${openTag}${getPpr(paraXml)}${buildRunsFromHtml(newInnerHtml, getFirstRpr(paraXml))}</w:p>`;
}

// ─── HTML block extraction ───────────────────────────────────────────────────

/**
 * Extract block-level elements (<p>, <h1>-<h6>, <li>) from HTML in document order.
 * These map 1-to-1 with DOCX <w:p> elements because mammoth converts them that way.
 */
function extractHtmlBlocks(html: string): Array<{ text: string; innerHtml: string }> {
  const blocks: Array<{ text: string; innerHtml: string }> = [];
  const re = /<(p|h[1-6]|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const innerHtml = m[3] ?? '';
    const text = innerHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    blocks.push({ text, innerHtml });
  }
  return blocks;
}

/**
 * Patch a DOCX file with edited HTML content.
 * Surgically updates <w:p> text runs in word/document.xml while preserving
 * ALL original styles, fonts, images, tables, headers, footers, and page layout.
 *
 * POST /api/convert-html-to-docx
 * Body: { htmlBase64: string, originalDocxBase64: string }
 * Returns: { docxBase64: string, size: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { htmlBase64, originalDocxBase64 } = await request.json();

    if (!htmlBase64 || !originalDocxBase64) {
      return NextResponse.json({ error: 'Missing required fields: htmlBase64 and originalDocxBase64' }, { status: 400 });
    }

    const editedHtml = Buffer.from(htmlBase64, 'base64').toString('utf-8');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PizZip = require('pizzip');
    const origZip = new PizZip(Buffer.from(originalDocxBase64, 'base64'));

    let docXml: string = origZip.file('word/document.xml').asText();

    const docxParas  = extractDocxParagraphs(docXml);
    const htmlBlocks = extractHtmlBlocks(editedHtml);

    // Build patches for paragraphs whose text has changed (or gained inline formatting)
    const patches: Array<{ start: number; end: number; newXml: string }> = [];
    const len = Math.min(docxParas.length, htmlBlocks.length);

    for (let i = 0; i < len; i++) {
      const para  = docxParas[i];
      const block = htmlBlocks[i];
      const textChanged     = para.text.trim() !== block.text;
      const hasInlineFormat = /<(strong|b|em|i|u)\b/i.test(block.innerHtml);

      if (textChanged || hasInlineFormat) {
        patches.push({
          start:  para.start,
          end:    para.end,
          newXml: patchParagraph(docXml.slice(para.start, para.end), block.innerHtml),
        });
      }
    }

    // Apply patches from end → start so earlier offsets stay valid
    patches.sort((a, b) => b.start - a.start);
    for (const p of patches) {
      docXml = docXml.slice(0, p.start) + p.newXml + docXml.slice(p.end);
    }

    origZip.file('word/document.xml', docXml);
    const finalBuffer: Buffer = origZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    return NextResponse.json({
      docxBase64: finalBuffer.toString('base64'),
      size: finalBuffer.length,
    });

  } catch (error) {
    console.error('DOCX patch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
