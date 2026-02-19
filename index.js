import { extension_settings, getContext } from "../../../extensions.js";

const context = getContext();

const defaultSettings = {
    bridgeUrl: "http://127.0.0.1:3000",
};

function loadSettings() {
    if (!extension_settings.st_perchance) {
        extension_settings.st_perchance = {};
    }
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings.st_perchance, key)) {
            extension_settings.st_perchance[key] = defaultSettings[key];
        }
    }
}

function getBridgeUrl() {
    return extension_settings.st_perchance.bridgeUrl.replace(/\/$/, "");
}

async function handlePerchance(args, value) {
    const prompt = value;
    if (!prompt) return;

    const bridgeUrl = getBridgeUrl();
    toastr.info("Request sent to Perchance...");

    try {
        const response = await fetch(`${bridgeUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.imageUrl) {
            console.log("Perchance: Attaching image", data.imageUrl);
            const textArea = document.getElementById('send_textarea');
            if (textArea) {
                textArea.value = `![](${data.imageUrl})`;
                textArea.dispatchEvent(new Event('input', { bubbles: true }));
                const sendBtn = document.getElementById('send_but');
                if (sendBtn) {
                    toastr.success("Image ready! Sending...");
                    setTimeout(() => sendBtn.click(), 500);
                }
            }
        } else if (data.error) {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error(e);
        toastr.error("Failed to generate image: " + e.message);
    }

    return "";
}

async function handleRestart() {
    const bridgeUrl = getBridgeUrl();
    toastr.info("Restarting Perchance Bridge...");
    try {
        const res = await fetch(`${bridgeUrl}/restart`, { method: 'POST' });
        const data = await res.json();
        if (data.message) {
            toastr.success(data.message);
        } else {
            toastr.error("Restart failed: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        toastr.error("Failed to connect to bridge: " + e.message);
    }
}

async function handleToggleHeadless() {
    const bridgeUrl = getBridgeUrl();
    toastr.info("Toggling headless mode...");
    try {
        const res = await fetch(`${bridgeUrl}/toggle_headless`, { method: 'POST' });
        const data = await res.json();
        if (data.message) {
            toastr.success(data.message);
        } else {
            toastr.error("Toggle failed.");
        }
    } catch (e) {
        toastr.error("Failed to connect: " + e.message);
    }
}

jQuery(async () => {
    loadSettings();

    const settingsHtml = `
    <div class="settings-adv-block">
        <div class="settings-adv-header">
            <div class="settings-adv-header-left">
                <h3>Perchance Bridge Settings</h3>
            </div>
        </div>
        <div class="settings-adv-body">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Bridge Server Configuration</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label for="perchance_bridge_url">Bridge URL</label>
                    <input id="perchance_bridge_url" class="text_pole" type="text" value="${extension_settings.st_perchance.bridgeUrl}" placeholder="http://127.0.0.1:3000" />
                    <small>The URL where your local Perchance Bridge server is running.</small>
                </div>
            </div>
        </div>
    </div>
    `;

    $("#extensions_settings").append(settingsHtml);

    $("#perchance_bridge_url").on("change", function () {
        extension_settings.st_perchance.bridgeUrl = $(this).val();
        saveSettingsDebounced();
    });

    context.registerSlashCommand("perchance", handlePerchance, [], "Generates an image", false, false);
    context.registerSlashCommand("perchance_restart", handleRestart, [], "Restarts the Perchance browser session", false, false);
    context.registerSlashCommand("perchance_headless", handleToggleHeadless, [], "Toggles Chrome headless mode (Visible/Hidden)", false, false);
});
