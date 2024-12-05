-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create manual_dialogues table
CREATE TABLE IF NOT EXISTS manual_dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
  is_chunked BOOLEAN DEFAULT false,
  merged_audio JSONB,
  metadata JSONB,
  total_duration FLOAT,
  speakers TEXT[],
  turn_count INTEGER,
  completed_chunks INTEGER,
  total_chunks INTEGER,
  last_session_id TEXT,
  is_published BOOLEAN DEFAULT false,
  audio_url TEXT,
  hashtags TEXT[],
  genre TEXT CHECK (genre IN ('Comedy', 'Drama', 'Action', 'Romance', 'Mystery', 'Horror', 'Fantasy', 'Sci-Fi', 'Slice of Life', 'Educational', 'Business', 'Technology', 'Other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create dialogue_sessions table
CREATE TABLE IF NOT EXISTS dialogue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id UUID REFERENCES manual_dialogues(id),
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  characters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audio_segments table
CREATE TABLE IF NOT EXISTS audio_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id UUID REFERENCES manual_dialogues(id),
  character TEXT NOT NULL,
  audio_key TEXT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  timestamps JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create dialogue_chunks table
CREATE TABLE IF NOT EXISTS dialogue_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_id UUID REFERENCES manual_dialogues(id),
  chunk_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  metadata JSONB NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dialogue_id, chunk_index)
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'error')) DEFAULT 'completed',
  progress INTEGER NOT NULL DEFAULT 100,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create published_dialogues table
CREATE TABLE IF NOT EXISTS published_dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  dialogue_id UUID REFERENCES manual_dialogues(id),
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT CHECK (genre IN ('Comedy', 'Drama', 'Action', 'Romance', 'Mystery', 'Horror', 'Fantasy', 'Sci-Fi', 'Slice of Life', 'Educational', 'Business', 'Technology', 'Other')),
  hashtags TEXT[],
  audio_url TEXT NOT NULL,
  duration FLOAT NOT NULL,
  speaker_count INTEGER NOT NULL,
  turn_count INTEGER NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for published_dialogues
CREATE INDEX published_dialogues_user_id_idx ON published_dialogues (user_id);
CREATE INDEX published_dialogues_genre_idx ON published_dialogues (genre);
CREATE INDEX published_dialogues_published_at_idx ON published_dialogues (published_at DESC);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_dialogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogue_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_dialogues ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = clerk_id);

-- Manual dialogues policies
CREATE POLICY "Users can CRUD own dialogues" ON manual_dialogues
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.uid()::text
  ));

-- Dialogue sessions policies
CREATE POLICY "Users can CRUD own sessions" ON dialogue_sessions
  FOR ALL USING (dialogue_id IN (
    SELECT id FROM manual_dialogues 
    WHERE user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  ));

-- Audio segments policies
CREATE POLICY "Users can CRUD own audio segments" ON audio_segments
  FOR ALL USING (dialogue_id IN (
    SELECT id FROM manual_dialogues 
    WHERE user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  ));

-- Dialogue chunks policies
CREATE POLICY "Users can CRUD own chunks" ON dialogue_chunks
  FOR ALL USING (dialogue_id IN (
    SELECT id FROM manual_dialogues 
    WHERE user_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  ));

-- Conversations policies
CREATE POLICY "Users can CRUD own conversations" ON conversations
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.uid()::text
  ));

-- Published dialogues policies
CREATE POLICY "Users can read all published dialogues" ON published_dialogues
  FOR SELECT USING (true);

CREATE POLICY "Users can create and update own published dialogues" ON published_dialogues
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.uid()::text
  ));

-- Create functions for incrementing counts
CREATE OR REPLACE FUNCTION increment_play_count(dialogue_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE published_dialogues
  SET plays = plays + 1
  WHERE id = dialogue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_like_count(dialogue_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE published_dialogues
  SET likes = likes + 1
  WHERE id = dialogue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_share_count(dialogue_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE published_dialogues
  SET shares = shares + 1
  WHERE id = dialogue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
