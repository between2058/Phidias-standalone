import { NextRequest, NextResponse } from 'next/server';

// ── VLM configuration via environment variables ──────────────────────────────
const VLM_API_URL = process.env.VLM_API_URL ?? '';
const VLM_API_KEY = process.env.VLM_API_KEY ?? '';
const VLM_MODEL = process.env.VLM_MODEL ?? 'gpt-4o';

function isAnthropic(): boolean {
    return VLM_API_URL.includes('anthropic');
}

// ── Color helpers ────────────────────────────────────────────────────────────

function hexToReadableName(hex: string): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);

    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h2 = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h2 = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        else if (max === gn) h2 = ((bn - rn) / d + 2) * 60;
        else h2 = ((rn - gn) / d + 4) * 60;
    }

    if (l < 0.12) return 'black';
    if (l > 0.9 && s < 0.1) return 'white';
    if (s < 0.1) return l > 0.6 ? 'light gray' : 'dark gray';

    const names: [number, number, string][] = [
        [0, 15, 'red'], [15, 40, 'orange'], [40, 65, 'yellow'],
        [65, 170, 'green'], [170, 200, 'cyan'], [200, 260, 'blue'],
        [260, 290, 'purple'], [290, 330, 'pink'], [330, 360, 'red'],
    ];
    const colorName = names.find(([lo, hi]) => h2 >= lo && h2 < hi)?.[2] ?? 'unknown';
    const prefix = l < 0.35 ? 'dark ' : l > 0.7 ? 'bright ' : '';
    return prefix + colorName;
}

// ── Image processing ─────────────────────────────────────────────────────────

interface ImageData {
    base64: string;
    mime: string;
}

async function fileToBase64(file: File): Promise<ImageData> {
    const buf = Buffer.from(await file.arrayBuffer());
    return { base64: buf.toString('base64'), mime: file.type || 'image/png' };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        if (!VLM_API_URL || !VLM_API_KEY) {
            return NextResponse.json(
                { error: 'VLM not configured. Set VLM_API_URL and VLM_API_KEY in .env' },
                { status: 500 },
            );
        }

        const formData = await request.formData();
        const partsJson = formData.get('parts') as string | null;
        const anglesJson = formData.get('angles') as string | null;

        if (!partsJson) {
            return NextResponse.json({ error: 'Missing parts data' }, { status: 400 });
        }

        const parts: { id: string; color: string }[] = JSON.parse(partsJson);
        const angleLabels: string[] = anglesJson ? JSON.parse(anglesJson) : [];

        // Collect multi-view images
        const originalFiles = formData.getAll('original') as File[];
        const coloredFiles = formData.getAll('colored') as File[];

        if (originalFiles.length === 0 && coloredFiles.length === 0) {
            return NextResponse.json({ error: 'No screenshots provided' }, { status: 400 });
        }

        const originalImages = await Promise.all(originalFiles.map(fileToBase64));
        const coloredImages = await Promise.all(coloredFiles.map(fileToBase64));

        // Build color legend
        const colorLegend = parts.map(p => {
            const readableName = hexToReadableName(p.color);
            return `  - "${p.id}" → ${readableName} (${p.color})`;
        }).join('\n');

        // Build angle descriptions
        const angleDesc = angleLabels.length > 0
            ? `from ${angleLabels.length} different viewing angles: ${angleLabels.join(', ')}`
            : 'from multiple viewing angles';

        const system = [
            'You are a 3D model part analyst. You receive multi-angle screenshots of a 3D model in two modes:',
            '1. ORIGINAL TEXTURE — showing the real materials and textures of the model',
            '2. COLOR-CODED — where each segmented part is rendered in a distinct flat color',
            '',
            'Your task: cross-reference the two sets of images to identify what each colored part represents,',
            'then name and group the parts based on the real-world object you see in the original texture images.',
            '',
            'You MUST return ONLY a valid JSON array. No markdown, no explanation, no extra text.',
        ].join('\n');

        const user = [
            `This 3D model has ${parts.length} segmented parts, shown ${angleDesc}.`,
            '',
            'The FIRST set of images shows the ORIGINAL TEXTURES — use these to understand WHAT the object is',
            'and what each region looks like (material, shape, function).',
            '',
            'The SECOND set of images shows the same model with COLOR-CODED PARTS — each part is a flat color.',
            'Use these to understand WHERE each part is and match colors to part IDs.',
            '',
            'Color legend (part ID → color in the coded images):',
            colorLegend,
            '',
            'Instructions:',
            '1. First, identify what the overall 3D object is (e.g. a chair, a car, a character).',
            '2. Look at the original texture images to understand each region\'s real-world function.',
            '3. Look at the color-coded images to identify which colored region corresponds to which part ID.',
            '4. Cross-reference: match each color-coded region to its real-world name from the texture views.',
            '5. Group related parts (e.g. all legs → "Legs", body panels → "Body").',
            '',
            'Output — return ONLY this JSON array:',
            `[{"id":"${parts[0]?.id ?? 'part_0'}","name":"<descriptive name>","group":"<group name>"},...]`,
            '',
            'Rules:',
            '- Use short, descriptive English names (2-4 words max)',
            '- Group names: broad categories (e.g. "Legs", "Body", "Head", "Base", "Accessories")',
            '- Same-type parts MUST share a group (e.g. 4 legs → "Legs")',
            '- Symmetric parts share a group (e.g. "Left Arm" + "Right Arm" → "Arms")',
            `- Include ALL ${parts.length} parts — do not skip any`,
            '- Use multiple viewing angles to identify parts that may be hidden from one view',
            '- Return ONLY the JSON array',
        ].join('\n');

        console.log(`[smart-organize] VLM config — URL: ${VLM_API_URL}, model: ${VLM_MODEL}, isAnthropic: ${isAnthropic()}`);
        console.log(`[smart-organize] Input — ${parts.length} parts, ${originalImages.length} original imgs, ${coloredImages.length} colored imgs, angles: [${angleLabels.join(', ')}]`);
        console.log(`[smart-organize] Image sizes — original: [${originalImages.map(i => `${(i.base64.length / 1024).toFixed(0)}KB`).join(', ')}], colored: [${coloredImages.map(i => `${(i.base64.length / 1024).toFixed(0)}KB`).join(', ')}]`);

        // Try up to 2 times
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                console.log(`[smart-organize] attempt ${attempt + 1} — calling VLM...`);
                const raw = isAnthropic()
                    ? await callAnthropic(originalImages, coloredImages, angleLabels, system, user)
                    : await callOpenAICompat(originalImages, coloredImages, angleLabels, system, user);

                console.log(`[smart-organize] attempt ${attempt + 1} — raw response (${raw.length} chars):`);
                console.log(`[smart-organize] >>>START>>>\n${raw}\n<<<END<<<`);

                const result = extractAndValidate(raw, parts);
                console.log(`[smart-organize] SUCCESS — ${result.length} parts returned`);
                return NextResponse.json({ parts: result });
            } catch (err: any) {
                lastError = err;
                console.warn(`[smart-organize] attempt ${attempt + 1} failed:`, err.message);
            }
        }

        throw lastError ?? new Error('Smart organize failed after retries');
    } catch (err: any) {
        console.error('[smart-organize]', err);
        return NextResponse.json(
            { error: err.message || 'Smart organize failed' },
            { status: 500 },
        );
    }
}

