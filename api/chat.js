import axios from 'axios';

const PRXBIN_MAIN = "https://pr-xbin.vercel.app/api/proxy";
const PRXBIN_IP_CHECK = "https://pr-xbin.vercel.app/api/proxy/ip";

export default async function handler(req, res) {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET Query Param OR POST Body Payload
        let prompt = req.query.prompt || (req.body && req.body.prompt);

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: "Please provide 'prompt' parameter. Example: /api/chat?prompt=Hello",
                developer: "@lakshitpatidar"
            });
        }

        // Step 1: Proxy IP Check
        let rotatedIp = "Rotated Proxy Node";
        try {
            const ipRes = await axios.get(PRXBIN_IP_CHECK, { timeout: 2500 });
            rotatedIp = ipRes.data.ip || ipRes.data.origin || rotatedIp;
        } catch (e) {}

        // Step 2: Target Pollinations GET Endpoint (Sureshot Prompt Delivery via URL)
        const encodedPrompt = encodeURIComponent(prompt);
        const targetUrl = `https://text.pollinations.ai/${encodedPrompt}?model=openai&json=true`;

        const proxyPayload = {
            url: targetUrl,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        };

        const response = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 9500 });
        
        let rawData = response.data;
        let aiReply = "";

        // PRXBIN Response Unwrap Logic
        if (typeof rawData === 'object' && rawData.data) {
            rawData = rawData.data;
        }

        // If stringified JSON returned
        if (typeof rawData === 'string') {
            try {
                rawData = JSON.parse(rawData);
            } catch (e) {
                aiReply = rawData;
            }
        }

        // Extracting ONLY the clean message text
        if (typeof rawData === 'object' && rawData !== null) {
            if (rawData.choices && rawData.choices[0] && rawData.choices[0].message) {
                aiReply = rawData.choices[0].message.content;
            } else if (rawData.content) {
                aiReply = rawData.content;
            } else if (rawData.response) {
                aiReply = rawData.response;
            } else {
                aiReply = JSON.stringify(rawData);
            }
        }

        // Fallback Cleanup
        if (!aiReply) {
            aiReply = String(rawData);
        }

        // Final Clean JSON Output
        return res.status(200).json({
            success: true,
            prompt: prompt,
            response: aiReply,
            proxy_ip: rotatedIp,
            developer: "@lakshitpatidar"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Proxy Timeout or Network Error: " + error.message,
            developer: "@lakshitpatidar"
        });
    }
            }

