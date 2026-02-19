const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}
app.use('/images', express.static(publicDir));

let browser = null;
let currentHeadlessMode = "new";

async function getBrowser() {
    if (!browser) {
        console.log(`Launching browser (Headless: ${currentHeadlessMode})...`);
        const userDataDir = path.join(__dirname, 'user_data');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir);
        }

        browser = await puppeteer.launch({
            headless: currentHeadlessMode,
            defaultViewport: null,
            userDataDir: userDataDir, // Persistent profile
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Use System Chrome
            ignoreDefaultArgs: ['--enable-automation'], // Hide "Chrome is being controlled by automated test software"
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled', // Key stealth flag
                '--start-maximized'
            ]
        });

        browser.on('disconnected', () => {
            console.log('Browser disconnected.');
            browser = null;
        });
    }
    return browser;
}

app.post('/generate', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    console.log(`Received generation request for: "${prompt}"`);

    let page = null;

    try {
        const browserInstance = await getBrowser();
        const pages = await browserInstance.pages();
        page = pages.length > 0 ? pages[0] : await browserInstance.newPage();

        // STEALTH: Set User Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // STEALTH: Remove webdriver property
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        console.log('Navigating to Perchance...');
        await page.goto('https://perchance.org/ai-character-generator', { waitUntil: 'load', timeout: 60000 });

        // --- FIND INPUT FRAME ---
        console.log('Searching for input frame...');
        await new Promise(r => setTimeout(r, 2000));

        let inputElement = null;
        let activeFrame = page;

        const findInputInFrame = async (f) => {
            const textareas = await f.$$('textarea');
            for (const ta of textareas) {
                const isVisible = await ta.boundingBox();
                if (!isVisible) continue;
                const placeholder = await f.evaluate(el => el.placeholder || '', ta);
                const className = await f.evaluate(el => el.className || '', ta);

                if (placeholder.toLowerCase().includes("don't") || placeholder.toLowerCase().includes("anti")) continue;

                if (placeholder.length > 20 || className.includes('paragraph-input')) {
                    return ta;
                }
            }
            return null;
        };

        for (const frame of page.frames()) {
            try {
                const found = await findInputInFrame(frame);
                if (found) {
                    activeFrame = frame;
                    inputElement = found;
                    break;
                }
            } catch (e) { }
        }

        if (!inputElement) throw new Error('Could not find description input.');

        // Highlight Input
        await activeFrame.evaluate(el => {
            el.style.border = '5px solid red';
            el.scrollIntoView({ block: 'center' });
        }, inputElement);

        // --- CAPTURE INITIAL STATE ---
        const initialGalleryCount = await activeFrame.evaluate(() => {
            return document.querySelectorAll('div[data-local-media-gallery-bar="1"]').length;
        });
        console.log(`Initial gallery count: ${initialGalleryCount}`);

        // --- TYPE PROMPT (Human-like) ---
        console.log('Typing prompt (human-like)...');

        // Click naturally
        await inputElement.click({ delay: 100 });

        // Clear & Type slowly
        // Clear & Set Value (Fast)
        await activeFrame.evaluate((el, text) => {
            el.value = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, inputElement, prompt);

        // --- CLICK GENERATE (Human-like) ---
        console.log('Clicking Generate...');
        const button = await activeFrame.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent.toLowerCase().includes('generate')) ||
                document.getElementById('generateButton');
        });

        if (button.asElement()) {
            await button.asElement().hover(); // Hover first
            await new Promise(r => setTimeout(r, 500));
            await button.asElement().click({ delay: 150 }); // Click with duration
        } else {
            throw new Error("Generate button not found");
        }

        // --- WAIT ---
        console.log('Waiting for generation (15s)...');
        await new Promise(r => setTimeout(r, 15000));

        // --- SAVE ---
        console.log('Attempting Gallery Save...');
        let saveButtonFound = false;
        for (let j = 0; j < 5; j++) {
            saveButtonFound = await activeFrame.evaluate(() => {
                // Try multiple ways to find the save button
                const btn = document.querySelector('.private-save-button') ||
                    document.querySelector('button[title*="Save"]') ||
                    document.querySelector('#saveButton') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save'));

                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });
            if (saveButtonFound) {
                console.log('Clicked Save!');
                break;
            }
            console.log('Waiting for Save button...');
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!saveButtonFound) console.log('WARNING: Could not find Save button.');

        await new Promise(r => setTimeout(r, 1000));

        console.log('Opening Gallery...');
        await activeFrame.evaluate(() => {
            if (window.t2i_privateGallery && window.t2i_privateGallery.show) {
                window.t2i_privateGallery.show();
            }
        });

        await new Promise(r => setTimeout(r, 1000));

        // --- SORT BY OLDEST (So new image is at the end) ---
        console.log('Setting sort to Oldest...');
        await activeFrame.evaluate(() => {
            // User provided selector: #localMediaGallery_root > div:nth-child(1) > select:nth-child(3)
            const select = document.querySelector('#localMediaGallery_root > div:nth-child(1) > select:nth-child(3)');
            if (select) {
                // If it's already dateAsc, toggle it to refresh or just ensure it's set
                if (select.value !== 'dateAsc') {
                    select.value = 'dateAsc';
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        await new Promise(r => setTimeout(r, 2000)); // Wait for sort

        console.log('Scanning gallery for NEW item...');
        let blobUrl = null;

        for (let j = 0; j < 15; j++) {
            blobUrl = await activeFrame.evaluate((initialCount) => {
                const bars = Array.from(document.querySelectorAll('div[data-local-media-gallery-bar="1"]'));
                // Check if count INCREASED
                if (bars.length > initialCount) {
                    // Since we sorted by Oldest, the NEWEST image is at the END of the list.
                    const lastBar = bars[bars.length - 1];
                    const container = lastBar.parentElement;
                    if (container) {
                        const img = container.querySelector('img');
                        if (img) return img.src;
                    }
                }
                return null;
            }, initialGalleryCount);

            if (blobUrl) {
                console.log('Found new image!');
                break;
            }
            if (j % 2 === 0) console.log('Waiting for new gallery item to appear...');
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!blobUrl) throw new Error('Could not find new image URL.');

        console.log(`Downloading blob...`);

        const imageBufferBase64 = await activeFrame.evaluate(async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }, blobUrl);

        const base64Data = imageBufferBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `image_${Date.now()}.png`;
        const filePath = path.join(publicDir, fileName);

        fs.writeFileSync(filePath, buffer);
        console.log(`Saved image to ${filePath}`);

        const host = req.get('host'); // e.g., "192.168.1.5:3000" or "localhost:3000"
        const localUrl = `${req.protocol}://${host}/images/${fileName}`;
        console.log(`Sending Response: ${localUrl}`);

        res.json({ imageUrl: localUrl });

    } catch (error) {
        console.error('\nGeneration failed:', error);
        if (!res.headersSent) res.status(500).json({ error: error.message });
    }
});

app.post('/restart', async (req, res) => {
    console.log('Restarting browser session...');
    if (browser) {
        try {
            await browser.close();
            browser = null;
            res.json({ message: 'Browser session running' });
        } catch (error) {
            console.error('Error restarting browser:', error);
            res.status(500).json({ error: error.message });
        }
    } else {
        res.json({ message: 'No active browser session to restart.' });
    }
});

app.post('/toggle_headless', async (req, res) => {
    // Toggle state
    if (currentHeadlessMode === "new" || currentHeadlessMode === true) {
        currentHeadlessMode = false;
    } else {
        currentHeadlessMode = "new";
    }

    console.log(`Headless mode toggled to: ${currentHeadlessMode}`);

    // Restart browser if running to apply change immediately
    if (browser) {
        try {
            await browser.close();
        } catch (e) {
            console.error(e);
        }
        browser = null;
    }

    res.json({
        message: `Headless mode set to: ${currentHeadlessMode === false ? 'Visible' : 'Hidden'}. Browser restarted.`
    });
});

app.listen(PORT, () => {
    console.log(`Bridge server running on http://localhost:${PORT}`);
});
