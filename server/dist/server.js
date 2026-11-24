"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverTelemetry = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const quotaGate_1 = require("./middleware/quotaGate");
const requireAuth_1 = require("./middleware/requireAuth");
const supabase_1 = require("./lib/supabase");
const games_1 = require("./routes/games");
const leaderboard_1 = require("./routes/leaderboard");
const admin_1 = require("./routes/admin");
const requireAdmin_1 = require("./middleware/requireAdmin");
const gameStatus_1 = require("./lib/gameStatus");
const rateLimit_1 = require("./middleware/rateLimit");
const rateLimit_2 = require("./middleware/rateLimit");
const owner_1 = require("./lib/owner");
dotenv_1.default.config();
exports.serverTelemetry = {
    bootTime: Date.now(),
    totalRequests: 0,
    endpointCounts: {
        games: 0,
        leaderboard: 0,
        admin: 0,
        auth: 0,
        status: 0,
        other: 0,
    },
    aiCallCount: 0,
    rateLimit429Count: 0,
    error4xxCount: 0,
    error5xxCount: 0,
    totalLatencyMs: 0,
    latencyCount: 0,
};
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 10000;
// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            console.log("Blocked by CORS:", origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Bot/spam throttle — skips /api/admin/* so the overlord console stays unblocked
app.use(rateLimit_2.abuseRateLimit);
// Global no-cache headers (prevents proxy, CDN, and browser caching)
app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
// Telemetry & metrics middleware
app.use((req, res, next) => {
    const start = Date.now();
    exports.serverTelemetry.totalRequests++;
    const path = req.path || '';
    if (path.startsWith('/api/games'))
        exports.serverTelemetry.endpointCounts.games++;
    else if (path.startsWith('/api/leaderboard'))
        exports.serverTelemetry.endpointCounts.leaderboard++;
    else if (path.startsWith('/api/admin'))
        exports.serverTelemetry.endpointCounts.admin++;
    else if (path.startsWith('/api/auth'))
        exports.serverTelemetry.endpointCounts.auth++;
    else if (path.startsWith('/api/status'))
        exports.serverTelemetry.endpointCounts.status++;
    else
        exports.serverTelemetry.endpointCounts.other++;
    res.on('finish', () => {
        const duration = Date.now() - start;
        exports.serverTelemetry.totalLatencyMs += duration;
        exports.serverTelemetry.latencyCount++;
        if (res.statusCode === 429) {
            exports.serverTelemetry.rateLimit429Count++;
        }
        else if (res.statusCode >= 500) {
            exports.serverTelemetry.error5xxCount++;
        }
        else if (res.statusCode >= 400) {
            exports.serverTelemetry.error4xxCount++;
        }
    });
    next();
});
// ── Routes ────────────────────────────────────────────────────────────────────
/** Health check — used by deploy platforms & load balancers */
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
/** API root */
app.get('/api', (_req, res) => {
    res.json({
        name: 'PIXELVERSE API',
        version: '1.0.0',
        message: 'Welcome to the arcade. 🕹️',
    });
});
/** Public live system status for dashboard and client state */
app.get('/api/status', async (_req, res) => {
    try {
        const [maintenance_mode, gameStatus] = await Promise.all([
            (0, gameStatus_1.getMaintenanceMode)(),
            (0, gameStatus_1.getGameStatus)(),
        ]);
        return res.json({
            maintenance_mode,
            gameStatus,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        console.warn('[status] Failed to fetch system status:', err);
        return res.status(500).json({ error: 'failed_to_fetch_status' });
    }
});
/** Authenticated User Profile, Daily Usage, Play Count & Supreme Owner Flag */
app.get('/api/auth/me', (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 60, keyPrefix: 'auth' }), requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email || '';
        const today = new Date().toISOString().split('T')[0];
        const [dailyRes, profileRes] = await Promise.all([
            supabase_1.supabaseAdmin
                .from('daily_usage')
                .select('ai_calls_count')
                .eq('user_id', userId)
                .eq('usage_date', today)
                .maybeSingle(),
            supabase_1.supabaseAdmin
                .from('profiles')
                .select('username, total_plays, daily_plays, last_played_at, is_banned, is_vip')
                .eq('id', userId)
                .maybeSingle(),
        ]);
        if (dailyRes.error) {
            console.error('[auth/me] Error querying daily_usage:', dailyRes.error);
        }
        if (profileRes.error) {
            console.error('[auth/me] Error querying profiles:', profileRes.error);
        }
        const isOwner = (0, owner_1.isOwnerEmail)(email);
        const isAdmin = isOwner;
        // Mirror playGate's UTC calendar-day rollover so the client never sees a
        // stale daily_plays count carried over from a previous UTC day.
        const lastPlayedDateStr = profileRes.data?.last_played_at
            ? new Date(profileRes.data.last_played_at).toISOString().split('T')[0]
            : null;
        const effectiveDailyPlays = lastPlayedDateStr === today
            ? (profileRes.data?.daily_plays ?? 0)
            : 0;
        const isVip = isOwner || profileRes.data?.is_vip === true;
        const dailyLimit = isOwner ? 999999 : (isVip ? 25 : 10);
        const usedOrbs = isOwner ? 0 : effectiveDailyPlays;
        const remainingOrbs = isOwner ? 999999 : Math.max(0, dailyLimit - usedOrbs);
        return res.json({
            id: userId,
            email,
            username: profileRes.data?.username || null,
            isOwner,
            isAdmin,
            todayUsage: isOwner ? 0 : (dailyRes.data?.ai_calls_count || 0),
            usedOrbs,
            dailyLimit,
            remainingOrbs,
            isVip,
            daily_plays: effectiveDailyPlays,
            total_plays: profileRes.data?.total_plays ?? 0,
            is_banned: isOwner ? false : (profileRes.data?.is_banned ?? false),
        });
    }
    catch (err) {
        console.error('[auth/me] Unexpected error:', err);
        return res.status(500).json({ error: 'internal_error' });
    }
});
/** Update custom username */
app.post('/api/auth/username', (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 20, keyPrefix: 'username' }), requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const rawUsername = req.body?.username;
        if (!rawUsername || typeof rawUsername !== 'string') {
            return res.status(400).json({
                error: 'INVALID_USERNAME',
                message: 'Username is required and must be a string.',
            });
        }
        const cleanUsername = rawUsername.trim();
        // Validate: 3 to 18 characters, alphanumeric + underscore
        if (!/^[a-zA-Z0-9_]{3,18}$/.test(cleanUsername)) {
            return res.status(400).json({
                error: 'INVALID_USERNAME',
                message: 'Username must be 3-18 characters and contain only letters, numbers, and underscores.',
            });
        }
        // Check case-insensitive uniqueness across profiles (excluding current user)
        const { data: existingUser, error: queryErr } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('username', cleanUsername)
            .neq('id', userId)
            .maybeSingle();
        if (queryErr) {
            console.warn('[auth/username] Error checking username uniqueness:', queryErr.message);
        }
        if (existingUser) {
            return res.status(409).json({
                error: 'USERNAME_TAKEN',
                message: 'Username is already taken. Please choose another.',
            });
        }
        // Upsert username into profiles
        const { error: updateErr } = await supabase_1.supabaseAdmin
            .from('profiles')
            .upsert({ id: userId, username: cleanUsername }, { onConflict: 'id' });
        if (updateErr) {
            console.error('[auth/username] Error updating username:', updateErr);
            return res.status(500).json({
                error: 'FAILED_TO_UPDATE',
                message: 'Failed to update username. Please try again.',
            });
        }
        return res.json({
            success: true,
            username: cleanUsername,
        });
    }
    catch (err) {
        console.error('[auth/username] Unexpected error:', err);
        return res.status(500).json({ error: 'internal_error' });
    }
});
/** Quota gate test route */
app.post('/api/test-quota', requireAuth_1.requireAuth, quotaGate_1.quotaGate, (_req, res) => {
    res.json({ message: 'Success! You bypassed the quota gate.' });
});
/** Games routes (Jailbreak, Higher-Lower, etc.) */
app.use('/api/games', games_1.gamesRouter);
/** Leaderboards (rate-limited; admin routes are intentionally exempt) */
app.use('/api/leaderboard', (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 30, keyPrefix: 'leaderboard' }), leaderboard_1.leaderboardRouter);
/** Admin Console (Overlord) */
app.use('/api/admin', requireAuth_1.requireAuth, requireAdmin_1.requireAdmin, admin_1.adminRouter);
// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});
// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🕹️  PIXELVERSE server running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map