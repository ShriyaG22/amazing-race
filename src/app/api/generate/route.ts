import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { city, numLegs, difficulty, startAddress, radiusKm } = await req.json();
    
    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const n = numLegs ? parseInt(numLegs) : null;
    const diff = difficulty || 'medium';
    const radius = radiusKm || 5;
    const start = startAddress || '';

    const difficultyGuide: Record<string, string> = {
      easy: 'Simple, fun tasks. Short walking distances (under 500m between checkpoints). Basic trivia, photo ops, easy physical tasks. Great for families.',
      medium: 'Moderate challenges. Walking distances up to 1km between checkpoints. Mix of physical tasks, cultural knowledge, and problem-solving.',
      hard: 'Demanding challenges. Longer distances, complex puzzles, physically strenuous tasks. Requires local knowledge or research.',
      extreme: 'Maximum difficulty. Long routes, expert-level puzzles, intense physical challenges, obscure cultural knowledge required.',
    };

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
          content: `Design an Amazing Race in ${city} with ${n ? `exactly ${n}` : '3 to 5'} legs.

CRITICAL ROUTING RULES:
- ${start ? `The race MUST start at or near "${start}" and flow outward from there.` : `Start at a central, well-known location in ${city}.`}
- ALL checkpoints must be within ${radius}km of the starting point.
- Each leg should be in a GEOGRAPHICALLY ADJACENT neighborhood/area to the previous one.
- Within each leg, checkpoints must be in WALKING ORDER — each checkpoint should be near the previous one, creating a logical walking route.
- Do NOT bounce between distant neighborhoods. The route should flow naturally like: Start → nearby area A → adjacent area B → neighboring area C.
- Think of it as a walking path that gradually moves through the city, NOT random pins scattered across a map.

DIFFICULTY: ${diff.toUpperCase()}
${difficultyGuide[diff] || difficultyGuide.medium}

CHECKPOINT TYPES:
- "challenge": Physical go-to tasks. requiresApproval: true
- "roadblock": Solo tasks one person must do. requiresApproval: true
- "minigame": Puzzle checkpoint with "answer" field (a single word, 5-10 letters, related to the location). requiresApproval: false. "miniGameType" must be one of: "sliding", "wordsearch", "simon".

RULES:
- Each leg should be themed around a specific neighborhood/area and have 3-6 checkpoints.
- Every leg needs at least one minigame.
- Mix physical tasks, trivia, photo hunts, food & culture challenges.
- Each checkpoint MUST include "lat" and "lng" with REAL GPS coordinates.
- Name each leg after the neighborhood it's in.
- Checkpoints within a leg should be within walking distance of each other (under ${diff === 'easy' ? '500m' : diff === 'hard' || diff === 'extreme' ? '1.5km' : '1km'}).

JSON format:
{"legs":[{"name":"Neighborhood Name","checkpoints":[{"name":"Checkpoint Name","type":"challenge","description":"Detailed instructions","clueText":"Clue leading to this location","requiresApproval":true,"lat":40.7128,"lng":-74.0060},{"name":"Puzzle Stop","type":"minigame","description":"Solve to continue","clueText":"Revealed after solving","answer":"LIBERTY","miniGameType":"sliding","requiresApproval":false,"lat":40.6892,"lng":-74.0445}]}]}

Make it specific to real ${city} landmarks, food, and culture. Use accurate GPS coordinates for real, walkable locations.`
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
