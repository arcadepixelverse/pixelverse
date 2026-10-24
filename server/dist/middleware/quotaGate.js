"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotaGate = void 0;
const supabaseAdmin_1 = require("../lib/supabaseAdmin");
const quotaGate = async (req, res, next) => {
    try {
        const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
        const limit = 10;
        // Call Supabase RPC check_and_increment_usage with exact parameters
        const { data, error } = await supabaseAdmin_1.supabaseAdmin.rpc('check_and_increment_usage', {
            p_user_id: userId,
            p_limit: limit,
        });
        if (error) {
            console.log('Supabase RPC error response:', error);
            console.error('[quotaGate] RPC error:', error);
            return res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: error.message || 'Failed to verify usage quota',
            });
        }
        // Handle return value (object, array of records, or boolean)
        const result = Array.isArray(data) ? data[0] : data;
        const allowed = result?.allowed ?? (typeof result === 'boolean' ? result : true);
        const current_count = result?.current_count ?? result?.count ?? (allowed ? 1 : limit);
        if (!allowed) {
            return res.status(429).json({
                error: 'DAILY_LIMIT_REACHED',
                message: "You've used all your daily AI actions. Come back tomorrow!",
            });
        }
        res.setHeader('X-Daily-Usage', `${current_count}/${limit}`);
        return next();
    }
    catch (err) {
        console.error('[quotaGate] Unexpected error:', err);
        return res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred in quota gate',
        });
    }
};
exports.quotaGate = quotaGate;
//# sourceMappingURL=quotaGate.js.map