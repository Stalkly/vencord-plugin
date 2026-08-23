import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { useAwaiter } from "@utils/react";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { SelectedGuildStore } from "@webpack/common";

const STALKLY_SECTION_ADDED = Symbol("StalklyProfile.SectionAdded");

import { getStalklyProfile, StalklyApiError } from "./api";
import StalklyDetailSections from "./DetailedTab";
import { settings } from "./settings";
import { formatRelativeTime, hideOnError } from "./utils";

type CardVariant = "popout" | "sidebar" | "tab";

function StalklyCard({ user, variant = "popout" }: { user: User; variant?: CardVariant; }) {
    const apiKey = settings.store.apiKey?.trim();
    const guildId = settings.store.scopeToGuild ? SelectedGuildStore.getGuildId() : null;

    const [profile, error, pending] = useAwaiter(
        () => getStalklyProfile(user.id, guildId),
        { deps: [user.id, guildId, apiKey], fallbackValue: null }
    );

    const cardCls = variant === "popout" ? "vc-stalkly-card" : `vc-stalkly-card vc-stalkly-card--${variant}`;

    if (!apiKey) return null;
    if (pending) return <div className={`${cardCls} vc-stalkly-loading`}>Stalkly</div>;

    if (error) {
        if (error instanceof StalklyApiError) {
            if (error.status === 404) return null;
            if (error.status === 403 && error.code === "profile_hidden") {
                return <div className={`${cardCls} vc-stalkly-muted`}>Stalkly profile is hidden</div>;
            }
            if (error.status === 401) {
                return <div className={`${cardCls} vc-stalkly-muted`}>Stalkly: invalid API key</div>;
            }
            if (error.status === 429) {
                return <div className={`${cardCls} vc-stalkly-muted`}>Stalkly: rate limited</div>;
            }
            if (error.status === 503) {
                return <div className={`${cardCls} vc-stalkly-muted`}>Stalkly: under maintenance</div>;
            }
        }
        return <div className={`${cardCls} vc-stalkly-muted`}>Stalkly: couldn't load stats</div>;
    }

    if (!profile) return null;

    const { stats } = profile;
    const statsHidden = profile.hidden_tabs.includes("stats");
    const isGuildScoped = profile.scope.type === "guild";
    const trackedGuilds = profile.guilds.filter(g => g.messages > 0 || g.voice_seconds > 0);
    const deviceEntries = profile.devices ? Object.entries(profile.devices) : [];

    return (
        <div className={cardCls}>
            <div
                className="vc-stalkly-header"
                role="button"
                tabIndex={0}
                onClick={() => VencordNative.native.openExternal(profile.profile_url)}
            >
                <span className="vc-stalkly-title">Stalkly</span>
                {profile.status && <span className={`vc-stalkly-dot vc-stalkly-dot-${profile.status}`} />}
            </div>

            <div className="vc-stalkly-activity-row">
                <span className="vc-stalkly-activity-value" title={new Date(profile.last_seen).toLocaleString()}>
                    Last seen {formatRelativeTime(profile.last_seen)}
                </span>
                {deviceEntries.length > 0 && (
                    <span className="vc-stalkly-activity-devices">
                        {deviceEntries.map(([device, status]) => `${device}: ${status}`).join(" · ")}
                    </span>
                )}
            </div>

            {statsHidden ? (
                <div className="vc-stalkly-muted">Stats hidden by user</div>
            ) : (
                <div className="vc-stalkly-stats-grid">
                    <div className="vc-stalkly-stat">
                        <span className="vc-stalkly-stat-value">{stats.messages.toLocaleString()}</span>
                        <span className="vc-stalkly-stat-label">Messages</span>
                    </div>
                    <div className="vc-stalkly-stat">
                        <span className="vc-stalkly-stat-value">{stats.voice_text}</span>
                        <span className="vc-stalkly-stat-label">Voice</span>
                    </div>
                    <div className="vc-stalkly-stat">
                        <span className="vc-stalkly-stat-value">{stats.streak}</span>
                        <span className="vc-stalkly-stat-label">Streak</span>
                    </div>
                    <div className="vc-stalkly-stat">
                        <span className="vc-stalkly-stat-value">{isGuildScoped && stats.rank ? `#${stats.rank}` : "—"}</span>
                        <span className="vc-stalkly-stat-label">Rank</span>
                    </div>
                </div>
            )}

            {settings.store.showBadges && profile.badges.some(b => b.icon) && (
                <div className="vc-stalkly-badges">
                    {profile.badges.filter(b => b.icon).map(b => (
                        <img
                            key={b.id}
                            src={b.icon}
                            alt={b.id}
                            title={b.description}
                            className="vc-stalkly-badge"
                            onError={hideOnError}
                        />
                    ))}
                </div>
            )}

            {!statsHidden && trackedGuilds.length > 0 && (
                <div className="vc-stalkly-guilds">
                    {[...trackedGuilds]
                        .sort((a, b) => b.messages - a.messages)
                        .map(g => (
                            <div className="vc-stalkly-guild-row" key={g.id}>
                                {g.icon_url
                                    ? <img src={g.icon_url} alt={g.name} className="vc-stalkly-guild-icon" onError={hideOnError} />
                                    : <div className="vc-stalkly-guild-icon vc-stalkly-guild-icon-fallback">{g.name.charAt(0)}</div>
                                }
                                <div className="vc-stalkly-guild-info">
                                    <span className="vc-stalkly-guild-name">{g.name}</span>
                                    <span className="vc-stalkly-guild-stats">
                                        {g.messages.toLocaleString()} msgs · {g.voice_text} voice
                                    </span>
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}

export default definePlugin({
    name: "StalklyProfile",
    description: "Shows Stalkly (stalkly.me) stats — messages, voice time, level, rank, streak — on member profile popouts",
    authors: [{ name: "emirhan", id: 0n }],

    settings,

    patches: [
        {
            find: '"UserProfilePopout");',
            replacement: {
                match: /user:(\i),widgets:.{0,100}?\}\),/,
                replace: "$&$self.renderStalklyCard({user:$1}),"
            }
        },
        {
            find: ".SIDEBAR,disableToolbar:",
            replacement: {
                match: /user:(\i),widgets:.{0,100}?\}\),(?=.{0,100}unownedWishlistItems:\i,wishlistId:\i)/,
                replace: '$&$self.renderStalklyCard({user:$1,variant:"sidebar"}),'
            }
        },
        {
            find: ".BOT_DATA_ACCESS?(",
            replacement: [
                {
                    match: /\i\.useEffect.{0,100}(\i)\[0\]\.section/,
                    replace: "$self.pushStalklySection($1,arguments[0].user);$&"
                },
                {
                    match: /\(0,\i\.jsx\)\(\i,\{items:\i,section:(\i)/,
                    replace: "$1==='STALKLY'?$self.renderStalklyTab(arguments[0]):$&"
                },
                {
                    match: /className:\i\.\i(?=,type:"top")/,
                    replace: '$& + " vc-stalkly-modal-tab-bar"'
                }
            ]
        },
        {
            find: ".WIDGETS?",
            replacement: [
                {
                    match: /(\i)=(\i)\.find\(\i=>\i\.section===(\i)\)\?\?\2\[0\];return \1\.section!==\3&&(\i)\(\1\.section\),/,
                    replace: "$1=($self.pushStalklySection($2,arguments[0].user),$2.find(e=>e.section===$3)??$2[0]);return $1.section!==$3&&$4($1.section),"
                },
                {
                    match: /children:(?=.{0,100}?component:.+?section:(\i(?:\.\i)*))/,
                    replace: "$&$1==='STALKLY'?$self.renderStalklyTab(arguments[0]):"
                },
                {
                    match: /type:"top",/,
                    replace: '$&className:"vc-stalkly-modal-tab-bar-v2",'
                }
            ]
        }
    ],

    pushStalklySection(sections: any[], user: User) {
        try {
            if (user.bot || sections[STALKLY_SECTION_ADDED]) return;
            sections[STALKLY_SECTION_ADDED] = true;
            sections.push({ text: "Stalkly", section: "STALKLY" });
        } catch { }
    },

    renderStalklyCard: ErrorBoundary.wrap(StalklyCard, { noop: true }),

    renderStalklyTab: ErrorBoundary.wrap(({ user }: { user: User; }) => (
        <div className="vc-stalkly-tab">
            <StalklyCard user={user} variant="tab" />
            <StalklyDetailSections user={user} />
        </div>
    ), { noop: true })
});
