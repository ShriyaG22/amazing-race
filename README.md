# The Amazing Race — Live Game

A real-world checkpoint race game with AI-generated challenges, interactive mini games, and live leaderboards.

## Features
- **AI Race Generation** — Enter a city, get themed legs with challenges, roadblocks & puzzles
- **4 Mini Games** — Word unscramble, jigsaw puzzle, memory match, cipher decoder
- **Full-screen player cards** — Players see one challenge at a time, no peeking ahead
- **Admin dashboard** — Build legs, review submissions, track teams on a map
- **Geofence map** — Draw race boundaries and pin checkpoint locations
- **Live leaderboard** — Real-time progress tracking across all teams

## Tech Stack
- **Next.js 14** (App Router)
- **Supabase** (Postgres + Realtime)
- **Tailwind CSS**
- **Anthropic API** (AI challenge generation)
- **Vercel** (deployment)

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/amazing-race.git
cd amazing-race
npm install
```

### 2. Supabase Setup
- Create a new project at [supabase.com](https://supabase.com)
- Go to SQL Editor and run the contents of `supabase/schema.sql`
- Copy your project URL and anon key from Settings > API

### 3. Environment Variables
```bash
cp .env.local.example .env.local
```
Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel
- Push to GitHub
- Import repo in Vercel
- Add env vars in Vercel project settings
- Deploy
