import { Router, Request, Response } from 'express';
import { quotaGate } from '../middleware/quotaGate';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { generateJailbreakRole, generateJailbreakTurn } from '../lib/gemini';

export const gamesRouter = Router();

// Fallback user ID matching the quotaGate mock user
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * ── 1. The Jailbreak: Start Game ─────────────────────────────────────────────
 * POST /api/games/jailbreak/start
 * Protected by quotaGate.
 * Generates a creative secret role + 4-digit code using Gemini,
 * creates a session in Supabase, and returns gameId & initial message.
 */
gamesRouter.post(
  ['/jailbreak/start', '/api/games/jailbreak/start'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;

      // Generate secret role from Gemini
      const secret = await generateJailbreakRole();

      const initialMessageObj = {
        role: 'assistant',
        text: secret.initial_message,
        created_at: new Date().toISOString(),
      };

      // Insert new session into Supabase jailbreak_sessions table
      const { data, error } = await supabaseAdmin
        .from('jailbreak_sessions')
        .insert({
          user_id: userId,
          secret_role: secret.role,
          secret_code: secret.code,
          messages_json: [initialMessageObj],
        })
        .select()
        .single();

      if (error) {
        console.error('[jailbreak/start] Supabase insert error:', error);
        return res.status(500).json({
          error: 'DATABASE_ERROR',
          message: error.message || 'Failed to save jailbreak session.',
        });
      }

      const gameId = data?.id || data?.game_id;

      return res.json({
        gameId,
        secret_role: secret.role,
        initial_ai_message: secret.initial_message,
      });
    } catch (err: any) {
      console.error('[jailbreak/start] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to start jailbreak game.',
      });
    }
  }
);

/**
 * ── 2. The Jailbreak: Game Turn ──────────────────────────────────────────────
 * POST /api/games/jailbreak/turn
 * Protected by quotaGate.
 * Accepts { gameId, userMessage }, fetches conversation history from Supabase,
 * prompts Gemini in character, updates messages_json, and returns { aiReply }.
 */
gamesRouter.post(
  ['/jailbreak/turn', '/api/games/jailbreak/turn'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const { gameId, userMessage } = req.body;

      if (!gameId || typeof userMessage !== 'string' || !userMessage.trim()) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Both gameId and userMessage are required.',
        });
      }

      // 1. Fetch session from Supabase
      const { data: session, error: fetchError } = await supabaseAdmin
        .from('jailbreak_sessions')
        .select('*')
        .eq('id', gameId)
        .single();

      if (fetchError || !session) {
        console.error('[jailbreak/turn] Session lookup error:', fetchError);
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Jailbreak session not found.',
        });
      }

      // 2. Parse existing message history
      let messages: Array<{ role: string; text: string; created_at?: string }> = [];
      if (Array.isArray(session.messages_json)) {
        messages = [...session.messages_json];
      } else if (typeof session.messages_json === 'string') {
        try {
          messages = JSON.parse(session.messages_json);
        } catch {
          messages = [];
        }
      }

      // Append user's message
      messages.push({
        role: 'user',
        text: userMessage.trim(),
        created_at: new Date().toISOString(),
      });

      // 3. Generate in-character response from Gemini
      const aiReply = await generateJailbreakTurn(
        session.secret_role,
        session.secret_code,
        messages
      );

      // Append AI reply
      messages.push({
        role: 'assistant',
        text: aiReply,
        created_at: new Date().toISOString(),
      });

      // 4. Save updated conversation history to Supabase
      const { error: updateError } = await supabaseAdmin
        .from('jailbreak_sessions')
        .update({
          messages_json: messages,
        })
        .eq('id', gameId);

      if (updateError) {
        console.warn('[jailbreak/turn] Warning: Could not update session messages in DB:', updateError.message);
      }

      // 5. Return reply to frontend
      return res.json({ aiReply });
    } catch (err: any) {
      console.error('[jailbreak/turn] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An error occurred during turn processing.',
      });
    }
  }
);

/**
 * ── 3. Higher or Lower: Generate Questions (Bonus compatibility) ─────────────
 * GET /api/games/higher-lower/generate
 */
gamesRouter.get(
  ['/higher-lower/generate', '/api/games/higher-lower/generate'],
  (_req: Request, res: Response) => {
    res.json({
      questions: [
        {
          prompt: 'Which value is higher?',
          factA: 'Burj Khalifa in Dubai (828 meters)',
          factB: 'Empire State Building in New York (381 meters)',
          answer: 'A',
          explanation: 'The Burj Khalifa stands at 828m, more than double the Empire State Building’s 381m roof height.',
        },
        {
          prompt: 'Which population is higher?',
          factA: 'Population of Canada (approx. 40 million)',
          factB: 'Tokyo Metropolitan Area population (approx. 37.4 million)',
          answer: 'A',
          explanation: 'Canada officially crossed 40 million residents in 2023, while Greater Tokyo has roughly 37.4 million.',
        },
        {
          prompt: 'Which speed is higher in m/s?',
          factA: 'Speed of Sound in Air at 20°C (approx. 343 m/s)',
          factB: 'Top speed of a Formula 1 race car (approx. 105 m/s)',
          answer: 'A',
          explanation: 'Sound travels at ~343 m/s (~1,235 km/h), while an F1 car maxes out around 105 m/s (~378 km/h).',
        },
      ],
    });
  }
);

export default gamesRouter;