// ── Response parsing & validation ────────────────────────────────────────────

function extractAndValidate(
    rawText: string,
    inputParts: { id: string; color: string }[],
): { id: string; name: string; group: string }[] {
    const parsed = extractJson(rawText);

    if (!Array.isArray(parsed)) {
        throw new Error('VLM response is not an array');
    }

    const inputIds = new Set(inputParts.map(p => p.id));
    const resultMap = new Map<string, { name: string; group: string }>();

    for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const id = String(item.id ?? '');
        const name = String(item.name ?? '').trim();
        const group = String(item.group ?? '').trim();
        if (id && inputIds.has(id) && name) {
            resultMap.set(id, { name, group: group || 'Ungrouped' });
        }
    }

    // Fill in missing parts with fallback names
    const result: { id: string; name: string; group: string }[] = [];
    for (const p of inputParts) {
        const match = resultMap.get(p.id);
        if (match) {
            result.push({ id: p.id, ...match });
        } else {
            const idx = inputParts.indexOf(p);
            const colorName = hexToReadableName(p.color);
            result.push({
                id: p.id,
                name: `Part ${idx + 1} (${colorName})`,
                group: 'Ungrouped',
            });
        }
    }

    return result;
}

function extractJson(text: string): any[] {
    const trimmed = text.trim();
    console.log(`[smart-organize:extractJson] input length: ${trimmed.length}, starts with: "${trimmed.slice(0, 80)}..."`);

    if (trimmed.startsWith('[')) {
        try { return JSON.parse(trimmed); } catch (e: any) {
            console.warn(`[smart-organize:extractJson] direct parse failed:`, e.message);
        }
    }

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        console.log(`[smart-organize:extractJson] found fenced block (${fenceMatch[1].trim().length} chars)`);
        try { return JSON.parse(fenceMatch[1].trim()); } catch (e: any) {
            console.warn(`[smart-organize:extractJson] fence parse failed:`, e.message);
        }
    }

    let depth = 0, start = -1;
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '[') { if (depth === 0) start = i; depth++; }
        else if (trimmed[i] === ']') {
            depth--;
            if (depth === 0 && start >= 0) {
                const candidate = trimmed.slice(start, i + 1);
                try { return JSON.parse(candidate); } catch (e: any) {
                    console.warn(`[smart-organize:extractJson] bracket extraction failed at [${start}:${i + 1}]:`, e.message);
                }
            }
        }
    }

    console.error(`[smart-organize:extractJson] ALL extraction methods failed. Full text:\n${trimmed}`);
    throw new Error('No valid JSON array found in VLM response');
}

// ── Build multi-image content blocks ─────────────────────────────────────────

