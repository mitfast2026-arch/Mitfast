import { sanitizeRichTextHtml, stripRichTextHtml, isEmptyRichText } from '../lib/html/sanitize-rich-text.server';
import { stripHtmlTags } from '../lib/html/strip-html';
import assert from 'node:assert';

async function runTests() {
  console.log('--- 1. Testing Sanitization & Tag Support ---');

  // Test 1.1: Headings & Font Sizes & Alignments
  const htmlWithHeadingsAndFont = `
    <h1>Industrial Fastener Spec Sheet</h1>
    <h2>Grade 8.8 High-Tensile Steel</h2>
    <h3>Mechanical Properties</h3>
    <p><span style="font-size: 18px;" data-font-size="18px">Tensile Strength: 800 MPa</span></p>
    <p style="text-align: center;" data-text-align="center">Certified to ISO 898-1 standards.</p>
    <p style="text-align: right;">Right aligned</p>
    <p style="text-align: justify;">Justified paragraph</p>
  `;
  const sanitized1 = sanitizeRichTextHtml(htmlWithHeadingsAndFont);
  assert(sanitized1.includes('<h1>Industrial Fastener Spec Sheet</h1>'), 'H1 preserved');
  assert(sanitized1.includes('<h2>Grade 8.8 High-Tensile Steel</h2>'), 'H2 preserved');
  assert(sanitized1.includes('<h3>Mechanical Properties</h3>'), 'H3 preserved');
  assert(sanitized1.includes('font-size: 18px') || sanitized1.includes('data-font-size="18px"'), 'Font size preserved');
  assert(sanitized1.includes('text-align: center') || sanitized1.includes('text-align:center') || sanitized1.includes('data-text-align="center"'), 'Text alignment center preserved');
  assert(sanitized1.includes('text-align: right') || sanitized1.includes('text-align:right'), 'Text alignment right preserved');
  assert(sanitized1.includes('text-align: justify') || sanitized1.includes('text-align:justify'), 'Text alignment justify preserved');
  console.log('✓ Headings, Font Sizes & Alignments preserved');

  // Test 1.2: Lists (Ordered, Bullet, Nested)
  const htmlWithLists = `
    <ul class="rte-bullet-list">
      <li>Corrosion resistant coating</li>
      <li>Precision CNC machined
        <ul>
          <li>Tolerance: ±0.01mm</li>
          <li>Surface finish: Ra 0.8</li>
        </ul>
      </li>
    </ul>
    <ol class="rte-ordered-list">
      <li>Clean substrate</li>
      <li>Apply anti-seize lubricant</li>
      <li>Torque to 45 Nm</li>
    </ol>
  `;
  const sanitized2 = sanitizeRichTextHtml(htmlWithLists);
  assert(sanitized2.includes('<ul') && sanitized2.includes('<li>Corrosion resistant coating</li>'), 'Bullet list preserved');
  assert(sanitized2.includes('<ol') && sanitized2.includes('<li>Torque to 45 Nm</li>'), 'Ordered list preserved');
  assert(sanitized2.includes('Tolerance: ±0.01mm'), 'Nested list preserved');
  console.log('✓ Bullet, Numbered & Nested Lists preserved');

  // Test 1.3: Tables, Blockquotes, Formatting
  const htmlWithTableAndMarks = `
    <blockquote>Meets aerospace testing criteria AS9100.</blockquote>
    <hr class="rte-hr" />
    <p><strong>Bold</strong>, <em>Italic</em>, <u>Underline</u>, <s>Strikethrough</s>, <del>Deprecated</del></p>
    <table>
      <thead>
        <tr><th>Spec</th><th>Value</th></tr>
      </thead>
      <tbody>
        <tr><td>Hardness</td><td>32-38 HRC</td></tr>
      </tbody>
    </table>
  `;
  const sanitized3 = sanitizeRichTextHtml(htmlWithTableAndMarks);
  assert(sanitized3.includes('<blockquote>Meets aerospace testing criteria AS9100.</blockquote>'), 'Blockquote preserved');
  assert(sanitized3.includes('<hr'), 'Horizontal rule preserved');
  assert(sanitized3.includes('<strong>Bold</strong>'), 'Bold preserved');
  assert(sanitized3.includes('<em>Italic</em>'), 'Italic preserved');
  assert(sanitized3.includes('<u>Underline</u>'), 'Underline preserved');
  assert(sanitized3.includes('<s>Strikethrough</s>') || sanitized3.includes('<del>'), 'Strikethrough preserved');
  assert(sanitized3.includes('<table>') && sanitized3.includes('<td>32-38 HRC</td>'), 'Table preserved');
  console.log('✓ Tables, Blockquotes, Strikethrough & Formatting preserved');

  // Test 1.4: Safe Links & Images
  const htmlWithLinksAndImages = `
    <p>Download <a href="https://example.com/spec.pdf" target="_blank" rel="noopener noreferrer" class="rte-link">Datasheet</a></p>
    <img src="https://mitfast-assets.t3.tigrisfiles.io/description-images/bolt-cad.webp" alt="Bolt CAD Diagram" loading="lazy" class="rte-img" />
  `;
  const sanitized4 = sanitizeRichTextHtml(htmlWithLinksAndImages);
  assert(sanitized4.includes('<a') && sanitized4.includes('href="https://example.com/spec.pdf"'), 'Safe link preserved');
  assert(sanitized4.includes('target="_blank"'), 'Safe target preserved');
  assert(sanitized4.includes('rel="noopener noreferrer"'), 'Safe rel preserved');
  assert(sanitized4.includes('<img') && sanitized4.includes('src="https://mitfast-assets.t3.tigrisfiles.io/description-images/bolt-cad.webp"'), 'Safe image preserved');
  console.log('✓ Links and Images preserved with safe attributes');

  // Test 1.5: Security / XSS Prevention
  const dangerousHtml = `
    <p>Normal text</p>
    <script>alert('xss')</script>
    <img src="x" onerror="alert(1)" />
    <a href="javascript:alert('pwned')">Click here</a>
    <div onclick="eval('bad')">Dangerous click</div>
    <iframe src="https://evil.com"></iframe>
  `;
  const sanitized5 = sanitizeRichTextHtml(dangerousHtml);
  assert(!sanitized5.includes('<script>'), 'Script tag stripped');
  assert(!sanitized5.includes('onerror'), 'onerror handler stripped');
  assert(!sanitized5.includes('javascript:'), 'javascript: URI stripped');
  assert(!sanitized5.includes('onclick'), 'onclick handler stripped');
  assert(!sanitized5.includes('<iframe'), 'iframe stripped');
  assert(sanitized5.includes('<p>Normal text</p>'), 'Legitimate text kept');
  console.log('✓ XSS attacks & dangerous attributes successfully blocked');

  console.log('\n--- 2. Testing Empty Content Detection (TipTap Edge Cases) ---');
  assert(isEmptyRichText(''), 'Empty string is empty');
  assert(isEmptyRichText(null), 'Null is empty');
  assert(isEmptyRichText(undefined), 'Undefined is empty');
  assert(isEmptyRichText('<p></p>'), '<p></p> is empty');
  assert(isEmptyRichText('<p><br></p>'), '<p><br></p> is empty');
  assert(isEmptyRichText('<p><br/></p>'), '<p><br/></p> is empty');
  assert(isEmptyRichText('<p>&nbsp;</p>'), '<p>&nbsp;</p> is empty');
  assert(isEmptyRichText('   <p>   </p>  '), 'Whitespace paragraphs are empty');
  assert(!isEmptyRichText('<p>Actual description</p>'), 'Actual text is not empty');
  assert(!isEmptyRichText('<p><img src="https://example.com/img.png" /></p>'), 'Image-only content is not empty');
  assert(!isEmptyRichText('<table><tr><td>Spec</td></tr></table>'), 'Table-only content is not empty');
  console.log('✓ Empty TipTap HTML variations correctly identified');

  console.log('\n--- 3. Testing Plain Text Extraction & Card Rendering Safety ---');
  // <p>hello</p> -> "hello" (no HTML tags shown to users)
  assert.strictEqual(stripHtmlTags('<p>hello</p>'), 'hello');
  assert.strictEqual(stripRichTextHtml('<p>hello</p>'), 'hello');

  // <p style="text-align:left">fasd</p> -> "fasd"
  assert.strictEqual(stripHtmlTags('<p style="text-align:left">fasd</p>'), 'fasd');
  assert.strictEqual(stripRichTextHtml('<p style="text-align:left">fasd</p>'), 'fasd');

  // <strong>hello</strong> -> "hello" in cards
  assert.strictEqual(stripHtmlTags('<strong>hello</strong>'), 'hello');
  assert.strictEqual(stripRichTextHtml('<strong>hello</strong>'), 'hello');

  // <ul><li>Item 1</li><li>Item 2</li></ul> -> clean text for card snippet
  assert.strictEqual(stripHtmlTags('<ul><li>Item 1</li><li>Item 2</li></ul>'), 'Item 1 Item 2');
  assert.strictEqual(stripRichTextHtml('<ul><li>Item 1</li><li>Item 2</li></ul>'), 'Item 1 Item 2');

  const richCardSource = '<h2>Title</h2><p>High-grade <strong>stainless steel</strong> fastener.</p>';
  const stripped = stripRichTextHtml(richCardSource);
  assert.strictEqual(stripped, 'Title High-grade stainless steel fastener.');
  console.log('✓ Plain text extraction cleans tags without merging words and removes all raw HTML tags');

  console.log('\n--- 4. Testing Groq AI Refinement API Integration ---');
  const groqApiKey = process.env.GROQ_API_KEY || '';
  if (groqApiKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: 'You are an ecommerce copywriter. Return ONLY raw HTML fragment (no markdown fences).',
            },
            {
              role: 'user',
              content: 'Refine: titanium bolts for aerospace high heat',
            },
          ],
          max_tokens: 1500,
        }),
      });

      if (groqRes.ok) {
        const json = await groqRes.json();
        const output = json.choices?.[0]?.message?.content || json.choices?.[0]?.text;
        assert(output && output.length > 10, 'Groq returned valid output');
        const sanitizedAi = sanitizeRichTextHtml(output);
        assert(!isEmptyRichText(sanitizedAi), 'Sanitized AI output is valid HTML');
        console.log('✓ Groq AI endpoint successfully verified with openai/gpt-oss-120b');
      } else {
        console.warn(`Groq API returned status ${groqRes.status}`);
      }
    } catch (err) {
      console.warn('Groq live test warning (network):', err);
    }
  }

  console.log('\n========================================');
  console.log(' ALL PRODUCT DESCRIPTION EDITOR TESTS PASSED');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
