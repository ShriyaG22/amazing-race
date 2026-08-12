import { NextRequest, NextResponse } from 'next/server';

// Generation with web search takes well over the default limit. 60s is the
// ceiling on Vercel Hobby; raise this to 300 if the project is on Pro.
export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Metres between two lat/lng points. */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isValidCoord(lat: any, lng: any) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0);
}

export async function POST(req: NextRequest) {
  try {
    const { city, numLegs, difficulty, startAddress, radiusKm, notes, theme, gameMode, teamMode, duration, startLat, startLng, eventDate, startTime, budget, accessibility, localKnowledge, legIndex, priorLegs } = await req.json();
    if (!city) return NextResponse.json({ error: 'City is required' }, { status: 400 });

    // One leg per request. The whole adventure in a single call blew past the
    // 60s serverless limit once web search was involved.
    const singleLegMode = typeof legIndex === 'number';
    const prior: any[] = Array.isArray(priorLegs) ? priorLegs : [];

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
    // Searching is never optional. A route built on stale data can send someone
    // to a restaurant that closed two years ago, and nobody would knowingly
    // choose that. The client no longer asks.
    const liveData = true;

    // ── Time budget ───────────────────────────────────────────────────────
    // Duration used to control leg count and nothing else, so "1 hour" could
    // easily be a two-hour walk. Now it's an actual minute budget the model
    // has to spend.
    const durationMinutes: Record<string, number> = {
      '30 minutes': 30, '1 hour': 60, '2 hours': 120,
      'half a day (3-4 hours)': 210, 'a full day (6-8 hours)': 420,
    };
    const totalMinutes = durationMinutes[dur] || 60;

    // Budget selection
    const budgetKey = budget || 'cheap';
    const budgetRule: Record<string, string> = {
      free: 'Every challenge must be completely FREE. No purchases, no entry fees, no tickets. Looking, finding, photographing and asking are all free; buying is not.',
      cheap: 'Challenges should be free or cost very little — under $10 per person, and no more than two paid stops across the whole route. Never require an entry fee to a paid attraction.',
      any: 'Spending is fine. Paid entry, meals and drinks are all allowed, but state the likely cost in the challenge description so players are not surprised.',
    };

    const accessRule = accessibility
      ? `ACCESSIBILITY — REQUIRED:
This route must be step-free and manageable for someone with limited mobility.
- No stairs-only access, no steep hills, no cobbled or uneven surfaces where avoidable
- No challenges requiring running, climbing, or crouching
- Keep individual walking legs under 800m
- Prefer venues with level entry and lifts
- If a landmark is only reachable by steps, choose a different one`
      : '';

    // Local knowledge is its own axis. Difficulty was silently controlling
    // puzzle hardness, distance AND how much insider knowledge was assumed.
    const localKey = localKnowledge || 'visitor';
    const localRule: Record<string, string> = {
      visitor: `PLAYERS ARE VISITORS — they do not know this city.
- Clues must be solvable by someone who arrived yesterday
- Always anchor with something navigable: a street name, an intersection, a
  well-known landmark to walk from, or a compass direction and distance
- Never rely on local nicknames, neighbourhood slang, or "the place everyone knows"
- Describe what a place LOOKS like, since they cannot rely on recognising the name`,
      mixed: `PLAYERS MAY OR MAY NOT KNOW THE CITY.
- Anchor each clue with at least one navigable detail (street, intersection, landmark)
- Local references are fine as colour, but never as the only way to solve the clue`,
      local: `PLAYERS KNOW THIS CITY WELL.
- You can use local nicknames, insider references, and "the one everyone argues about"
- Clues can rely on knowledge a resident would have but a tourist would not
- Still avoid anything so obscure that a long-time resident would be stumped`,
    };

    // Start time matters as much as the date — a 7pm November start is a dark route.
    const startClock = typeof startTime === 'string' && /^\d{2}:\d{2}$/.test(startTime) ? startTime : null;
    const endClock = startClock ? (() => {
      const [h, m] = startClock.split(':').map(Number);
      const end = new Date(2000, 0, 1, h, m + totalMinutes);
      return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    })() : null;

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
    const estimatedCheckpoints = singleLegMode ? 5 : legCount * 5;
    // A single leg is small, so this now fits inside the time limit comfortably.
    const maxTokens = singleLegMode ? 8000 : Math.min(32000, Math.max(8000, estimatedCheckpoints * 700) + 4000);
    const maxSearches = singleLegMode ? (legIndex === 0 ? 4 : 2) : 4;

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
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }],
        } : {}),
        system: 'You are a JSON API that designs city adventure games modeled after The Amazing Race. Every game you design must be UNIQUE — never repeat the same starting neighborhoods, landmarks, or clue styles. Respond with ONLY valid JSON. No markdown, no backticks, no extra text.',
        messages: [{
          role: 'user',
          content: `You are designing a Wandr adventure. Read the brief, then design to it.

═══════════════ THE BRIEF ═══════════════
City: ${city}
${start ? `Start point: ${start}${startLat && startLng ? ` (${startLat}, ${startLng})` : ''}` : 'Start point: your choice — somewhere interesting, not the obvious tourist spot'}
Maximum distance from start: ${radius}km
Legs: exactly ${legCount}
Time available: ${totalMinutes} minutes total
Played on: ${fmtDate(validPlayDate)}${startClock ? `, starting ${startClock}, finishing around ${endClock}` : ''}
Mode: ${mode === 'explorer' ? 'Explorer — casual solo or group wandering, no competition' : `Race — competitive, ${team === 'solo' ? 'solo players' : 'teams of two or more'}`}
Difficulty: ${diff}
City knowledge assumed: ${localKey === 'visitor' ? 'none — treat players as first-time visitors' : localKey === 'local' ? 'high — players live here' : 'mixed — some know it, some do not'}
Spending: ${budgetKey === 'free' ? 'free only' : budgetKey === 'any' ? 'anything goes' : 'cheap — under $10 per person'}
Step-free required: ${accessibility ? 'YES — this is a hard requirement' : 'no'}
Theme: ${userTheme ? userTheme : 'none specified — vary it'}
${userNotes ? `
═══════════ THE HOST'S OWN WORDS ═══════════
The person creating this wrote the following. Treat it as the most specific
instruction you have received. Where it conflicts with any default or general
guidance below, THE HOST WINS. Where it asks for something, do that thing
explicitly rather than approximately.

"${userNotes}"
════════════════════════════════════════════
` : ''}
WHEN THE BRIEF CONFLICTS WITH ITSELF, resolve in this order:
1. Step-free requirement — never compromised, a route someone cannot physically
   complete is worthless
2. The host's own words above
3. Spending limit
4. Time budget
5. Theme
6. Difficulty
7. Everything else

If the theme cannot be honoured within the other constraints — a nightlife theme
on a 10am start, a foodie theme with a free-only budget — get as close as you can
and say so in the first leg's name rather than silently ignoring a constraint.

═════════════════════════════════════════

${singleLegMode ? `YOU ARE DESIGNING LEG ${legIndex + 1} OF ${legCount} — ONLY THIS ONE LEG.
Return exactly one leg in the JSON. Not the whole adventure.
This leg should take about ${Math.round(totalMinutes / legCount)} minutes.
${prior.length ? `
ALREADY USED — DO NOT REPEAT ANY OF THESE:
${prior.map((l: any, i: number) => `Leg ${i + 1} "${l.name}": ${(l.locations || []).join(', ')}`).join('\n')}

The previous leg ended at ${prior[prior.length - 1]?.endLocation || 'its pit stop'}${
  prior[prior.length - 1]?.endLat ? ` (${prior[prior.length - 1].endLat}, ${prior[prior.length - 1].endLng})` : ''
}.
START THIS LEG FROM THERE — the first checkpoint should be a short walk from that
point, not back where the adventure began. The route must keep moving forward
through the city, not bounce between the same few blocks.` : `This is the first leg, so it starts at ${start || 'your chosen starting point'}.`}
` : `Design a UNIQUE adventure with exactly ${legCount} legs.`}
Make it different from any previous adventure — choose unexpected neighbourhoods
and lesser-known spots.
${scaling ? `${singleLegMode ? 'This leg' : 'Each leg'} should have ${scaling.cpPerLeg}.` : ''}

WHEN THIS IS BEING PLAYED:
Today is ${fmtDate(today)}.${isFuture ? ` This adventure will be played on ${fmtDate(validPlayDate)}.` : ''}
Players will be out on a ${dayOfWeek}${startClock ? `, starting at ${startClock} and finishing around ${endClock}` : ''}.
- Respect what's actually open on a ${dayOfWeek}. Many museums close Mondays; some
  markets only run at weekends; plenty of restaurants close between lunch and dinner.
${startClock ? `- Every stop must be open during the window ${startClock}–${endClock}. Check the LAST stops especially — those are the ones that will have closed.
- Consider daylight. If part of this route runs after dark on ${fmtDate(validPlayDate)}, put the outdoor and scenic stops early and the indoor or well-lit stops late.` : ''}
- Match the season. Do not send people to an outdoor ice rink in July, a rooftop bar
  in February, or a cherry blossom spot out of bloom.
- If a stop depends on opening hours, say so in the challenge description.

TIME BUDGET — ${totalMinutes} MINUTES TOTAL. THIS IS A HARD CONSTRAINT:
The whole adventure must be completable in ${totalMinutes} minutes by people walking
at an ordinary pace. Budget it explicitly before you choose locations:

- Walking: assume 12 minutes per kilometre, including crossings and getting lost
- Each challenge: 5-8 minutes
- Each detour: 8-12 minutes
- Each roadblock: 8-12 minutes
- Each pit stop: 5 minutes
- Solving a clue and finding the door: 3-5 minutes per stop

Add it up. Walking time plus task time must be UNDER ${totalMinutes} minutes.
If it doesn't fit, use fewer checkpoints or place them closer together — do NOT
compress the tasks. A ${totalMinutes}-minute adventure that actually takes twice
that is a broken adventure.

Consecutive checkpoints should be a ${totalMinutes <= 60 ? '5-10' : '10-15'} minute walk apart at most.

MONEY:
${budgetRule[budgetKey] || budgetRule.cheap}

${localRule[localKey] || localRule.visitor}

${accessRule}
${liveData ? `
USE WEB SEARCH BEFORE YOU CHOOSE LOCATIONS — THIS IS REQUIRED:
Your training data is out of date. Restaurants close, museums move, bars are
renamed. Sending players to a place that shut down last year ruins the game.

Run these searches before designing anything:

1. WHAT'S ON. Search for events in ${city} on and around ${fmtDate(validPlayDate)} —
   festivals, street fairs, markets, exhibitions, open studios, seasonal events,
   free museum evenings, parades. Search the neighbourhoods you're considering by
   name too, not just the city.
   If you find something good that fits the route and the time window, BUILD A
   CHECKPOINT AROUND IT and mention it in the fun fact. A route that happens to
   walk players into a street fair they didn't know about is the best possible
   version of this app.
   Also search for anything that would RUIN the route that day — marathons,
   protests, parades closing streets, major construction, stadium events making
   an area impassable. Route around those.

2. STILL OPEN? Verify every specific business you plan to use is currently
   trading and check its hours${startClock ? ` against the ${startClock}–${endClock} window` : ''}. A closed
   restaurant is the single worst failure this app can produce.

3. WORTH GOING? Search for what's actually good in the neighbourhoods you're
   considering, so the route reflects the city as it is now rather than as it
   was when you were trained.
${userNotes ? `
4. THE HOST'S REQUEST. The host wrote something specific above. If it names a
   place, an event, a kind of food or an area, SEARCH FOR IT and build around
   what you find rather than guessing.` : ''}

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

WHAT MAKES A GOOD CHALLENGE — every one must pass ALL of these:
- Doable in 5-8 minutes by anyone, with no booking and no queue
- Possible from OUTSIDE or in a free public area if the venue happens to be shut
- Specific to THIS place — if the same task would work at any building in the
  city, it's a bad challenge. "Take a photo of the building" is bad.
  "Find the carved fox above the third doorway and photograph it" is good.
- Has a clear finish, so players know the moment they're done
- Needs nothing but a phone and what's already in a pocket
- Doesn't require entering someone's business without buying anything, doesn't
  disturb staff mid-service, and doesn't ask strangers to participate

Bad: "Soak up the atmosphere." "Reflect on the history." "Enjoy a drink."
Good: "Count the ceiling medallions in the entrance hall and note the number."
      "Find the plaque with the 1911 date and photograph the name on it."

DETOURS — must be a genuine dilemma, not two arbitrary tasks:
Name the tradeoff. The classic axis is FAST BUT HARD versus SLOW BUT EASY.
Others that work: physical vs mental, cheap vs quick, indoors vs outdoors.
State the tradeoff in the option descriptions so choosing feels like a decision.

Example — "Climb or Count":
  A: "Climb the 92 steps to the terrace and photograph the view. Quick, but steep."
  B: "Stay at street level and find all six mosaic panels around the base. Easy, but slow."

${mode === 'race' && team !== 'solo' ? `ROADBLOCKS — the hint must tease the task without revealing it:
"Who's got a good head for heights?" before a climb. "Who has the steadiest hands?"
before something delicate. One partner commits BEFORE seeing what they've agreed to,
so the hint has to be honest about the flavour and silent about the specifics.

` : ''}FUN FACTS — must be specific and checkable:
Include a date, a name, a number, or a concrete event. If your fact would apply
equally to a hundred other buildings, it's not a fact, it's filler.

Bad: "This is one of the oldest buildings in the neighbourhood."
Good: "The clock has run three minutes fast since 1954, when the caretaker set it
      early to get the choir to rehearsals on time — and nobody has corrected it."
${liveData ? 'Use search to find these. A surprising, verifiable detail is the single most memorable part of a stop.' : ''}

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
- COORDINATES ARE CHECKED. Every lat/lng must be the real location of that place,
  to at least 4 decimal places. Do not approximate to the neighbourhood centre and
  do not reuse one coordinate for several stops. A wrong coordinate sends someone
  to the wrong street corner while the app tells them they're going the right way.
  ${startLat && startLng ? `Every checkpoint must be within ${radius}km of ${startLat}, ${startLng}. Checkpoints outside that are rejected.` : ''}
- Order checkpoints so the route flows in one direction. Do not zigzag back and
  forth across the same ground between consecutive stops.
- Fun facts: genuinely surprising or little-known

BEFORE YOU OUTPUT — CHECK YOUR OWN WORK:
Go back through what you've designed and confirm each of these. If any fails,
fix it before writing the JSON.

□ Total walking + task time is under ${singleLegMode ? Math.round(totalMinutes / legCount) + ' minutes for this leg' : totalMinutes + ' minutes'}
□ Every checkpoint is within ${radius}km of the start${startLat && startLng ? ` (${startLat}, ${startLng})` : ''}
□ Every coordinate is the real location of that specific place, 4+ decimals,
  and no two checkpoints share a coordinate
□ The route flows in one direction without zigzagging back over itself
□ Every stop is open on ${dayOfWeek}${startClock ? ` between ${startClock} and ${endClock}` : ''}
□ Spending stays within: ${budgetKey === 'free' ? 'free only' : budgetKey === 'any' ? 'anything' : 'under $10 per person'}
${accessibility ? '□ Every stop is step-free, no stairs-only access, no steep hills' : ''}
□ Every clue is solvable by ${localKey === 'visitor' ? 'someone who has never been to this city' : localKey === 'local' ? 'a resident' : 'someone who may not know the city'}
□ Every challenge is specific to its location and would fail if moved elsewhere
□ Every fun fact contains a date, name, number or specific event
□ Each leg ends with a pitstop and contains exactly one detour
□ No two puzzle clues in consecutive checkpoints
□ Every puzzle clue has exactly one _____ gap that its answer fills
${userNotes ? '□ The host\'s own instructions have been followed specifically, not loosely' : ''}

Output format: {"legs":[{"name":"Neighborhood Name","checkpoints":[...]}]}
Respond with ONLY the JSON. No preamble, no explanation, no markdown fences.`
        }],
      }),
    });

    if (!response.ok) {
      // The body says WHY — throwing it away made this impossible to debug.
      let detail = '';
      try {
        const body = await response.text();
        detail = body.slice(0, 400);
        console.error('Anthropic API error', response.status, detail);
      } catch { /* ignore */ }
      return NextResponse.json({
        error: `Generation failed (${response.status}). ${detail || 'No detail returned.'}`,
      }, { status: 502 });
    }

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

    // ── Geographic sanity ─────────────────────────────────────────────────
    // The model can't measure distance, so its "all within Xkm" is an
    // assertion, not a fact. Check it.
    const allCps: any[] = parsed.legs.flatMap((l: any) => l.checkpoints || []);
    const radiusM = radius * 1000;
    const geo = { missing: 0, outOfRange: 0, duplicated: 0, longestHopM: 0 };

    const seen = new Map<string, number>();
    for (const cp of allCps) {
      if (!isValidCoord(cp.lat, cp.lng)) { geo.missing++; cp.lat = null; cp.lng = null; continue; }
      const key = `${cp.lat.toFixed(4)},${cp.lng.toFixed(4)}`;
      seen.set(key, (seen.get(key) || 0) + 1);
      if (isValidCoord(startLat, startLng)) {
        // 1.25x slack — the radius is a guide, not a fence.
        if (haversine(startLat, startLng, cp.lat, cp.lng) > radiusM * 1.25) {
          geo.outOfRange++;
          cp.lat = null; cp.lng = null;   // better no pin than a confidently wrong one
        }
      }
    }
    seen.forEach((count) => { if (count > 1) geo.duplicated += count - 1; });

    // Longest walk between consecutive stops, for a sanity signal on pacing.
    const withCoords = allCps.filter((cp) => isValidCoord(cp.lat, cp.lng));
    for (let i = 1; i < withCoords.length; i++) {
      const d = haversine(withCoords[i - 1].lat, withCoords[i - 1].lng, withCoords[i].lat, withCoords[i].lng);
      if (d > geo.longestHopM) geo.longestHopM = Math.round(d);
    }

    // If most of the coordinates are unusable the route isn't worth shipping.
    const badRatio = allCps.length ? (geo.missing + geo.outOfRange) / allCps.length : 0;
    if (badRatio > 0.5) {
      return NextResponse.json({
        error: 'The generated route had too many bad locations to be usable. Please generate again.',
      }, { status: 502 });
    }

    return NextResponse.json({
      ...parsed,
      _downgradedPuzzles: downgraded,
      _geo: geo,
      _estimatedMinutes: totalMinutes,
      _totalLegs: legCount,
      _legIndex: singleLegMode ? legIndex : null,
    });
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
