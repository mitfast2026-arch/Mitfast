import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession, unauthorizedResponse, forbiddenResponse } from '@/lib/server/auth/get-session';
import { sanitizeRichTextHtml, isEmptyRichText } from '@/lib/html/sanitize-rich-text.server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'groq/compound',
  'groq/compound-mini',
];

type RefineAction = 'polish' | 'fix_grammar' | 'structure_specs' | 'shorten' | 'expand';

function buildSystemPrompt(action: RefineAction, productName?: string): string {
  const productContext = productName ? ` Product Name: "${productName}".` : '';

  const baseInstructions = `You are an expert B2B Industrial E-Commerce Copywriter and Technical Product Specialist for MITFAST.${productContext}
Your goal is to refine and format product description content for technical buyers, procurement managers, and engineers.

CRITICAL RULES:
1. Return ONLY raw, valid HTML markup (no markdown code blocks like \`\`\`html, no preamble, no explanations, no chat greetings).
2. Use clean semantic HTML tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <u>, <s>, <blockquote>, <hr>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <a>, <img>.
3. Keep all existing hyperlinks and images intact if present.
4. Do NOT include <script>, <style>, <html>, <body>, or <head> tags.
5. Provide clear, professional, industrial-grade English.`;

  switch (action) {
    case 'fix_grammar':
      return `${baseInstructions}
TASK: Correct any spelling mistakes, punctuation errors, and grammatical awkwardness. Preserve the exact meaning, structure, lists, and formatting.`;

    case 'structure_specs':
      return `${baseInstructions}
TASK: Restructure the description into a high-converting B2B ecommerce layout:
- <h2>Overview</h2> (Brief 1-2 sentence executive summary)
- <h2>Key Features</h2> (Bullet list <ul> of key capabilities and value propositions)
- <h2>Technical Specifications</h2> (Clean bullet list or HTML table with parameters and ratings)
- <h2>Applications & Industry Use</h2> (List of industries, operating conditions, or compatible machinery)
- <h2>What's Included / Packaging</h2> (Optional if relevant)`;

    case 'shorten':
      return `${baseInstructions}
TASK: Make the product description concise, impactful, and scannable for busy procurement managers. Retain essential technical parameters and bullet points while removing filler.`;

    case 'expand':
      return `${baseInstructions}
TASK: Elaborate the product description with comprehensive technical depth, material properties, industrial standards (ISO/DIN/ASTM where relevant), durability considerations, and typical use cases.`;

    case 'polish':
    default:
      return `${baseInstructions}
TASK: Polish the product description to sound authoritative, precise, professional, and engaging for B2B buyers. Enhance clarity, flow, and formatting while keeping all existing technical specs accurate.`;
  }
}

async function callGroqWithFallback(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  let lastError: Error | null = null;

  for (const model of GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 2500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Groq model ${model} failed (${response.status}): ${errorText}`);
        lastError = new Error(`Groq ${model} status ${response.status}`);
        continue;
      }

      const json = await response.json();
      const rawContent = json.choices?.[0]?.message?.content;
      if (rawContent && typeof rawContent === 'string' && rawContent.trim()) {
        // Strip any markdown code fence wrappers if the LLM hallucinated them
        let clean = rawContent.trim();
        if (clean.startsWith('```html')) {
          clean = clean.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
        } else if (clean.startsWith('```')) {
          clean = clean.replace(/^```\s*/i, '').replace(/\s*```$/, '');
        }
        return clean.trim();
      }
    } catch (err: any) {
      console.warn(`Groq model ${model} threw error:`, err?.message || err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All Groq AI models failed');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return unauthorizedResponse();

    const role = session.profile.role;
    if (role !== 'admin' && !(role === 'supplier' && session.supplier?.status === 'active')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content : '';
    const productName = typeof body.productName === 'string' ? body.productName : '';
    const action: RefineAction = [
      'polish',
      'fix_grammar',
      'structure_specs',
      'shorten',
      'expand',
    ].includes(body.action)
      ? body.action
      : 'polish';

    if (isEmptyRichText(content)) {
      return NextResponse.json(
        { success: false, error: { message: 'Description is empty. Enter some content first.', code: 'EMPTY_CONTENT' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(action, productName);
    const userPrompt = `Here is the current description content:\n\n${content}\n\nRefine and return ONLY the resulting HTML.`;

    const rawRefinedHtml = await callGroqWithFallback([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const sanitizedHtml = sanitizeRichTextHtml(rawRefinedHtml);

    if (isEmptyRichText(sanitizedHtml)) {
      return NextResponse.json(
        { success: false, error: { message: 'AI returned empty content. Try again.', code: 'EMPTY_AI_RESULT' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        refinedHtml: sanitizedHtml,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/ai/refine-description] Error:', error instanceof Error ? error.message : 'UnknownError');
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to refine description with AI. Please try again later.',
          code: 'AI_REFINEMENT_FAILED',
        },
      },
      { status: 500 }
    );
  }
}
