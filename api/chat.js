import axios from 'axios';

const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

// Helper: Check if returned string contains HTTP / Budget / Rate-limit errors
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

// Target 1: Pollinations AI with Direct Referer & Seed Bypass
async function queryPollinations(prompt) {
    const encodedPrompt = encodeURIComponent(prompt);
    const randomSeed = Math.floor(Math.random() * 9999999);
    const targetUrl = `https://text.pollinations.ai/${encodedPrompt}?model=openai&seed=${randomSeed}&json=false`;

    const proxyPayload = {
        url: targetUrl,
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://pollinations.ai/",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
        }
    };

    const res = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 7500 });
    let text = typeof res.data === 'string' ? res.data : (res.data.data || JSON.stringify(res.data));
    return text;
}

// Target 2: Blackbox AI via PRXBIN Proxy (Fallback Route)
async function queryBlackbox(prompt) {
    const targetUrl = "https://www.blackbox.ai/api/chat";

    const proxyPayload = {
        url: targetUrl,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Cache-Control": "no-cache"
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

    const res = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 8000 });
    let text = typeof res.data === 'string' ? res.data : (res.data.data || JSON.stringify(res.data));
    
    // Clean citation strings if present in Blackbox response
    if (text.includes('$@$')) {
        text = text.split('$@$')[0];
    }
    return text;
}

export default async function handler(req, res) {
    // CORS Setup for Public & Cross-Origin Access
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

        // STEP 1: FORCE PRXBIN PROXY REFRESH & IP EXTRACTION
        let rotatedIp = "Rotated Proxy Node";
        try {
            // Anti-cache query string ensures PRXBIN executes a brand-new outbound IP check
            const refreshUrl = `${PRXBIN_IP_CHECK}?_ts=${Date.now()}_${Math.random()}`;
            const ipRes = await axios.get(refreshUrl, { 
                timeout: 2000,
                headers: { 
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            rotatedIp = ipRes.data.ip || ipRes.data.origin || rotatedIp;
        } catch (e) {
            // Continuation even if IP check endpoint is slow
        }

        // STEP 2: EXECUTE AI QUERY THROUGH ROTATED PROXY PIPELINE
        let aiReply = "";

        // Attempt 1: Pollinations
        try {
            aiReply = await queryPollinations(prompt);
        } catch (e) {}

        // Attempt 2: Blackbox AI Fallback if Attempt 1 has errors / payment blocks
        if (isErrorResponse(aiReply)) {
            try {
                aiReply = await queryBlackbox(prompt);
            } catch (e) {}
        }

        // Fallback message if all attempts fail
        if (!aiReply || isErrorResponse(aiReply)) {
            aiReply = "Service temporarily busy, please resubmit your prompt.";
        }

        // Final Structured Output
        return res.status(200).json({
            success: true,
            prompt: prompt,
            response: aiReply.trim(),
            proxy_ip: rotatedIp,
            developer: "@lakshitpatidar"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Proxy or Execution Error: " + error.message,
            developer: "@lakshitpatidar"
        });
    }
}
