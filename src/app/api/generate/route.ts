import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { city, numLegs, difficulty, startAddress, radiusKm, notes, theme, gameMode, teamMode, duration, startLat, startLng } = await req.json();
    if (!city) return NextResponse.json({ error: 'City is required' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    const diff = difficulty || 'medium';
    const radius = radiusKm || 5;
    const start = startAddress || '';
    const userNotes = notes || '';
    const userTheme = theme || '';
    const mode = gameMode || 'race';
    const team = teamMode || 'solo';
    const dur = duration || '';

    // Duration → leg/checkpoint scaling
    const durationGuide: Record<string, { legs: number; cpPerLeg: string }> = {
      '30 minutes': { legs: 1, cpPerLeg: '3 checkpoints + 1 pit stop' },
      '1 hour': { legs: 2, cpPerLeg: '3-4 checkpoints + 1 pit stop' },
      '2 hours': { legs: 3, cpPerLeg: '4 checkpoints + 1 pit stop' },
      'half a day (3-4 hours)': { legs: 4, cpPerLeg: '4-5 checkpoints + 1 pit stop' },
      'a full day (6-8 hours)': { legs: 6, cpPerLeg: '4-5 checkpoints + 1 pit stop' },
    };

    const scaling = dur && durationGuide[dur] ? durationGuide[dur] : null;
    const legCount = numLegs ? parseInt(numLegs) : (scaling?.legs || 3);

    const difficultyGuide: Record<string, string> = {
      easy: 'Simple tasks, short walks (under 500m between stops). Fun and relaxed.',
      medium: 'Moderate challenges, walks up to 1km. Mix of physical and mental.',
      hard: 'Demanding challenges, longer distances, complex puzzles.',
      extreme: 'Maximum difficulty. Long routes, expert puzzles, intense tasks.',
    };

    // Mode-specific instructions
    const modeInstructions = mode === 'explorer'
      ? `This is EXPLORER MODE — casual, no competition. Challenges should be experiential and fun:
- Use "challenge" type only (NO roadblocks — there's no partner pressure)
- Challenges should be about experiencing the location: "try the local coffee", "photograph the mural", "sit and sketch the view", "find the hidden courtyard"
- Include detours as fun choices: "Taste vs See" — try a local dish OR photograph street art
- Tone should be inviting and curious, not competitive`
      : team === 'solo'
      ? `This is RACE MODE, SOLO PLAYER. Generate competitive challenges but:
- Do NOT generate "roadblock" type — no partner to delegate to
- Use "challenge" and "detour" types
- Challenges can be more intense/competitive since it's a race`
      : `This is RACE MODE, TEAM/DUO PLAY. Generate the full Amazing Race experience:
- Include "roadblock" checkpoints with a cryptic one-line hint (e.g. "Who's got steady hands?") — one partner must commit before seeing the full task
- Include "detour" checkpoints with two distinct options to choose from
- Challenges should be competitive and time-pressured`;

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
        temperature: 1,
        system: 'You are a JSON API that designs city adventure games modeled after The Amazing Race. Every game you design must be UNIQUE — never repeat the same starting neighborhoods, landmarks, or clue styles. Respond with ONLY valid JSON. No markdown, no backticks, no extra text.',
        messages: [{
          role: 'user',
          content: `Design a UNIQUE Wandr adventure in ${city} with exactly ${legCount} legs. Make it different from any previous adventure — choose unexpected neighborhoods and lesser-known spots.
${scaling ? `Target duration: ${dur}. Each leg should have ${scaling.cpPerLeg}.` : ''}

ROUTING RULES:
- ${start ? `IMPORTANT: The adventure MUST start at or very near "${start}"${startLat && startLng ? ` (GPS: ${startLat}, ${startLng})` : ''}. The first checkpoint of the first leg should be within 200m of this location.` : `Pick a random interesting starting area in ${city} — NOT the most obvious tourist spot. Surprise the player.`}
- ALL checkpoints MUST be within ${radius}km (${(radius / 1.609).toFixed(1)} miles) of the starting point.
- Each leg in GEOGRAPHICALLY ADJACENT neighborhoods. Checkpoints in WALKING ORDER.
- Do NOT always pick the same neighborhoods. Vary your choices.

DIFFICULTY: ${diff.toUpperCase()} — ${difficultyGuide[diff] || difficultyGuide.medium}

${userTheme ? `THEME — THIS IS CRITICAL:
The ENTIRE adventure MUST follow this theme: ${userTheme}
- Every checkpoint location should connect to this theme
- Every challenge should relate to this theme
- Every clue should reference this theme
- Do NOT include locations or challenges that don't fit the theme
- If the theme is nightlife, choose bars, clubs, live music venues, rooftop bars, jazz clubs — NOT museums or parks
- If the theme is foodie, choose restaurants, food markets, street food spots, bakeries — NOT monuments
- The theme should be the PRIMARY filter for choosing locations and designing challenges` : ''}

${modeInstructions}

${userNotes ? `ADDITIONAL HOST NOTES:\n${userNotes}\n` : ''}

GAME STRUCTURE — Each leg follows this EXACT pattern:
1. Clue → Player goes to location → Real-world challenge at that location
2. Clue → Player goes to location → DETOUR (choose between two real-world tasks)
3. ${mode === 'race' && team !== 'solo' ? 'Clue → Player goes to location → ROADBLOCK (one partner does a real-world solo task)' : 'Clue → Player goes to location → Another real-world challenge'}
4. Clue → Player goes to PIT STOP → Rest and celebrate

CRITICAL STRUCTURE RULES:
- The CLUE is how players discover WHERE to go. It can be a text riddle OR a puzzle.
- The CHALLENGE is what players DO when they arrive. It is ALWAYS a real-world task (take a photo, find something, taste food, etc.) — NEVER a puzzle or minigame.
- There should NEVER be two puzzles in a row. If one checkpoint has a puzzle clue, the next should have a text clue.
- Challenges, detours, roadblocks, and pit stops are all REAL-WORLD activities, not in-app games.

CHECKPOINT FLOW — Each checkpoint has 4 phases:
1. CLUE: Riddle or puzzle hinting at the location (don't name it directly)
2. VERIFY: Player types the location name
3. CHALLENGE: Real-world task at the location (NEVER a puzzle)
4. FUN FACT: Interesting trivia about the spot

CHECKPOINT TYPES & JSON FIELDS:

IMPORTANT: "clueText" is ALWAYS required, even for puzzle clue types. For puzzles, "clueText" serves as a verbal hint shown alongside the puzzle to give context (e.g. "This spot is near the waterfront and famous for its views..."). The puzzle's "answer" is a hint word, and the "clueText" helps players know what area to think about.

For type "challenge":
{"name":"Stop Name","type":"challenge","clueText":"A conversational hint about the location...","clueType":"text","locationAnswer":"Landmark Name","description":"Real-world task: take a photo, find something, taste food, etc.","funFact":"Interesting fact","lat":40.7,"lng":-74.0,"answer":""}

For type "detour":
{"name":"Detour: Taste vs Trace","type":"detour","clueText":"Hint about the location...","clueType":"text","locationAnswer":"Location Name","detourOptionATitle":"Taste","detourOptionADesc":"Real-world task A","detourOptionBTitle":"Trace","detourOptionBDesc":"Real-world task B","funFact":"Fact","lat":40.7,"lng":-74.0,"answer":""}

${mode === 'race' && team !== 'solo' ? `For type "roadblock":
{"name":"Roadblock","type":"roadblock","clueText":"Hint about location...","clueType":"text","locationAnswer":"Location Name","roadblockHint":"Who's got the better sense of direction?","description":"Real-world solo task","funFact":"Fact","lat":40.7,"lng":-74.0,"answer":""}` : ''}

For type "pitstop" (MUST be last checkpoint of each leg):
{"name":"Pit Stop: Park Name","type":"pitstop","clueText":"Hint leading to the rest spot...","clueType":"text","locationAnswer":"Park Name","description":"You made it! Rest here and enjoy.","funFact":"Fact about this spot","lat":40.7,"lng":-74.0,"answer":""}

CLUE TYPES — "clueType" determines how the clue is delivered:
- "text" — a conversational written hint (most common, use for ~60% of checkpoints)
- "sliding" — sliding tile puzzle. "answer" MUST be a single word, 5-8 letters, that hints at the location (e.g. "BRIDGE", "GOLDEN", "HARBOR"). NEVER a full location name.
- "wordsearch" — word search grid. "answer" MUST be a single word, 5-8 letters. NEVER multi-word.
- "cipher" — letter-shifted code. "answer" MUST be a single word, 5-8 letters (the DECODED word — our app handles the encoding).
- "unscramble" — jumbled letters. "answer" MUST be a single word, 5-8 letters.
- "emoji" — emoji riddle. "emojiClue" = 3-5 OBVIOUS emojis as a plain string (e.g. "🗽🔦🌊"), NOT a JSON array. Use simple, widely-known emojis. "answer" = the location name players guess.
CRITICAL: For sliding, wordsearch, cipher, unscramble — the "answer" is a SHORT HINT WORD (one word, 5-8 letters), never a location name or multi-word phrase.
RULES: Use 1-2 non-text clueTypes per leg MAX. NEVER two puzzle clueTypes in consecutive checkpoints. Alternate: puzzle → text → text → puzzle.

CLUE WRITING STYLE — ${diff.toUpperCase()}:
${diff === 'easy' ? `Almost direct. Reference obvious features. Example: "Head to the big park in the middle of Manhattan — the one with the lake and the zoo."` :
  diff === 'medium' ? `Descriptive but don't name it. Use 2-3 recognizable details. Example: "Find the 843-acre park where horse carriages run and there's a memorial to John Lennon."` :
  diff === 'hard' ? `Requires local knowledge. Reference specific features. Example: "This park spans 51 blocks and has a wooded section called The Ramble near a boathouse."` :
  `Deep knowledge required. Obscure history. Example: "Olmsted and Vaux designed this in 1858. Find where Bethesda Fountain overlooks a lake that was once a reservoir."`}
NO poems, NO rhymes, NO flowery language. Keep clues natural and conversational.

RULES:
- Every leg MUST end with a "pitstop" checkpoint at a scenic rest location
- Every leg MUST have exactly 1 "detour" checkpoint
${mode === 'race' && team !== 'solo' ? '- Every leg MUST have exactly 1 "roadblock" checkpoint' : ''}
- Pit stops: celebratory tone, "Leg complete! Rest and enjoy."
- Detour options: genuinely different activities
- Use REAL ${city} landmarks with accurate GPS coordinates
- Fun facts: genuinely surprising or little-known

Output format: {"legs":[{"name":"Neighborhood Name","checkpoints":[...]}]}`
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
