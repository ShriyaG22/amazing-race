import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { city, numLegs, difficulty, startAddress, radiusKm, notes } = await req.json();
    if (!city) return NextResponse.json({ error: 'City is required' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const n = numLegs ? parseInt(numLegs) : null;
    const diff = difficulty || 'medium';
    const radius = radiusKm || 5;
    const start = startAddress || '';
    const userNotes = notes || '';

    const difficultyGuide: Record<string, string> = {
      easy: 'Simple tasks, short walks (under 500m between stops). Great for families.',
      medium: 'Moderate challenges, walks up to 1km. Mix of physical and mental tasks.',
      hard: 'Demanding challenges, longer distances, complex puzzles.',
      extreme: 'Maximum difficulty. Long routes, expert puzzles, intense tasks.',
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: 'You are a JSON API that designs city adventure games. Respond with ONLY valid JSON. No markdown, no backticks, no extra text.',
        messages: [{
          role: 'user',
          content: `Design a Wandr adventure in ${city} with ${n ? `exactly ${n}` : '3 to 5'} legs.

ROUTING RULES:
- ${start ? `Start at or near "${start}" and flow outward.` : `Start at a central location in ${city}.`}
- ALL checkpoints within ${radius}km of the starting point.
- Each leg in a GEOGRAPHICALLY ADJACENT area to the previous one.
- Checkpoints within each leg in WALKING ORDER.

DIFFICULTY: ${diff.toUpperCase()}
${difficultyGuide[diff] || difficultyGuide.medium}

${userNotes ? `HOST NOTES:\n${userNotes}\n` : ''}

GAME FLOW — Each checkpoint has 4 phases:
1. CLUE: A riddle or puzzle that hints at the LOCATION (not the answer). The player must figure out WHERE to go.
2. VERIFY: Player types the location name to prove they solved the clue.
3. CHALLENGE: A real-world task to complete at the location (take a photo, find something, do an activity).
4. FUN FACT: An interesting historical or cultural fact about this specific location.

CHECKPOINT FORMAT:
- "clueText": A creative riddle/poem that hints at the location WITHOUT naming it directly. Make it fun and solvable.
- "clueType": How the clue is delivered. "text" for a written riddle. OR "sliding"/"wordsearch"/"simon" for a minigame where the answer word is a hint to the location.
- "locationAnswer": The name of the place (what the player types to verify). Keep it simple — just the landmark name, e.g. "Central Park" not "Central Park, New York City".
- "answer": For minigame clue types only — the word used in the puzzle (a hint word related to the location, 5-8 letters).
- "description": The challenge to complete AT the location. Be specific and fun.
- "funFact": 1-2 sentences of genuinely interesting history or trivia about this exact spot.
- "type": "challenge" (both team members) or "roadblock" (one person only).
- "lat", "lng": Real GPS coordinates.
- "name": Display name for the checkpoint.

RULES:
- Each leg has 3-5 checkpoints, themed around a neighborhood.
- Mix clueTypes: mostly "text" riddles, but include 1-2 minigame clues per leg.
- Clue riddles should be clever but solvable — reference visual landmarks, street names, or well-known features.
- Fun facts should be genuinely surprising or little-known.
- Challenges should involve the actual location (not generic tasks).

JSON format:
{"legs":[{"name":"Neighborhood","checkpoints":[{"name":"Display Name","type":"challenge","clueText":"Where steel meets sky and traders shout, bulls and bears duke it out...","clueType":"text","locationAnswer":"Wall Street","description":"Find the Charging Bull statue and take a photo pretending to hold its horns","funFact":"The Charging Bull was actually installed illegally by artist Arturo Di Modica in 1989 as a symbol of American resilience.","answer":"","lat":40.7055,"lng":-74.0134},{"name":"Harbor Puzzle","type":"challenge","clueText":"Solve the puzzle to find your next stop","clueType":"sliding","locationAnswer":"Statue of Liberty","description":"From Battery Park, take a photo with the Statue of Liberty visible across the water","funFact":"The Statue of Liberty was originally a dull copper color and turned green over 20 years due to oxidation.","answer":"LIBERTY","lat":40.6892,"lng":-74.0445}]}]}

Use REAL ${city} landmarks with accurate GPS coordinates.`
        }],
      }),
    });

    if (!response.ok) return NextResponse.json({ error: `Anthropic API error: ${response.status}` }, { status: 502 });

    const data = await response.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 502 });

    const text = (data.content || []).map((i: any) => i.text || '').join('\n');
    if (!text.trim()) return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });

    let jsonStr = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const first = jsonStr.indexOf('{');
    const last = jsonStr.lastIndexOf('}');
    if (first !== -1 && last > first) jsonStr = jsonStr.slice(first, last + 1);

    const parsed = JSON.parse(jsonStr);
    if (!parsed.legs?.length) return NextResponse.json({ error: 'No legs generated' }, { status: 502 });

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
