import { Router, Request, Response } from 'express';
import { quotaGate } from '../middleware/quotaGate';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import {
  generateJailbreakRole,
  generateJailbreakTurn,
  generateHigherLowerQuestions,
} from '../lib/gemini';

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
 * ── 3. Higher or Lower: Question Pool Cache ──────────────────────────────────
 * POST /api/games/higher-lower/generate (also supports GET)
 *
 * Step 1: Query Supabase for 10 questions from hl_questions where is_used = false.
 * Step 2: If 10 questions found, instantly return them without calling AI.
 * Step 3: If fewer than 10 questions available, call Gemini to generate 20 questions.
 * Step 4: Save all 20 newly generated questions to hl_questions table.
 * Step 5: Return the first 10 to the frontend.
 */
const handleHigherLowerGenerate = async (_req: Request, res: Response) => {
  try {
    // Step 1: Query Supabase for 10 unused questions
    const { data: cached, error: queryError } = await supabaseAdmin
      .from('hl_questions')
      .select('*')
      .eq('is_used', false)
      .limit(10);

    // Step 2: If it finds 10 questions, instantly return them. Do NOT call the AI.
    if (!queryError && cached && cached.length >= 10) {
      console.log('[HigherLower] Cache hit! Returning 10 questions directly from Supabase pool.');

      // Mark these 10 questions as used so pool advances
      const ids = cached.map((q) => q.id);
      await supabaseAdmin
        .from('hl_questions')
        .update({ is_used: true })
        .in('id', ids);

      const formatted = cached.map((q) => ({
        factA: q.fact_a,
        factB: q.fact_b,
        answer: q.answer,
        explanation: q.explanation,
      }));

      return res.json(formatted);
    }

    // Step 3: Fewer than 10 in cache -> Generate 20 questions via Gemini
    console.log('[HigherLower] Cache pool has <10 questions. Generating 20 questions via Gemini API...');
    const generated20 = await generateHigherLowerQuestions(20);

    // Step 4: Save all 20 newly generated questions to hl_questions table
    const rowsToInsert = generated20.map((q, idx) => ({
      fact_a: q.factA,
      fact_b: q.factB,
      answer: q.answer,
      explanation: q.explanation,
      is_used: idx < 10, // First 10 are used for current round; remaining 10 stay unused for next round
    }));

    const { error: insertError } = await supabaseAdmin
      .from('hl_questions')
      .insert(rowsToInsert);

    if (insertError) {
      console.warn('[HigherLower] Warning: Failed to save questions in Supabase:', insertError.message);
    } else {
      console.log('[HigherLower] Successfully saved 20 questions to hl_questions pool.');
    }

    // Step 5: Return the first 10 to the frontend
    const first10 = generated20.slice(0, 10).map((q) => ({
      factA: q.factA,
      factB: q.factB,
      answer: q.answer,
      explanation: q.explanation,
    }));

    return res.json(first10);
  } catch (err: any) {
    console.error('[higher-lower/generate] Error in question cache pipeline:', err);
    const fallback = await generateHigherLowerQuestions(10);
    return res.json(fallback.slice(0, 10));
  }
};

gamesRouter.post(
  ['/higher-lower/generate', '/api/games/higher-lower/generate'],
  handleHigherLowerGenerate
);
gamesRouter.get(
  ['/higher-lower/generate', '/api/games/higher-lower/generate'],
  handleHigherLowerGenerate
);

export default gamesRouter;
