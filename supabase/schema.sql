-- Amazing Race Database Schema
-- Run this in your Supabase SQL editor

-- Races table
CREATE TABLE IF NOT EXISTS races (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  city TEXT DEFAULT '',
  status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'finished')),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  boundary JSONB DEFAULT '[]',
  created_by TEXT
);

-- Legs table
CREATE TABLE IF NOT EXISTS legs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id UUID REFERENCES races(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_num INTEGER NOT NULL DEFAULT 0
);

-- Checkpoints table
CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'challenge' CHECK (type IN ('challenge', 'roadblock', 'minigame')),
  description TEXT DEFAULT '',
  clue_text TEXT DEFAULT '',
  requires_approval BOOLEAN DEFAULT false,
  order_num INTEGER NOT NULL DEFAULT 0,
  answer TEXT DEFAULT '',
  mini_game_type TEXT DEFAULT '',
  map_x REAL,
  map_y REAL
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id UUID REFERENCES races(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress table
CREATE TABLE IF NOT EXISTS progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  checkpoint_id UUID REFERENCES checkpoints(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'rejected')),
  proof TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(team_id, checkpoint_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_legs_race ON legs(race_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_leg ON checkpoints(leg_id);
CREATE INDEX IF NOT EXISTS idx_teams_race ON teams(race_id);
CREATE INDEX IF NOT EXISTS idx_progress_team ON progress(team_id);
CREATE INDEX IF NOT EXISTS idx_progress_checkpoint ON progress(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_races_code ON races(code);

-- Enable RLS (Row Level Security) but allow all for now
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

-- Permissive policies (open access — tighten later with auth)
CREATE POLICY "Allow all on races" ON races FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on legs" ON legs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on checkpoints" ON checkpoints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on progress" ON progress FOR ALL USING (true) WITH CHECK (true);
