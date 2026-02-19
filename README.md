# Perchance for SillyTavern

This extension allows you to generate character images using [Perchance](https://perchance.org/ai-character-generator) directly from SillyTavern chat.

## Features
- **Portable**: Can be installed via URL.
- **Configurable**: Set the Bridge URL directly in SillyTavern settings.
- **Commands**: 
  - `/perchance [prompt]` - Generate an image.
  - `/perchance_restart` - Restart the bridge session.
  - `/perchance_headless` - Toggle browser visibility.

## Installation

### Part 1: Install the Extension
1. Open SillyTavern.
2. Go to **Extensions** > **Install Extension**.
3. Paste the GitHub URL of this repository:
   `https://github.com/Antigravity-1/st-perchance` (or your specific repo URL)
4. Click **Install**.

### Part 2: Setup the Bridge Server
This extension requires a lightweight "bridge" server to run locally on your computer to communicate with Perchance.

1. Navigate to the extension folder:
   - **Windows**: `...\SillyTavern\data\default-user\extensions\st-perchance\server`
   - **Linux/Mac**: `.../SillyTavern/data/default-user/extensions/st-perchance/server`
2. **Start the Server**:
   - **Windows**: Double-click `start_bridge.bat`.
   - **Linux/Mac**: Run `./start.sh` (you may need to `chmod +x start.sh` first).

*Keep the server console window open while using the extension.*

## Configuration
1. In SillyTavern, go to **Extensions** > **Perchance Bridge**.
2. **Bridge URL**: Default is `http://127.0.0.1:3000`.
   - If running on the same PC, leave as is.
   - If running on a network (LAN/Tailscale), enter the IP of the PC running the bridge server (e.g., `http://192.168.1.15:3000`).

## Usage
In any chat, type:
`/perchance a friendly wizard with a blue hat`

Wait a moment, and the generated image will appear in your chat history!
