const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

// Safe AbortController Timeout to prevent Vercel 10s execution kill
async function safeProxyFetch(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timer);
        return response;
    } catch (err) {
        clearTimeout(timer);
        return null;
    }
}

// Clean response parsing
function cleanText(input) {
    if (!input) return "";
    let str = typeof input === 'string' ? input : JSON.stringify(input);
    if (str.includes('$@$')) str = str.split('$@$')[0];
    return str.trim();
}

// Detect Bad Gateway or Provider Errors
function isBadResponse(text) {
    if (!text || text.length === 0) return true;
    const lower = text.toLowerCase();
    return lower.includes('402 payment required') ||
           lower.includes('api key budget too low') ||
           lower.includes('deprecation_notice') ||
           lower.includes('model not found') ||
           lower.includes('service unavailable') ||
           lower.includes('rate limit');
}

// Strictly Via PRXBIN Proxy Node
async function getPollinationsProxy(prompt) {
    try {
        const seed = Math.floor(Math.random() * 899999) + 100000;
        const targetUrl = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&seed=${seed}`;
        
        const payload = {
            url: targetUrl,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://pollinations.ai/",
                "Cache-Control": "no-cache"
            }
        };

        const res = await safeProxyFetch(PRXBIN_MAIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }, 6500);

        if (!res || !res.ok) return null;
        const data = await res.text();
        return cleanText(data);
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    // Universal CORS Setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Multi-format Prompt Extractor (Query Param, Plain Text, or JSON Body)
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

        // STEP 1: PROXY IP EXTRACTION & ACTIVE CHECK
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

        // STEP 2: EXECUTE REQUEST (STRICTLY PROXY ONLY)
        let answer = await getPollinationsProxy(prompt);

        if (!answer || isBadResponse(answer)) {
            answer = "Proxy node timed out or target service busy. Please retry your request.";
        }

        return res.status(200).json({
            success: true,
            prompt: prompt,
            response: answer,
            proxy_ip: proxyIp,
            developer: "@lakshitpatidar"
        });

    } catch (fatalError) {
        // Guarantees zero 500 FUNCTION_INVOCATION_FAILED errors
        return res.status(200).json({
            success: false,
            error: "Execution Exception: " + (fatalError.message || "Unknown Error"),
            developer: "@lakshitpatidar"
        });
    }
};
