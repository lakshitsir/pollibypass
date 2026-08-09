import axios from 'axios';

const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

export default async function handler(req, res) {
    // CORS Setup for Public Access
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
        // AI request bhejane se pehle explicit proxy refresh hit
        let rotatedIp = "Rotated Proxy Node";
        try {
            const ipRes = await axios.get(PRXBIN_IP_CHECK, { 
                timeout: 2500,
                headers: { 'Cache-Control': 'no-cache, no-store' }
            });
            rotatedIp = ipRes.data.ip || ipRes.data.origin || rotatedIp;
        } catch (e) {
            // Continuation if check endpoint takes extra time
        }

        // STEP 2: TARGET AI REQUEST VIA PRXBIN PROXY
        const encodedPrompt = encodeURIComponent(prompt);
        const targetUrl = `https://text.pollinations.ai/${encodedPrompt}?model=mistral`;

        const proxyPayload = {
            url: targetUrl,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Cache-Control": "no-cache"
            }
        };

        const response = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 8500 });
        let rawData = response.data;
        let aiReply = "";

        if (typeof rawData === 'object' && rawData.data) {
            rawData = rawData.data;
        }

        if (typeof rawData === 'string') {
            aiReply = rawData;
        } else if (typeof rawData === 'object' && rawData !== null) {
            aiReply = rawData.content || rawData.response || JSON.stringify(rawData);
        }

        // Clean Response JSON Output
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
            error: "Proxy or Target Error: " + error.message,
            developer: "@lakshitpatidar"
        });
    }
}
