import { NextRequest, NextResponse } from 'next/server';

type PdfParseFunction = (buffer: Buffer) => Promise<{ text: string }>;
let pdfParse: PdfParseFunction | null = null;

async function getPdfParser(): Promise<PdfParseFunction> {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse');
      pdfParse = (pdfParseModule.default || pdfParseModule) as PdfParseFunction;
    } catch {
      throw new Error('pdf-parse is not installed. Please run: npm install pdf-parse');
    }
  }
  return pdfParse;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Valid PDF file required' }, { status: 400 });
    }

    const parser = await getPdfParser();
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await parser(buffer);
    const text = data.text?.trim();

    if (!text) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse PDF.' },
      { status: 500 }
    );
  }
}