function buildImageContentOpenAI(
    originalImages: ImageData[],
    coloredImages: ImageData[],
    angleLabels: string[],
): any[] {
    const content: any[] = [];

    // Original texture images first
    content.push({ type: 'text', text: '--- ORIGINAL TEXTURE VIEWS ---' });
    for (let i = 0; i < originalImages.length; i++) {
        const label = angleLabels[i] ?? `angle ${i + 1}`;
        content.push({ type: 'text', text: `[Original — ${label}]` });
        content.push({
            type: 'image_url',
            image_url: { url: `data:${originalImages[i].mime};base64,${originalImages[i].base64}` },
        });
    }

    // Then color-coded images
    content.push({ type: 'text', text: '--- COLOR-CODED PART VIEWS ---' });
    for (let i = 0; i < coloredImages.length; i++) {
        const label = angleLabels[i] ?? `angle ${i + 1}`;
        content.push({ type: 'text', text: `[Color-coded — ${label}]` });
        content.push({
            type: 'image_url',
            image_url: { url: `data:${coloredImages[i].mime};base64,${coloredImages[i].base64}` },
        });
    }

    return content;
}

function buildImageContentAnthropic(
    originalImages: ImageData[],
    coloredImages: ImageData[],
    angleLabels: string[],
): any[] {
    const content: any[] = [];

    content.push({ type: 'text', text: '--- ORIGINAL TEXTURE VIEWS ---' });
    for (let i = 0; i < originalImages.length; i++) {
        const label = angleLabels[i] ?? `angle ${i + 1}`;
        content.push({ type: 'text', text: `[Original — ${label}]` });
        content.push({
            type: 'image',
            source: { type: 'base64', media_type: originalImages[i].mime, data: originalImages[i].base64 },
        });
    }

    content.push({ type: 'text', text: '--- COLOR-CODED PART VIEWS ---' });
    for (let i = 0; i < coloredImages.length; i++) {
        const label = angleLabels[i] ?? `angle ${i + 1}`;
        content.push({ type: 'text', text: `[Color-coded — ${label}]` });
        content.push({
            type: 'image',
            source: { type: 'base64', media_type: coloredImages[i].mime, data: coloredImages[i].base64 },
        });
    }

    return content;
}

// ── Anthropic Messages API ──────────────────────────────────────────────────

async function callAnthropic(
    originalImages: ImageData[],
    coloredImages: ImageData[],
    angleLabels: string[],
    system: string,
    user: string,
): Promise<string> {
    const url = VLM_API_URL.replace(/\/+$/, '');
    const endpoint = url.endsWith('/messages') ? url : `${url}/v1/messages`;

    const imageContent = buildImageContentAnthropic(originalImages, coloredImages, angleLabels);

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': VLM_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: VLM_MODEL,
            max_tokens: 16384,
            temperature: 0.2,
            system,
            messages: [
                {
                    role: 'user',
                    content: [
                        ...imageContent,
                        { type: 'text', text: user },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
}

// ── OpenAI-compatible chat completions ──────────────────────────────────────

async function callOpenAICompat(
    originalImages: ImageData[],
    coloredImages: ImageData[],
    angleLabels: string[],
    system: string,
    user: string,
): Promise<string> {
    const url = VLM_API_URL.replace(/\/+$/, '');
    const endpoint = url.endsWith('/chat/completions')
        ? url
        : `${url}/chat/completions`;

    const imageContent = buildImageContentOpenAI(originalImages, coloredImages, angleLabels);

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VLM_API_KEY}`,
        },
        body: JSON.stringify({
            model: VLM_MODEL,
            max_tokens: 16384,
            temperature: 0.2,
            messages: [
                { role: 'system', content: system },
                {
                    role: 'user',
                    content: [
                        ...imageContent,
                        { type: 'text', text: user },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        console.error(`[smart-organize] VLM API error ${res.status}:`, errBody);
        throw new Error(`VLM API ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    console.log(`[smart-organize] VLM response keys:`, JSON.stringify(Object.keys(data)));
    console.log(`[smart-organize] VLM choices[0]:`, JSON.stringify(data.choices?.[0], null, 2)?.slice(0, 500));

    const choice = data.choices?.[0];
    let content = choice?.message?.content ?? '';

    // Reasoning models (e.g. kimi-k2.5) put chain-of-thought in `reasoning`
    // and may leave `content` null if they run out of output tokens.
    // Try to extract JSON from the reasoning field as a fallback.
    if (!content) {
        const reasoning = choice?.reasoning ?? choice?.message?.reasoning_content ?? '';
        if (reasoning) {
            console.warn(`[smart-organize] content is null, attempting to extract JSON from reasoning field (${reasoning.length} chars)`);
            try {
                extractJson(reasoning);
                // If extractJson succeeds, use reasoning as the content
                content = reasoning;
            } catch {
                console.warn(`[smart-organize] no JSON found in reasoning field either`);
            }
        }
        if (!content) {
            console.warn(`[smart-organize] VLM returned empty content. Full response:`, JSON.stringify(data).slice(0, 1000));
        }
    }
    return content;
}
