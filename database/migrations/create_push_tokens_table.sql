-- Create user_push_tokens table for storing Expo push notification tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert/update their own push tokens
CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Allow reading push tokens for notification sending (server-side)
CREATE POLICY "Allow reading push tokens for notifications"
  ON user_push_tokens
  FOR SELECT
  USING (true);

COMMENT ON TABLE user_push_tokens IS 'Stores Expo push notification tokens for users';
COMMENT ON COLUMN user_push_tokens.push_token IS 'Expo push token (ExponentPushToken[...])';
