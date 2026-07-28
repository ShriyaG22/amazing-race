import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Race = {
  id: string;
  name: string;
  code: string;
  city: string;
  status: 'setup' | 'active' | 'finished';
  started_at: string | null;
  created_at: string;
  boundary: { x: number; y: number }[];
  created_by: string | null;
  admin_playing: boolean;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  start_lat: number | null;
  start_lng: number | null;
  radius_km: number | null;
  start_address: string;
  is_solo_explorer: boolean;
  require_photo: boolean;
  game_mode: 'race' | 'explorer';
};

export type Leg = {
  id: string;
  race_id: string;
  name: string;
  order_num: number;
};

export type Checkpoint = {
  id: string;
  leg_id: string;
  name: string;
  type: 'challenge' | 'roadblock' | 'minigame';
  description: string;
  clue_text: string;
  requires_approval: boolean;
  order_num: number;
  answer: string;
  mini_game_type: string;
  map_x: number | null;
  map_y: number | null;
  lat: number | null;
  lng: number | null;
};

export type Team = {
  id: string;
  race_id: string;
  name: string;
  joined_at: string;
  mode: 'solo' | 'duo';
};

export type TeamMember = {
  id: string;
  team_id: string;
  name: string;
  device_id: string;
  joined_at: string;
};

export type Progress = {
  id: string;
  team_id: string;
  checkpoint_id: string;
  status: 'pending' | 'complete' | 'rejected';
  proof: string;
  submitted_at: string;
  reviewed_at: string | null;
};
