const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

// Safe execution timeout
async function safeProxyFetch(url, options = {}, timeoutMs = 8500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return response;
    } catch (err) {
        clearTimeout(timer);
        return null;
    }
}

// Clean and parse proxy nested responses
function cleanText(input) {
    if (!input) return "";
    let str = typeof input === 'string' ? input : JSON.stringify(input);
    if (str.includes('$@$')) str = str.split('$@$')[0];
    return str.trim();
}

// Detect Bad Gateway, IP Bans, or HTML errors
function isBadResponse(text) {
    if (!text || text.length < 2) return true;
    const lower = text.toLowerCase();
    return lower.includes('402 payment required') ||
           lower.includes('api key budget') ||
           lower.includes('deprecation_notice') ||
           lower.includes('model not found') ||
           lower.includes('<!doctype html>') ||
           lower.includes('cloudflare') ||
           lower.includes('rate limit');
}

// ==========================================
// TARGET 1: Blackbox AI (STRICTLY VIA PROXY)
// ==========================================
async function getBlackboxProxy(prompt) {
    try {
        const payload = {
            url: "https://www.blackbox.ai/api/chat",
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
            data: {
                messages: [{ id: "1", content: prompt, role: "user" }],
                id: "1",
                previewToken: null,
                userId: null,
                codeModelMode: true,
                agentMode: {},
                trendingAgentMode: {},
                isGrounded: false
            }
        };

        const res = await safeProxyFetch(PRXBIN_MAIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }, 8000);

        if (!res || !res.ok) return null;
        let text = await res.text();
        
        try {
            let json = JSON.parse(text);
            if (json.data) text = typeof json.data === 'string' ? json.data : JSON.stringify(json.data);
        } catch(e) {}
        
        return cleanText(text);
    } catch (e) { return null; }
}

// ==============================================
// TARGET 2: Pollinations AI (STRICTLY VIA PROXY)
// ==============================================
async function getPollinationsProxy(prompt) {
    try {
        const seed = Math.floor(Math.random() * 999999);
        const payload = {
            url: `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&seed=${seed}`,
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://pollinations.ai/" }
        };

        const res = await safeProxyFetch(PRXBIN_MAIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }, 7500);

        if (!res || !res.ok) return null;
        let text = await res.text();
        
        try {
            let json = JSON.parse(text);
            if (json.data) text = typeof json.data === 'string' ? json.data : JSON.stringify(json.data);
        } catch(e) {}
        
        return cleanText(text);
    } catch (e) { return null; }
}

// ===========================================
// TARGET 3: Backup API (STRICTLY VIA PROXY)
// ===========================================
async function getBackupProxy(prompt) {
    try {
        const payload = {
            url: `https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(prompt)}&owner=Lakshitsir&botname=Kanu`,
            method: "GET"
        };

        const res = await safeProxyFetch(PRXBIN_MAIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }, 6500);

        if (!res || !res.ok) return null;
        let text = await res.text();
        
        try {
            let json = JSON.parse(text);
            let actualData = json.data || json;
            if (actualData.response) return actualData.response;
        } catch(e) {}
        
        return cleanText(text);
    } catch (e) { return null; }
}

module.exports = async (req, res) => {
    // Universal CORS Allow All
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let prompt = "";
        if (req.query && req.query.prompt) {
            prompt = req.query.prompt;
        } else if (req.body) {
            if (typeof req.body === 'string') {
                try { prompt = JSON.parse(req.body).prompt || ""; } catch(e) { prompt = req.body; }
            } else if (typeof req.body === 'object') {
                prompt = req.body.prompt || "";
            }
        }

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({
                success: false,
                error: "Please provide 'prompt' parameter. Example: /api/chat?prompt=Hello",
                developer: "@lakshitpatidar"
            });
        }

        // STEP 1: IP ROTATION & EXTRACTION
        let proxyIp = "Rotated Proxy Node";
        try {
            const ipRes = await safeProxyFetch(`${PRXBIN_IP_CHECK}?_ts=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            }, 2500);
            if (ipRes && ipRes.ok) {
                const ipData = await ipRes.json();
                proxyIp = ipData.ip || ipData.origin || proxyIp;
            }
        } catch (e) {}

        // STEP 2: CASCADE EXECUTION (ALL 100% VIA PROXY)
        let answer = await getBlackboxProxy(prompt);

        if (!answer || isBadResponse(answer)) {
            answer = await getPollinationsProxy(prompt);
        }

        if (!answer || isBadResponse(answer)) {
            answer = await getBackupProxy(prompt);
        }

        if (!answer || isBadResponse(answer)) {
            answer = "Proxy IPs are currently rate-limited by all AI targets. Please try again in a few moments.";
        }

        return res.status(200).json({
            success: true,
            prompt: prompt,
            response: answer,
            proxy_ip: proxyIp,
            developer: "@lakshitpatidar"
        });

    } catch (fatalError) {
        return res.status(200).json({
            success: false,
            error: "Proxy Network Exception: " + (fatalError.message || "Unknown"),
            developer: "@lakshitpatidar"
        });
    }
};
               
