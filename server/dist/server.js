"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const quotaGate_1 = require("./middleware/quotaGate");
const requireAuth_1 = require("./middleware/requireAuth");
const supabase_1 = require("./lib/supabase");
const games_1 = require("./routes/games");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 10000;
// ── Middleware ────────────────────────────────────────────────────────────────
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
/** Authenticated User Profile & Daily Usage */
app.get('/api/auth/me', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabaseAdmin
            .from('daily_usage')
            .select('ai_calls_count')
            .eq('user_id', userId)
            .eq('usage_date', today)
            .maybeSingle();
        if (error) {
            console.error('[auth/me] Error querying daily_usage:', error);
            return res.json({ id: userId, email, todayUsage: 0 });
        }
        return res.json({
            id: userId,
            email,
            todayUsage: data?.ai_calls_count || 0,
        });
    }
    catch (err) {
        console.error('[auth/me] Unexpected error:', err);
        return res.status(500).json({ error: 'internal_error' });
    }
});
/** Quota gate test route */
app.post('/api/test-quota', requireAuth_1.requireAuth, quotaGate_1.quotaGate, (_req, res) => {
    res.json({ message: 'Success! You bypassed the quota gate.' });
});
/** Games routes (Jailbreak, Higher-Lower, etc.) */
app.use('/api/games', games_1.gamesRouter);
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