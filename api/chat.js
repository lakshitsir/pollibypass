const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

// Timeout Helper
function fetchWithTimeout(url, options = {}, timeoutMs = 6500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

function isErrorResponse(text) {
    if (!text || typeof text !== 'string') return true;
    const lower = text.toLowerCase();
    return lower.includes('402 payment required') || 
           lower.includes('api key budget too low') || 
           lower.includes('deprecation_notice') || 
           lower.includes('model not found') ||
           lower.includes('rate limit') ||
           lower.includes('service unavailable');
}

// Target 1: Pollinations via PRXBIN Proxy
async function queryPollinations(prompt) {
    try {
        const encodedPrompt = encodeURIComponent(prompt);
        const randomSeed = Math.floor(Math.random() * 9999999);
        const targetUrl = `https://text.pollinations.ai/${encodedPrompt}?model=openai&seed=${randomSeed}&json=false`;

        const proxyPayload = {
            url: targetUrl,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://pollinations.ai/",
                "Cache-Control": "no-cache"
            }
        };

        const res = await fetchWithTimeout(PRXBIN_MAIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proxyPayload)
        }, 6000);

        if (!res.ok) return "";
        return await res.text();
    } catch (e) {
        return "";
    }
}

// Target 2: Blackbox AI via PRXBIN Proxy (Fallback)
async function queryBlackbox(prompt) {
    try {
        const targetUrl = "https://www.blackbox.ai/api/chat";

        const proxyPayload = {
            url: targetUrl,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            data: JSON.stringify({
                messages: [{ id: "msg_" + Date.now(), content: prompt, role: "user" }],
                id: "chat_" + Date.now(),
                previewToken: null,
                userId: null,
                codeModelMode": true,
                agentMode: {},
                trendingAgentMode: {},
                isGrounded: false
            })
        };

        const res = await fetchWithTimeout(PRXBIN_MAIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proxyPayload)
        }, 6500);

        if (!res.ok) return "";
        let text = await res.text();
        if (text.includes('$@$')) {
            text = text.split('$@$')[0];
        }
        return text;
    } catch (e) {
        return "";
    }
}

module.exports = async (req, res) => {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let prompt = req.query.prompt || (req.body && req.body.prompt);

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: "Please provide 'prompt' parameter. Example: /api/chat?prompt=Hello",
                developer: "@lakshitpatidar"
            });
        }

        // STEP 1: FORCE IP ROTATION / REFRESH
        let rotatedIp = "Rotated Proxy Node";
        try {
            const refreshUrl = `${PRXBIN_IP_CHECK}?_ts=${Date.now()}_${Math.random()}`;
            const ipRes = await fetchWithTimeout(refreshUrl, {
                headers: { 'Cache-Control': 'no-cache, no-store' }
            }, 2000);
            
            if (ipRes.ok) {
                const ipData = await ipRes.json();
                rotatedIp = ipData.ip || ipData.origin || rotatedIp;
            }
        } catch (e) {}

        // STEP 2: MULTI-PROVIDER AI ROUTE VIA PROXY
        let aiReply = await queryPollinations(prompt);

        if (isErrorResponse(aiReply)) {
            aiReply = await queryBlackbox(prompt);
        }

        if (!aiReply || isErrorResponse(aiReply)) {
            aiReply = "Service temporarily busy, please retry your request.";
        }

        return res.status(200).json({
            success: true,
            prompt: prompt,
            response: aiReply.trim(),
            proxy_ip: rotatedIp,
            developer: "@lakshitpatidar"
        });

    } catch (fatalError) {
        return res.status(200).json({
            success: false,
            error: "Execution Exception: " + fatalError.message,
            developer: "@lakshitpatidar"
        });
    }
};
            
