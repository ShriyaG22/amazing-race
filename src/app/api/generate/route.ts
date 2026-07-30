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

GAME STRUCTURE — Each leg follows this pattern:
1. Regular checkpoints (type: "challenge") — go to a location, complete a task
2. One DETOUR per leg (type: "detour") — player chooses between two options
3. ${mode === 'race' && team !== 'solo' ? 'One ROADBLOCK per leg (type: "roadblock") — one partner commits before seeing the task' : 'Additional challenges — keep it fun and varied'}
4. PIT STOP at the end of each leg (type: "pitstop") — a beautiful/notable rest location

CHECKPOINT FLOW — Each checkpoint has 4 phases:
1. CLUE: Riddle or puzzle hinting at the location (don't name it directly)
2. VERIFY: Player types the location name
3. CHALLENGE: Task to do at the location
4. FUN FACT: Interesting trivia about the spot

CHECKPOINT TYPES & JSON FIELDS:

For type "challenge":
{"name":"Stop Name","type":"challenge","clueText":"A riddle hinting at the location...","clueType":"text","locationAnswer":"Landmark Name","description":"The task to complete here","funFact":"Interesting fact about this spot","lat":40.7,"lng":-74.0,"answer":""}

For type "detour":
{"name":"Detour: Taste vs Trace","type":"detour","clueText":"A riddle hinting at the detour location...","clueType":"text","locationAnswer":"Location Name","detourOptionATitle":"Taste","detourOptionADesc":"Find and try 3 different local food items from street vendors","detourOptionBTitle":"Trace","detourOptionBDesc":"Sketch the facade of the historic building on the corner","funFact":"Fact about the area","lat":40.7,"lng":-74.0,"answer":""}

${mode === 'race' && team !== 'solo' ? `For type "roadblock":
{"name":"Roadblock","type":"roadblock","clueText":"Riddle to find the location...","clueType":"text","locationAnswer":"Location Name","roadblockHint":"Who's got the better sense of direction?","description":"Full task description (only revealed after partner commits)","funFact":"Fact about location","lat":40.7,"lng":-74.0,"answer":""}` : ''}

For type "pitstop" (last checkpoint of each leg):
{"name":"Pit Stop: Park Name","type":"pitstop","clueText":"Riddle leading to the pit stop...","clueType":"text","locationAnswer":"Park Name","description":"You made it! Rest here and take in the view.","funFact":"This park was designed by...","lat":40.7,"lng":-74.0,"answer":""}

CLUE TYPES — "clueType" can be:
- "text" — a conversational clue (NOT poetic or rhyming). Describe the place naturally.
- "sliding" — sliding tile puzzle. "answer" = hint word (5-8 letters).
- "wordsearch" — word search grid. "answer" = hidden word. Do NOT tell players what to find.
- "cipher" — letter-shifted code. "answer" = decoded word. Letters shifted by 3.
- "unscramble" — jumbled letters. "answer" = word to unscramble.
- "emoji" — emoji riddle. Add "emojiClue" field with 3-5 emojis representing the location. "answer" = location name.
IMPORTANT: Use at least 1 non-text clueType per leg. Vary puzzle types across legs.

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
