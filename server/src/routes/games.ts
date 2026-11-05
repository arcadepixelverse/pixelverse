import { Router, Request, Response } from 'express';
import { quotaGate } from '../middleware/quotaGate';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import {
  generateJailbreakRole,
  generateJailbreakTurn,
  generateHigherLowerQuestions,
  generateTuringTestRounds,
  generateTuringRawBatch,
  formatAndShuffleRounds,
  TuringDifficulty,
  generateSurvivalScenario,
  generateSurvivalScenariosBatch,
  judgeSurvivalAttempt,
  SurvivalScenarioResult,
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
          min_guess: 1,
          max_guess: 1000,
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
 * ── 5. Mind Reader: Pure Binary Search Logic (Node.js) ───────────────────────
 * POST /api/games/mind-reader/ask
 * Protected by quotaGate.
 * Accepts { gameId, userAnswer } ('Yes' | 'No', optional on initial turn).
 * Performs mathematical binary search between min_guess and max_guess without AI.
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

      let min_guess = Number(session.min_guess ?? 1);
      let max_guess = Number(session.max_guess ?? 1000);

      // Parse existing message history
      let messages: Array<{
        role: string;
        text: string;
        created_at?: string;
        is_final_guess?: boolean;
        guess?: number;
        confidence?: number;
      }> = [];
      if (Array.isArray(session.messages_json)) {
        messages = [...session.messages_json];
      } else if (typeof session.messages_json === 'string') {
        try {
          messages = JSON.parse(session.messages_json);
        } catch {
          messages = [];
        }
      }

      // 2. Process user answer if provided ('Yes' or 'No')
      if (typeof userAnswer === 'string' && userAnswer.trim()) {
        const answer = userAnswer.trim().toLowerCase();
        messages.push({
          role: 'user',
          text: userAnswer.trim(),
          created_at: new Date().toISOString(),
        });

        // The question asked previously was "Is your number greater than ${mid}?"
        const currentMid = Math.floor((min_guess + max_guess) / 2);

        if (answer === 'yes') {
          min_guess = currentMid + 1;
        } else if (answer === 'no') {
          max_guess = currentMid;
        }
      }

      // 3. If min_guess === max_guess (or min_guess >= max_guess), game is over
      if (min_guess >= max_guess) {
        const guess = min_guess;
        const confidence = 100;
        const aiMessage = 'I have found it.';

        messages.push({
          role: 'assistant',
          text: aiMessage,
          is_final_guess: true,
          guess,
          confidence,
          created_at: new Date().toISOString(),
        });

        await supabaseAdmin
          .from('mind_reader_games')
          .update({
            min_guess,
            max_guess,
            messages_json: messages,
            status: 'reveal',
          })
          .eq('id', gameId);

        return res.json({
          is_final_guess: true,
          guess,
          confidence: 100,
          aiMessage,
          currentMin: min_guess,
          currentMax: max_guess,
        });
      }

      // 4. Otherwise calculate mid and confidence based on remaining range
      const mid = Math.floor((min_guess + max_guess) / 2);
      const confidence = Math.max(
        0,
        Math.min(99, Math.round(100 - ((max_guess - min_guess) / 1000) * 100))
      );
      const aiMessage = `Is your number greater than ${mid}?`;

      messages.push({
        role: 'assistant',
        text: aiMessage,
        is_final_guess: false,
        created_at: new Date().toISOString(),
      });

      await supabaseAdmin
        .from('mind_reader_games')
        .update({
          min_guess,
          max_guess,
          messages_json: messages,
        })
        .eq('id', gameId);

      return res.json({
        is_final_guess: false,
        aiMessage,
        confidence,
        currentMin: min_guess,
        currentMax: max_guess,
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
 * ── 7. The Turing Test: Generate 5 Rounds ────────────────────────────────────
 * POST /api/games/turing-test/generate
 * Protected by quotaGate.
 * Accepts { difficulty: 'fun' | 'normal' | 'serious' } in request body.
 * Queries Supabase `turing_scenarios` ordered by last_used_at ASC limit 5.
 * If 5 exist: updates last_used_at = now() and returns them (no AI call).
 * If < 5 exist: generates 15 new questions via Gemini, saves them, fetches 5 oldest,
 * updates last_used_at = now(), and returns them formatted and shuffled.
 */
gamesRouter.post(
  ['/turing-test/generate', '/api/games/turing-test/generate'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const rawDifficulty = req.body?.difficulty;
      const validDifficulty: TuringDifficulty =
        rawDifficulty === 'fun' || rawDifficulty === 'serious' || rawDifficulty === 'normal'
          ? rawDifficulty
          : 'normal';

      // Step 1: Query Supabase for 5 questions matching difficulty ordered by last_used_at ASC
      let { data: questions, error: queryError } = await supabaseAdmin
        .from('turing_scenarios')
        .select('*')
        .eq('difficulty', validDifficulty)
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(5);

      if (queryError) {
        console.warn('[turing-test/generate] Supabase query error:', queryError.message);
      }

      // Step 2: If < 5 exist, generate 15 new questions via Gemini, save to DB, and refetch
      if (!questions || questions.length < 5) {
        console.log(`[turing-test/generate] Found ${questions?.length || 0} questions in DB for '${validDifficulty}'. Generating 15 new questions...`);
        const generated15 = await generateTuringRawBatch(validDifficulty, 15);

        const rowsToInsert = generated15.map((q) => ({
          question: q.question,
          human_answer: q.human_answer,
          ai_answer: q.ai_answer,
          difficulty: validDifficulty,
          last_used_at: null,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('turing_scenarios')
          .insert(rowsToInsert);

        if (insertError) {
          console.warn('[turing-test/generate] Failed to insert 15 questions to DB:', insertError.message);
        } else {
          console.log(`[turing-test/generate] Successfully saved 15 questions for difficulty '${validDifficulty}'.`);
        }

        // Fetch the 5 oldest matching questions
        const refetch = await supabaseAdmin
          .from('turing_scenarios')
          .select('*')
          .eq('difficulty', validDifficulty)
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(5);

        if (refetch.data && refetch.data.length >= 5) {
          questions = refetch.data;
        } else {
          // If DB is unavailable or didn't return 5, use fallback from generated
          questions = refetch.data && refetch.data.length > 0 ? refetch.data : generated15.slice(0, 5);
        }
      }

      // Step 3: Update last_used_at = now() for the selected rows
      const nowIso = new Date().toISOString();
      const idsToUpdate = questions.map((q: any) => q.id).filter(Boolean);
      if (idsToUpdate.length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('turing_scenarios')
          .update({ last_used_at: nowIso })
          .in('id', idsToUpdate);

        if (updateError) {
          console.warn('[turing-test/generate] Failed to update last_used_at:', updateError.message);
        }
      }

      // Step 4: Shuffle options and return formatted rounds
      const rounds = formatAndShuffleRounds(questions);
      return res.json(rounds);
    } catch (err: any) {
      console.error('[turing-test/generate] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to generate Turing Test rounds.',
      });
    }
  }
);

/**
 * ── 8. Survival Protocol: Start ──────────────────────────────────────────────
 * POST /api/games/survival/start
 * Protected by quotaGate.
 * Queries Supabase `survival_scenarios` ordered by last_used_at ASC limit 1.
 * If found: updates last_used_at = now() and returns immediately.
 * If not found: calls Gemini to generate 10 scenarios in batch with clues,
 * saves them to the DB, updates last_used_at = now() on the selected row, and returns it.
 */
gamesRouter.post(
  ['/survival/start', '/api/games/survival/start'],
  quotaGate,
  async (_req: Request, res: Response) => {
    try {
      // Step 1: Query Supabase for 1 scenario from survival_scenarios ordered by last_used_at ASC limit 1
      let { data: scenarios, error: queryError } = await supabaseAdmin
        .from('survival_scenarios')
        .select('*')
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(1);

      if (queryError) {
        console.warn('[Survival] Query warning for survival_scenarios:', queryError.message);
      }

      // Step 2: If no scenario found, generate 10 via Gemini in batch and save to DB
      if (!scenarios || scenarios.length === 0) {
        console.log('[Survival] No scenarios in DB pool. Generating 10 scenarios via Gemini...');
        const generated10 = await generateSurvivalScenariosBatch(10);

        const rowsToInsert = generated10.map((s) => ({
          scenario: s.scenario,
          mode: s.mode,
          required_count: s.required_count,
          allow_multiple: s.allow_multiple,
          options: s.options,
          clues: s.clues,
          last_used_at: null,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('survival_scenarios')
          .insert(rowsToInsert);

        if (insertError) {
          console.warn('[Survival] Warning: Could not insert batch to Supabase:', insertError.message);
        } else {
          console.log('[Survival] Successfully saved 10 scenarios to survival_scenarios table.');
        }

        // Fetch the oldest one from DB or return the first generated
        const refetch = await supabaseAdmin
          .from('survival_scenarios')
          .select('*')
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(1);

        if (refetch.data && refetch.data.length > 0) {
          scenarios = refetch.data;
        } else {
          // If DB insert didn't reflect yet, use first generated scenario
          return res.json(generated10[0]);
        }
      }

      const chosen = scenarios[0];
      const nowIso = new Date().toISOString();

      // Step 3: Update last_used_at = now() so it rotates to the back of the queue
      if (chosen.id) {
        const { error: updateError } = await supabaseAdmin
          .from('survival_scenarios')
          .update({ last_used_at: nowIso })
          .eq('id', chosen.id);

        if (updateError) {
          console.warn('[Survival] Warning: Failed to update last_used_at:', updateError.message);
        }
      }

      // Step 4: Return formatted scenario data with clues
      const result: SurvivalScenarioResult = {
        scenario: chosen.scenario,
        mode: chosen.mode === 'mcq' ? 'mcq' : 'typing',
        required_count: Number(chosen.required_count) || 2,
        allow_multiple: Boolean(chosen.allow_multiple),
        options: Array.isArray(chosen.options)
          ? chosen.options
          : typeof chosen.options === 'string'
          ? JSON.parse(chosen.options)
          : [],
        clues: Array.isArray(chosen.clues)
          ? chosen.clues
          : typeof chosen.clues === 'string'
          ? JSON.parse(chosen.clues)
          : ["a rusty pipe", "a puddle of oil", "a loose ceiling bracket"],
      };

      return res.json(result);
    } catch (err: any) {
      console.error('[survival/start] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to start survival scenario.',
      });
    }
  }
);

/**
 * ── 9. Survival Protocol: Judge (MacGyver Logic) ─────────────────────────────
 * POST /api/games/survival/judge
 * Protected by quotaGate.
 * Accepts { scenario, clues, userInput }.
 * Evaluates whether the chosen/typed items allow survival using environment clues.
 */
gamesRouter.post(
  ['/survival/judge', '/api/games/survival/judge'],
  quotaGate,
  async (req: Request, res: Response) => {
    try {
      const { scenario, clues, userInput, items } = req.body || {};
      const rawInput = Array.isArray(userInput) ? userInput : Array.isArray(items) ? items : [];
      const rawClues = Array.isArray(clues) ? clues : [];

      if (!scenario || typeof scenario !== 'string' || !scenario.trim()) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Scenario string is required.',
        });
      }

      if (!Array.isArray(rawInput) || rawInput.length === 0 || rawInput.some((item) => typeof item !== 'string' || !item.trim())) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Non-empty userInput array is required.',
        });
      }

      const result = await judgeSurvivalAttempt(scenario, rawClues, rawInput);
      return res.json(result);
    } catch (err: any) {
      console.error('[survival/judge] Error:', err);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Failed to judge survival attempt.',
      });
    }
  }
);

export default gamesRouter;
