import { settings } from "./settings";

export const STALKLY_ORIGIN = "https://stalkly.me";
const API_BASE = `${STALKLY_ORIGIN}/api/public/v1`;
const CACHE_TTL_MS = 60_000;

export type StalklyRange = "day" | "week" | "month" | "all";

export interface StalklyBadge {
    id: string;
    icon: string;
    description: string;
}

export interface StalklyGuildStats {
    id: string;
    name: string;
    icon_url?: string;
    members: number;
    nick?: string;
    messages: number;
    voice_seconds: number;
    voice_text: string;
}

export interface StalklyStats {
    messages: number;
    voice_seconds: number;
    voice_text: string;
    rank: number;
    level: number;
    xp: number;
    xp_next: number;
    streak: number;
    active_days: number;
    views: number;
    hourly: number[];
}

export interface StalklyUser {
    id: string;
    name: string;
    handle: string;
    profile_url: string;
    avatar_url?: string;
    banner_url?: string;
    accent_color?: number;
    decoration_url?: string;
    status?: string;
    online?: boolean;
    devices?: Record<string, string>;
    badges: StalklyBadge[];
    clan?: { tag: string; guild_id: string; badge_url?: string; };
    connections?: { type: string; name: string; url?: string; verified: boolean; }[];
    bio?: string;
    pronouns?: string;
    created_at: string;
    first_seen: string;
    last_seen: string;
    stats: StalklyStats;
    guild_count: number;
    guilds: StalklyGuildStats[];
    hidden_tabs: string[];
    scope: { type: "global" | "guild"; guild_id?: string; };
}

export interface StalklyVoiceChannel {
    channel_id: string;
    name: string;
    guild_id: string;
    guild_name: string;
    guild_icon?: string;
    sessions: number;
    share: number;
    seconds: number;
}

export interface StalklyVoiceContact {
    user_id: string;
    name: string;
    handle: string;
    avatar?: string;
    count: number;
    sessions: number;
    total_seconds: number;
    avg_seconds: number;
    guild_id: string;
    guild_name: string;
    guild_icon?: string;
}

export interface StalklyVoiceTab {
    user_id: string;
    range: StalklyRange;
    total_sessions: number;
    total_seconds: number;
    top_channels: StalklyVoiceChannel[];
    contacts: StalklyVoiceContact[];
}

export interface StalklyMessageChannel {
    channel_id: string;
    name: string;
    guild_id: string;
    guild_name: string;
    guild_icon?: string;
    count: number;
    share: number;
}

export interface StalklyMessageContact {
    user_id: string;
    name: string;
    handle: string;
    avatar?: string;
    count: number;
    guild_id: string;
    guild_name: string;
    guild_icon?: string;
}

export interface StalklyMessageTab {
    user_id: string;
    range: StalklyRange;
    top_channels: StalklyMessageChannel[];
    contacts: StalklyMessageContact[];
}

export interface StalklyActivityEvent {
    id: string;
    type: string;
    timestamp: string;
    guild_id?: string;
    guild_name?: string;
    channel_id?: string;
    channel_name?: string;
    duration_seconds?: number;
    voice_count?: number;
}

export interface StalklyActivityPage {
    user_id: string;
    limit: number;
    count: number;
    events: StalklyActivityEvent[];
}

export interface StalklyDistribution {
    user_id: string;
    days: number;
    msgs_hourly: number[];
    voice_hourly: number[];
    msgs_weekly: number[];
    voice_weekly: number[];
}

export class StalklyApiError extends Error {
    constructor(public status: number, public code?: string) {
        super(code ?? `HTTP ${status}`);
        this.name = "StalklyApiError";
    }
}

interface CacheEntry<T> {
    expires: number;
    data?: T;
    error?: StalklyApiError;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function clearStalklyCache() {
    cache.clear();
}

export function cdnAvatarUrl(userId: string, hash?: string, size = 64): string | undefined {
    if (!hash) return undefined;
    const ext = hash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=${size}`;
}

export function cdnGuildIconUrl(guildId: string, hash?: string, size = 32): string | undefined {
    if (!hash) return undefined;
    const ext = hash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/icons/${guildId}/${hash}.${ext}?size=${size}`;
}

async function apiFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const key = settings.store.apiKey?.trim();
    if (!key) throw new StalklyApiError(0, "no_key");

    const url = new URL(`${API_BASE}${path}`);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined) url.searchParams.set(k, String(v));
        }
    }

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` }
    });

    if (!res.ok) {
        let code: string | undefined;
        try {
            const body = await res.json();
            code = body?.error ?? body?.code;
        } catch { }
        throw new StalklyApiError(res.status, code);
    }

    return res.json();
}

async function cachedFetch<T>(cacheKey: string, path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached && cached.expires > Date.now()) {
        if (cached.error) throw cached.error;
        return cached.data!;
    }

    try {
        const data = await apiFetch<T>(path, params);
        cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
        return data;
    } catch (e) {
        if (e instanceof StalklyApiError) {
            cache.set(cacheKey, { error: e, expires: Date.now() + CACHE_TTL_MS });
        }
        throw e;
    }
}

export function getStalklyProfile(userId: string, guildId: string | null): Promise<StalklyUser> {
    return cachedFetch(`user:${userId}:${guildId ?? ""}`, `/users/${userId}`, { guild: guildId ?? undefined });
}

export function getVoiceTab(userId: string, range: StalklyRange = "all", rows = 5): Promise<StalklyVoiceTab> {
    return cachedFetch(`voice:${userId}:${range}:${rows}`, `/users/${userId}/voice`, { range, rows });
}

export function getMessageTab(userId: string, range: StalklyRange = "all", rows = 5): Promise<StalklyMessageTab> {
    return cachedFetch(`messages:${userId}:${range}:${rows}`, `/users/${userId}/messages`, { range, rows });
}

export function getActivityFeed(userId: string, limit?: number): Promise<StalklyActivityPage> {
    return cachedFetch(`activity:${userId}:${limit ?? ""}`, `/users/${userId}/activity`, { limit });
}

export function getDistribution(userId: string, days = 30): Promise<StalklyDistribution> {
    return cachedFetch(`distribution:${userId}:${days}`, `/users/${userId}/distribution`, { days });
}
