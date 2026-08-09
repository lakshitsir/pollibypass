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
            const ipRes = await axios.get(PRXBIN_IP_CHECK, { timeout: 2000 });
            rotatedIp = ipRes.data.ip || ipRes.data.origin || rotatedIp;
        } catch (e) {}

        // Step 2: Ultra-Fast Public Endpoint (No Payment Block & High Speed)
        const targetUrl = "https://api.deepinfra.com/v1/openai/chat/completions";

        const proxyPayload = {
            url: targetUrl,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            data: JSON.stringify({
                model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                messages: [
                    { role: "system", content: "You are a concise and smart AI assistant." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        };

        const response = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 8000 });
        let rawData = response.data;
        let aiReply = "";

        // Unwrap PRXBIN wrapper if present
        if (typeof rawData === 'object' && rawData.data) {
            rawData = rawData.data;
        }

        if (typeof rawData === 'string') {
            try {
                rawData = JSON.parse(rawData);
            } catch (e) {}
        }

        // Extract Response Content
        if (rawData && rawData.choices && rawData.choices[0] && rawData.choices[0].message) {
            aiReply = rawData.choices[0].message.content;
        } else if (typeof rawData === 'string') {
            aiReply = rawData;
        } else {
            aiReply = JSON.stringify(rawData);
        }

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
            error: "Proxy or Target Error: " + error.message,
            developer: "@lakshitpatidar"
        });
    }
}
    
