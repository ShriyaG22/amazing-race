import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { city, numLegs } = await req.json();
    
    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const n = numLegs ? parseInt(numLegs) : null;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: 'You are a JSON API that designs Amazing Race games. Respond with ONLY valid JSON. No markdown, no backticks, no text before or after.',
        messages: [{
          role: 'user',
          content: `Design an Amazing Race in ${city} with ${n ? `exactly ${n}` : '3 to 5'} legs. Each leg themed around a different area with 3-6 checkpoints. Types:
- "challenge": Physical go-to tasks. requiresApproval: true
- "roadblock": Solo tasks one person must do. requiresApproval: true
- "minigame": Puzzle checkpoint with "answer" field (destination word to decode). requiresApproval: false

Every leg needs at least one minigame. Mix physical tasks, trivia, photo hunts, food & culture challenges.
JSON: {"legs":[{"name":"Name","checkpoints":[{"name":"Name","type":"challenge","description":"Instructions","clueText":"Clue","requiresApproval":true},{"name":"Decode","type":"minigame","description":"Solve to continue","clueText":"Revealed after","answer":"Destination","requiresApproval":false}]}]}
Make it specific to real ${city} landmarks, food, and culture.`
        }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Anthropic API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 502 });
    }

    const text = (data.content || []).map((i: any) => i.text || '').join('\n');
    if (!text.trim()) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    // Robust JSON extraction
    let jsonStr = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    
    const first = jsonStr.indexOf('{');
    const last = jsonStr.lastIndexOf('}');
    if (first !== -1 && last > first) {
      jsonStr = jsonStr.slice(first, last + 1);
    }

    const parsed = JSON.parse(jsonStr);
    if (!parsed.legs?.length) {
      return NextResponse.json({ error: 'No legs generated' }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
