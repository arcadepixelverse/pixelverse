export declare const serverTelemetry: {
    bootTime: number;
    totalRequests: number;
    endpointCounts: {
        games: number;
        leaderboard: number;
        admin: number;
        auth: number;
        status: number;
        other: number;
    };
    aiCallCount: number;
    rateLimit429Count: number;
    error4xxCount: number;
    error5xxCount: number;
    totalLatencyMs: number;
    latencyCount: number;
};
declare const app: import("express-serve-static-core").Express;
export default app;
//# sourceMappingURL=server.d.ts.map