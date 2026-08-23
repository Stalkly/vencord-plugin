import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: "Stalkly API key (stk_<id>_<secret>) — get one at stalkly.me/dashboard/api",
        default: "",
    },
    scopeToGuild: {
        type: OptionType.BOOLEAN,
        description: "Scope stats (messages, voice, rank) to the server you're currently in, when available",
        default: true,
    },
    showBadges: {
        type: OptionType.BOOLEAN,
        description: "Show Stalkly badges row",
        default: true,
    },
});
