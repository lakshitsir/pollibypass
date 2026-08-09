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

        // Step 1: Force IP Rotation Check
        let rotatedIp = "Rotated Proxy Node";
        try {
            const ipRes = await axios.get(PRXBIN_IP_CHECK, { timeout: 3000 });
            rotatedIp = ipRes.data.ip || ipRes.data.origin || rotatedIp;
        } catch (e) {
            // Continuation even if IP check endpoint is slow
        }

        // Step 2: Target AI Query via PRXBIN Proxy
        const targetUrl = "https://text.pollinations.ai/openai";
        const proxyPayload = {
            url: targetUrl,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            data: JSON.stringify({
                messages: [
                    { role: "user", content: prompt }
                ],
                model: "openai",
                code: "beartoken"
            })
        };

        const response = await axios.post(PRXBIN_MAIN, proxyPayload, { timeout: 8500 });
        
        let aiReply = response.data;

        // Clean response extraction
        if (typeof aiReply === 'object') {
            if (aiReply.choices && aiReply.choices[0] && aiReply.choices[0].message) {
                aiReply = aiReply.choices[0].message.content;
            } else if (aiReply.data) {
                aiReply = aiReply.data;
            } else if (aiReply.response) {
                aiReply = aiReply.response;
            }
        }

        // Format string output if json object is returned as string
        if (typeof aiReply === 'string' && aiReply.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(aiReply);
                if (parsed.choices && parsed.choices[0]?.message?.content) {
                    aiReply = parsed.choices[0].message.content;
                }
            } catch (e) {}
        }

        // Return JSON Response
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
            error: "Proxy or Target Timeout: " + error.message,
            developer: "@lakshitpatidar"
        });
    }
}
  
