import { NextRequest, NextResponse } from 'next/server';

// Dynamic import for pdf-parse to avoid issues with server-side rendering
type PdfParseFunction = (buffer: Buffer) => Promise<{ text: string }>;
let pdfParse: PdfParseFunction | null = null;

async function getPdfParser(): Promise<PdfParseFunction> {
  if (!pdfParse) {
    try {
      // pdf-parse can export differently, handle both cases
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
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    // Parse PDF using pdf-parse
    const parser = await getPdfParser();
    if (!parser) {
      return NextResponse.json({ error: 'PDF parser failed to initialize' }, { status: 500 });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const data = await parser(buffer);
    const text = data.text;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse PDF. Please ensure pdf-parse is installed: npm install pdf-parse' },
      { status: 500 }
    );
  }
}

