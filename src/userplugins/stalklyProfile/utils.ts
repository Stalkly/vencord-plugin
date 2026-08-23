import type { SyntheticEvent } from "react";

export function formatRelativeTime(iso: string): string {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "just now";

    const units: [number, string][] = [
        [31536000, "y"],
        [2592000, "mo"],
        [86400, "d"],
        [3600, "h"],
        [60, "m"],
    ];

    for (const [secs, label] of units) {
        const value = Math.floor(diffSec / secs);
        if (value >= 1) return `${value}${label} ago`;
    }
    return "just now";
}

export function formatDuration(totalSeconds: number): string {
    const secs = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

export function hideOnError(e: SyntheticEvent<HTMLImageElement>) {
    e.currentTarget.style.display = "none";
}

export function formatEventType(type: string): string {
    return type
        .toLowerCase()
        .split("_")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}
