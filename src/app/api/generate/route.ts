import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { city, numLegs, difficulty, startAddress, radiusKm, notes, theme, gameMode, teamMode, duration, startLat, startLng, eventDate, useLiveData } = await req.json();
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

    // Date context. The model has no idea what day it is unless we tell it.
    const today = new Date();
    const playDate = eventDate ? new Date(eventDate + 'T12:00:00') : today;
    const validPlayDate = !isNaN(playDate.getTime()) ? playDate : today;
    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
    const isFuture = validPlayDate.toDateString() !== today.toDateString();
    const dayOfWeek = validPlayDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const liveData = useLiveData !== false;

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

    // Roughly 700 tokens per checkpoint of JSON. A full day (6 legs x 5 stops)
    // blew straight past the old 4096 ceiling and truncated mid-object.
    const estimatedCheckpoints = legCount * 5;
    // Search runs burn output tokens on narration between searches.
    const maxTokens = Math.min(32000, Math.max(8000, estimatedCheckpoints * 700) + (liveData ? 4000 : 0));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        temperature: 1,
        ...(liveData ? {
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
        } : {}),
        system: 'You are a JSON API that designs city adventure games modeled after The Amazing Race. Every game you design must be UNIQUE — never repeat the same starting neighborhoods, landmarks, or clue styles. Respond with ONLY valid JSON. No markdown, no backticks, no extra text.',
        messages: [{
          role: 'user',
          content: `Design a UNIQUE Wandr adventure in ${city} with exactly ${legCount} legs. Make it different from any previous adventure — choose unexpected neighborhoods and lesser-known spots.
${scaling ? `Target duration: ${dur}. Each leg should have ${scaling.cpPerLeg}.` : ''}

WHEN THIS IS BEING PLAYED:
Today is ${fmtDate(today)}.${isFuture ? ` This adventure will be played on ${fmtDate(validPlayDate)}.` : ''}
Players will be out on a ${dayOfWeek}.
- Respect what's actually open on a ${dayOfWeek}. Many museums close Mondays; some
  markets only run at weekends; plenty of restaurants close between lunch and dinner.
- Match the season. Do not send people to an outdoor ice rink in July, a rooftop bar
  in February, or a cherry blossom spot out of bloom.
- If a stop depends on opening hours, say so in the challenge description.
${liveData ? `
USE WEB SEARCH BEFORE YOU CHOOSE LOCATIONS — THIS IS REQUIRED:
Your training data is out of date. Restaurants close, museums move, bars are
renamed. Sending players to a place that shut down last year ruins the game.

Search first, then design:
1. Search for what's currently open and worth visiting in the neighborhoods you're
   considering in ${city}
2. Verify any specific business you plan to use is still trading — a closed
   restaurant is the single worst failure this app can produce
3. Search for events happening in ${city} around ${fmtDate(validPlayDate)} —
   festivals, markets, exhibitions, street fairs — and work one or two in if they
   genuinely fit the route

Prefer long-standing institutions and public landmarks over places that opened
recently, unless search confirms the newer place is currently operating.
If search suggests a place has closed or you cannot confirm it, pick something else.
` : ''}
ROUTING RULES:
- ${start ? `IMPORTANT: The adventure MUST start at or very near "${start}"${startLat && startLng ? ` (GPS: ${startLat}, ${startLng})` : ''}. The first checkpoint of the first leg should be within 200m of this location.` : `Pick a random interesting starting area in ${city} — NOT the most obvious tourist spot. Surprise the player.`}
- ALL checkpoints MUST be within ${radius}km (${(radius / 1.609).toFixed(1)} miles) of the starting point.
- Each leg in GEOGRAPHICALLY ADJACENT neighborhoods. Checkpoints in WALKING ORDER.
- Do NOT always pick the same neighborhoods. Vary your choices.

DIFFICULTY: ${diff.toUpperCase()} — ${difficultyGuide[diff] || difficultyGuide.medium}

${userTheme ? `THEME — THIS IS CRITICAL:
${userTheme}
- Location choice is driven by the theme above, not by what's famous
- Challenges and clues should connect to it
- Skip locations that don't fit, even if they're landmarks
- If several themes are listed, spread them across the route — do NOT put all of
  one theme in the first leg and all of another in the second. Mix them within
  each leg so the adventure feels varied stop to stop.
- Pit stops are the one exception: they can be any pleasant rest spot` : ''}

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
- "text" — a conversational written hint (use for ~70% of checkpoints)
- "sliding" / "wordsearch" / "cipher" / "unscramble" — puzzle clues (see below)
DO NOT use "emoji" as a clueType.

HOW PUZZLE CLUES MUST WORK — THIS IS THE MOST IMPORTANT RULE:

A puzzle is NOT a gate in front of a clue that already gives the answer away.
The puzzle must SUPPLY A WORD THE CLUE IS MISSING.

Write the "clueText" with a literal gap — five underscores — where the key noun
belongs. The puzzle "answer" is that noun. Without solving it the clue should be
genuinely ambiguous; with it, the location becomes findable.

CORRECT:
{"clueText":"Head east toward Lexington near 28th. Since 1944 this narrow storefront has drawn cooks from across the city hunting one thing — over a thousand kinds of _____ line the shelves.","clueType":"sliding","answer":"SPICES","locationAnswer":"Kalustyan's"}

The reader knows the street and the era but not WHAT the shop sells. SPICES is
the piece that resolves it. That is a real puzzle.

WRONG — the clue already names the place, so the puzzle is decorative:
{"clueText":"Head to the famous spice shop on Lexington known for 1,000 ingredients.","clueType":"sliding","answer":"SPICES"}

WRONG — the gap is for a word that doesn't matter:
{"clueText":"Head to the _____ spice shop on Lexington.","answer":"FAMOUS"}

RULES FOR PUZZLE CHECKPOINTS:
- "clueText" MUST contain exactly one gap written as _____ (five underscores)
- The "answer" MUST be the single word that fills that gap, 5-9 letters, A-Z only
- The rest of the clue MUST NOT already reveal that word or an obvious synonym
- Removing the word must make the clue meaningfully harder — if the location is
  still obvious with the gap empty, use clueType "text" instead
- The answer is a concrete noun: what's sold, built, eaten, carved or grown there
  Good: SPICES, PASTRAMI, TRESTLE, CEILING, FOUNTAIN, ORCHIDS
  Bad: FRENCH, KOREAN (nationalities), GOLDEN, FAMOUS, HIDDEN (adjectives),
       ROOFTOP, MARKET, GARDEN (too generic), or the location name itself
${diff === 'hard' || diff === 'extreme' ? `
BLIND PUZZLES — allowed at this difficulty only:
For at most ONE checkpoint per leg you may set "clueText" to an empty string and
let the puzzle answer BE the entire clue. Use this only when the single word
points unmistakably to one place in ${city} — e.g. PASTRAMI for Katz's Deli.
If the word could plausibly mean several places, write a normal gapped clue.` : ''}

RULES: Use 1-2 puzzle clueTypes per leg MAX. NEVER two puzzles in consecutive
checkpoints. Alternate: puzzle → text → text → puzzle.

CLUE WRITING STYLE — ${diff.toUpperCase()}:
${diff === 'easy' ? `Write clues that practically give away the answer. Include the street name, the type of place, and a distinctive feature. The player should immediately know where to go. Example: "Head to the famous spice shop called Kalustyan's on Lexington Avenue near 28th Street — you can't miss the colorful storefront."` :
  diff === 'medium' ? `Describe the location clearly with 2-3 recognizable details but don't name it. Example: "Find the 843-acre park where horse carriages run and there's a memorial to John Lennon near the west side."` :
  diff === 'hard' ? `Reference specific but less obvious features. Requires some local knowledge. Example: "This park spans 51 blocks and has a wooded section called The Ramble near a boathouse."` :
  `Deep knowledge required. Reference obscure history. Example: "Olmsted and Vaux designed this in 1858. Find where Bethesda Fountain overlooks a lake that was once a reservoir."`}
Keep clues conversational. NO poems, NO rhymes. For easy mode, it's OK to nearly name the place — the fun is in the challenge at the location, not struggling to find it.

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

    // Truncation used to surface as an unhelpful JSON parse error.
    if (data.stop_reason === 'max_tokens') {
      return NextResponse.json({
        error: 'The adventure was too long to finish generating. Try a shorter duration, or generate again.',
      }, { status: 502 });
    }

    // With web search on, content is a mix of text, server_tool_use and
    // web_search_tool_result blocks, and the model often narrates between
    // searches. The JSON is in the final text block — joining everything would
    // drag commentary into the parse.
    const textBlocks = (data.content || [])
      .filter((i: any) => i.type === 'text' && typeof i.text === 'string')
      .map((i: any) => i.text);
    if (!textBlocks.length) return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });

    const extractJson = (raw: string) => {
      let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const first = s.indexOf('{');
      const last = s.lastIndexOf('}');
      if (first !== -1 && last > first) s = s.slice(first, last + 1);
      return s;
    };

    let parsed: any = null;
    // Last block first, then any other block, then everything joined.
    const candidates = [...textBlocks].reverse().concat([textBlocks.join('\n')]);
    for (const candidate of candidates) {
      try {
        const attempt = JSON.parse(extractJson(candidate));
        if (attempt?.legs?.length) { parsed = attempt; break; }
      } catch { /* try the next candidate */ }
    }

    if (!parsed) return NextResponse.json({ error: 'Could not read the generated adventure. Try again.' }, { status: 502 });
    if (!parsed.legs?.length) return NextResponse.json({ error: 'No legs generated' }, { status: 502 });

    // ── Normalise before handing it to the app ────────────────────────────
    // The model mostly follows the rules, but a single bad answer produces an
    // unsolvable puzzle in someone's hands on a street corner. Enforce here.
    const PUZZLE_TYPES = ['sliding', 'wordsearch', 'cipher', 'unscramble'];
    const VAGUE_WORDS = new Set([
      'FRENCH', 'KOREAN', 'ITALIAN', 'CHINESE', 'MEXICAN', 'SPANISH', 'GREEK',
      'JAPANESE', 'INDIAN', 'THAI', 'GOLDEN', 'HIDDEN', 'SECRET', 'ANCIENT',
      'FAMOUS', 'HISTORIC', 'BEAUTIFUL', 'ROOFTOP', 'MARKET', 'GARDEN', 'STREET',
      'PLACE', 'CORNER', 'BUILDING', 'WANDR',
    ]);

    let downgraded = 0;
    const allowBlind = diff === 'hard' || diff === 'extreme';

    for (const leg of parsed.legs) {
      if (!Array.isArray(leg.checkpoints)) { leg.checkpoints = []; continue; }
      let prevWasPuzzle = false;
      let blindUsedThisLeg = false;

      for (const cp of leg.checkpoints) {
        const rawAnswer = typeof cp.answer === 'string' ? cp.answer : '';
        const clean = rawAnswer.toUpperCase().replace(/[^A-Z]/g, '');
        const clueText = String(cp.clueText || '').trim();
        const hasGap = /_{3,}/.test(clueText);
        const isPuzzle = PUZZLE_TYPES.includes(cp.clueType);

        if (isPuzzle) {
          const locWords = String(cp.locationAnswer || '').toUpperCase().replace(/[^A-Z ]/g, '').split(/\s+/);
          // A blind puzzle (no clue text at all) is only allowed on hard/extreme,
          // once per leg.
          const isBlind = clueText === '';
          const blindOk = isBlind && allowBlind && !blindUsedThisLeg;

          const unusable =
            clean.length < 5 ||
            clean.length > 9 ||
            VAGUE_WORDS.has(clean) ||
            locWords.includes(clean) ||
            prevWasPuzzle ||
            (isBlind && !blindOk) ||
            // The whole point: a puzzle with no gap is decorative. Reject it.
            (!isBlind && !hasGap) ||
            // The clue must not already contain the word it's asking for,
            // including stems — "spice shop" gives away SPICES.
            (!isBlind && new RegExp(`\\b${clean.slice(0, Math.max(4, clean.length - 2))}`, 'i').test(clueText.replace(/_{3,}/g, ' ')));

          if (unusable) {
            cp.clueType = 'text';
            cp.answer = '';
            // Leave a readable sentence behind rather than a row of underscores.
            cp.clueText = clueText
              ? clueText.replace(/_{3,}/g, rawAnswer ? clean.toLowerCase() : 'something')
              : `Make your way to ${cp.locationAnswer || cp.name || 'the next stop'}.`;
            downgraded++;
          } else {
            cp.answer = clean;
            if (blindOk) blindUsedThisLeg = true;
          }
        } else {
          cp.answer = '';
          // A text clue should never show a gap the player can't fill.
          if (hasGap) cp.clueText = clueText.replace(/_{3,}/g, 'something');
          if (!String(cp.clueText || '').trim()) {
            cp.clueText = `Make your way to ${cp.locationAnswer || cp.name || 'the next stop'}.`;
          }
        }

        prevWasPuzzle = PUZZLE_TYPES.includes(cp.clueType);
        if (!String(cp.locationAnswer || '').trim()) cp.locationAnswer = cp.name || '';
        cp.emojiClue = '';
      }
    }

    return NextResponse.json({ ...parsed, _downgradedPuzzles: downgraded });
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
