const axios = require('axios');

const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

// Helper: Safely parse text response
function parseSafeText(data) {
    if (!data) return "";
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
        if (data.data) return parseSafeText(data.data);
        if (data.content) return String(data.content);
        if (data.response) return String(data.response);
        try {
            return JSON.stringify(data);
        } catch (e) {
            return String(data);
        }
    }
    return String(data);
}

// Helper: Check for error strings
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

// Target 1: Pollinations AI via Proxy
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

        const res = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 6000 });
        return parseSafeText(res.data);
    } catch (err) {
        return "";
    }
}

// Target 2: Blackbox AI via Proxy (Fallback)
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

        const res = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 6500 });
        let text = parseSafeText(res.data);
        if (text.includes('$@$')) {
            text = text.split('$@$')[0];
        }
        return text;
    } catch (err) {
        return "";
    }
}

module.exports = async (req, res) => {
    // Top-Level Error Catching to prevent Vercel 500 Crash
    try {
        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // Get Prompt
        let prompt = req.query.prompt || (req.body && req.body.prompt);

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: "Please provide 'prompt' parameter. Example: /api/chat?prompt=Hello",
                developer: "@lakshitpatidar"
            });
        }

        // STEP 1: FORCE REFRESH PROXY IP (Safe Execution)
        let rotatedIp = "Rotated Proxy Node";
        try {
            const refreshUrl = `${PRXBIN_IP_CHECK}?_ts=${Date.now()}_${Math.random()}`;
            const ipRes = await axios.get(refreshUrl, { 
                timeout: 2000,
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (ipRes && ipRes.data) {
                rotatedIp = ipRes.data.ip || ipRes.data.origin || rotatedIp;
            }
        } catch (e) {
            // Keep default fallback string if timeout
        }

        // STEP 2: EXECUTE AI QUERY (Safe Dual Provider Execution)
        let aiReply = await queryPollinations(prompt);

        if (isErrorResponse(aiReply)) {
            aiReply = await queryBlackbox(prompt);
        }

        if (!aiReply || isErrorResponse(aiReply)) {
            aiReply = "Service temporarily busy, please resubmit your prompt.";
        }

        return res.status(200).json({
            success: true,
            prompt: prompt,
            response: aiReply.trim(),
            proxy_ip: rotatedIp,
            developer: "@lakshitpatidar"
        });

    } catch (fatalError) {
        // Catch any unexpected runtime crash and return JSON error instead of 500 Function Crash
        return res.status(200).json({
            success: false,
            error: "Runtime execution fallback: " + fatalError.message,
            developer: "@lakshitpatidar"
        });
    }
};
            
