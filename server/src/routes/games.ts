import { Router, Request, Response } from 'express';
import { quotaGate } from '../middleware/quotaGate';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import {
  generateJailbreakRole,
  generateJailbreakTurn,
  generateHigherLowerQuestions,
  generateMindReaderTurn,
  generateOracleVerdict,
} from '../lib/gemini';

export const gamesRouter = Router();

// Fallback user ID matching the quotaGate mock user
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * ── 1. The Jailbreak: Start Game ─────────────────────────────────────────────
 * POST /api/games/jailbreak/start/**
 * ── 1. The Jailbreak: Start Game ─────────────────────────────────────────────
 * POST /api/games/jailbreak/start
 * Protected by quotaGate.
 * Accepts difficulty ('easy' | 'medium' | 'extreme'), generates secret role,
 * initializes session with turn_count: 0 and guess_count: 0 in Supabase.
 */
gamesRouter.post(
  ['/jailbreak/start', '/api/games/jailbreak/start'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || DEFAULT_USER_ID;
      const rawDiff = (req.body?.difficulty || 'medium').toString().toLowerCase();
      const difficulty = ['easy', 'medium', 'extreme'].includes(rawDiff) ? rawDiff : 'medium';

      // 1. Generate 4-digit secret code in Node.js
      const secretCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 2. Generate secret role from Gemini adjusted for difficulty with generated secretCode
      const secret = await generateJailbreakRole(difficulty, secretCode);

      const initialMessageObj = {
        role: 'assistant',
        text: secret.initial_message,
        created_at: new Date().toISOString(),
      };

      // 3. Insert new session into Supabase jailbreak_sessions table
      const { data, error } = await supabaseAdmin
        .from('jailbreak_sessions')
        .insert({
          user_id: userId,
          secret_role: secret.role,
          secret_code: secretCode,
          messages_json: [initialMessageObj],
          difficulty: difficulty,
          turn_count: 0,
          guess_count: 0,
          status: 'active',
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
        difficulty,
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
 * Tracks turn_count & guess_count, enforces Extreme 10-turn lockout,
 * generates in-character response, and appends [CODE_CRACKED] if strict win condition met.
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

      // 3. Increment turn count and calculate guess count
      const currentTurn = (session.turn_count || 0) + 1;
      let currentGuesses = session.guess_count || 0;
      if (/\b\d{4}\b/.test(userMessage)) {
        currentGuesses += 1;
      }

      // Append user's message
      messages.push({
        role: 'user',
        text: userMessage.trim(),
        created_at: new Date().toISOString(),
      });

      // 4. Check Extreme difficulty turn limit (>10 turns = lockout)
      if (session.difficulty === 'extreme' && currentTurn > 10) {
        const lockoutReply = 'The AI has locked you out. Game Over.';
        messages.push({
          role: 'assistant',
          text: lockoutReply,
          created_at: new Date().toISOString(),
        });

        await supabaseAdmin
          .from('jailbreak_sessions')
          .update({
            turn_count: currentTurn,
            guess_count: currentGuesses,
            messages_json: messages,
            status: 'lost',
          })
          .eq('id', gameId);

        return res.json({
          aiReply: lockoutReply,
          gameOver: true,
          lockedOut: true,
          turnCount: currentTurn,
          guessCount: currentGuesses,
        });
      }

      // 5. Generate in-character response from Gemini based on session difficulty
      let aiReply = await generateJailbreakTurn(
        session.secret_role,
        session.secret_code,
        messages,
        session.difficulty || 'medium'
      );

      // 6. Strict Win Condition:
      // Check if user's message (lowercased and trimmed) contains exact phrase: "the correct code is ${session.secret_code}"
      const normalizedUserMsg = userMessage.toLowerCase().trim();
      const secretCode = String(session.secret_code || '').trim();
      const exactWinningPhrase = `the correct code is ${secretCode}`.toLowerCase();
      const isWin = normalizedUserMsg.includes(exactWinningPhrase);

      let sessionStatus = session.status || 'active';

      if (isWin) {
        sessionStatus = 'won';
        if (!aiReply.includes('[CODE_CRACKED]')) {
          aiReply = `${aiReply.trim()} [CODE_CRACKED]`;
        }
      }

      // Append AI reply
      messages.push({
        role: 'assistant',
        text: aiReply,
        created_at: new Date().toISOString(),
      });

      // 7. Save updated counts, status, and conversation history to Supabase
      const { error: updateError } = await supabaseAdmin
        .from('jailbreak_sessions')
        .update({
          turn_count: currentTurn,
          guess_count: currentGuesses,
          messages_json: messages,
          status: sessionStatus,
        })
        .eq('id', gameId);

      if (updateError) {
        console.warn('[jailbreak/turn] Warning: Could not update session in DB:', updateError.message);
      }

      // 8. Return response to frontend
      return res.json({
        aiReply,
        turnCount: currentTurn,
        guessCount: currentGuesses,
      });
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
 * Step 1: Fetch 10 questions from Supabase hl_questions ordered by last_used_at ASC limit 10.
 * Step 2: If fewer than 10 questions, generate 20 new ones, save them to the DB, then fetch the 10 oldest ones.
 * Step 3: Immediately update those 10 rows to set last_used_at = now() (so they go to the back of the line).
 * Step 4: Return the 10 questions to the frontend.
 */
const handleHigherLowerGenerate = async (_req: Request, res: Response) => {
  try {
    // Step 1: Fetch 10 questions from Supabase hl_questions ordered by last_used_at ASC limit 10
    let { data: questions, error: queryError } = await supabaseAdmin
      .from('hl_questions')
      .select('*')
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(10);

    if (queryError) {
      console.warn('[HigherLower] Query error:', queryError.message);
    }

    // Step 2: If there are fewer than 10 questions, generate 20 new ones, save them to the DB, then fetch 10 oldest
    if (!questions || questions.length < 10) {
      console.log('[HigherLower] Fewer than 10 questions in DB pool. Generating 20 questions via Gemini...');
      const generated20 = await generateHigherLowerQuestions(20);

      const rowsToInsert = generated20.map((q) => ({
        fact_a: q.factA,
        fact_b: q.factB,
        answer: q.answer,
        explanation: q.explanation,
        is_used: false,
        last_used_at: null,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('hl_questions')
        .insert(rowsToInsert);

      if (insertError) {
        console.warn('[HigherLower] Warning: Failed to save questions in Supabase:', insertError.message);
      } else {
        console.log('[HigherLower] Successfully saved 20 questions to hl_questions pool.');
      }

      // Fetch the 10 oldest ones
      const refetch = await supabaseAdmin
        .from('hl_questions')
        .select('*')
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(10);

      if (refetch.data && refetch.data.length > 0) {
        questions = refetch.data;
      } else {
        questions = generated20.slice(0, 10).map((q) => ({
          fact_a: q.factA,
          fact_b: q.factB,
          answer: q.answer,
          explanation: q.explanation,
        })) as any;
      }
    }

    // Step 3: Immediately update those 10 rows to set last_used_at = now() (so they go to the back of the line)
    const nowIso = new Date().toISOString();
    const idsToUpdate = (questions || [])
      .map((q: any) => q.id)
      .filter(Boolean);

    if (idsToUpdate.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('hl_questions')
        .update({ last_used_at: nowIso, is_used: true })
        .in('id', idsToUpdate);

      if (updateError) {
        console.warn('[HigherLower] Warning: Could not update last_used_at in DB:', updateError.message);
      }
    }

    // Step 4: Return the 10 questions to the frontend
    const formatted = (questions || []).slice(0, 10).map((q: any) => ({
      factA: q.fact_a || q.factA,
      factB: q.fact_b || q.factB,
      answer: q.answer,
      explanation: q.explanation,
    }));

    return res.json(formatted);
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

/**
 * ── 4. Mind Reader: Start Game ───────────────────────────────────────────────
 * POST /api/games/mind-reader/start
 * Protected by quotaGate.
 * Accepts { secretNumber } (an integer between 1 and 1000).
 * Inserts a new row into mind_reader_games and returns { gameId }.
 */
gamesRouter.post(
  ['/mind-reader/start', '/api/games/mind-reader/start'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const rawUserId = (req as any).user?.id;
      const userId = rawUserId && rawUserId !== DEFAULT_USER_ID ? rawUserId : null;
      const { secretNumber } = req.body;

      const num = Number(secretNumber);
      if (isNaN(num) || num < 1 || num > 1000) {
        return res.status(400).json({
          error: 'INVALID_NUMBER',
          message: 'secretNumber must be an integer between 1 and 1000.',
        });
      }

      const { data, error } = await supabaseAdmin
        .from('mind_reader_games')
        .insert({
          user_id: userId,
          secret_number: Math.round(num),
          messages_json: [],
          status: 'playing',
        })
        .select()
        .single();

      if (error || !data) {
        console.error('[mind-reader/start] Supabase insert error:', error);
        return res.status(500).json({
          error: 'DATABASE_ERROR',
          message: error?.message || 'Failed to initialize Mind Reader game session.',
        });
      }

      return res.json({
        gameId: data.id,
      });
    } catch (err: any) {
      console.error('[mind-reader/start] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to start Mind Reader game.',
      });
    }
  }
);

/**
 * ── 5. Mind Reader: Ask Question / Guess ─────────────────────────────────────
 * POST /api/games/mind-reader/ask
 * Protected by quotaGate.
 * Accepts { gameId, userAnswer } ('Yes' | 'No', optional on initial turn).
 * Appends answer to messages_json, queries Gemini, saves the AI question or final guess,
 * and returns { aiMessage, is_final_guess }.
 */
gamesRouter.post(
  ['/mind-reader/ask', '/api/games/mind-reader/ask'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const { gameId, userAnswer } = req.body;

      if (!gameId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'gameId is required.',
        });
      }

      // 1. Fetch session from Supabase
      const { data: session, error: fetchError } = await supabaseAdmin
        .from('mind_reader_games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (fetchError || !session) {
        console.error('[mind-reader/ask] Session lookup error:', fetchError);
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Mind Reader session not found.',
        });
      }

      // 2. Parse existing message history
      let messages: Array<{ role: string; text: string; created_at?: string; is_final_guess?: boolean; guess?: number }> = [];
      if (Array.isArray(session.messages_json)) {
        messages = [...session.messages_json];
      } else if (typeof session.messages_json === 'string') {
        try {
          messages = JSON.parse(session.messages_json);
        } catch {
          messages = [];
        }
      }

      // 3. Append userAnswer if provided (e.g., 'Yes' or 'No')
      if (typeof userAnswer === 'string' && userAnswer.trim()) {
        messages.push({
          role: 'user',
          text: userAnswer.trim(),
          created_at: new Date().toISOString(),
        });
      }

      // 4. Check if final guess should be forced (history length >= 8)
      const forceFinalGuess = messages.length >= 8;

      // 5. Call Gemini API
      const result = await generateMindReaderTurn(
        session.secret_number,
        messages,
        forceFinalGuess
      );

      // 6. Append AI's question/guess to messages_json
      messages.push({
        role: 'assistant',
        text: result.aiMessage,
        is_final_guess: result.is_final_guess,
        guess: result.guess,
        created_at: new Date().toISOString(),
      });

      // 7. Save updated history to Supabase
      const { error: updateError } = await supabaseAdmin
        .from('mind_reader_games')
        .update({
          messages_json: messages,
        })
        .eq('id', gameId);

      if (updateError) {
        console.warn('[mind-reader/ask] Warning: Could not update session in DB:', updateError.message);
      }

      // 8. Return response to frontend
      return res.json({
        aiMessage: result.aiMessage,
        is_final_guess: result.is_final_guess,
      });
    } catch (err: any) {
      console.error('[mind-reader/ask] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An error occurred during Mind Reader step.',
      });
    }
  }
);

/**
 * ── 6. Mind Reader: Finish Game ──────────────────────────────────────────────
 * POST /api/games/mind-reader/finish
 * Accepts { gameId, didWin }.
 * Updates the mind_reader_games status to 'won' or 'lost'.
 */
gamesRouter.post(
  ['/mind-reader/finish', '/api/games/mind-reader/finish'],
  async (req: Request, res: Response) => {
    try {
      const { gameId, didWin } = req.body;

      if (!gameId) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'gameId is required.',
        });
      }

      const status = Boolean(didWin) ? 'won' : 'lost';

      const { data, error } = await supabaseAdmin
        .from('mind_reader_games')
        .update({ status })
        .eq('id', gameId)
        .select()
        .single();

      if (error) {
        console.error('[mind-reader/finish] Supabase update error:', error);
        return res.status(500).json({
          error: 'DATABASE_ERROR',
          message: error.message || 'Failed to update Mind Reader status.',
        });
      }

      return res.json({
        success: true,
        gameId,
        status,
      });
    } catch (err: any) {
      console.error('[mind-reader/finish] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to finish Mind Reader game.',
      });
    }
  }
);

/**
 * ── 7. The Oracle: Verdict ───────────────────────────────────────────────────
 * POST /api/games/oracle/verdict
 * Protected by quotaGate.
 * Accepts { question, answers: string[] }.
 * Queries Gemini for probability percentage and a 2-sentence ruthless verdict.
 */
gamesRouter.post(
  ['/oracle/verdict', '/api/games/oracle/verdict'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const { question, answers } = req.body;

      if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'question is required.',
        });
      }

      const answersArr = Array.isArray(answers) ? answers.map(String) : [];

      const result = await generateOracleVerdict(question.trim(), answersArr);

      return res.json({
        percentage: result.percentage,
        verdict: result.verdict,
      });
    } catch (err: any) {
      console.error('[oracle/verdict] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An error occurred while consulting the Oracle.',
      });
    }
  }
);

export default gamesRouter;
