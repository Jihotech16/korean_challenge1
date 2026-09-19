import { File } from 'node:buffer';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
};

function json(statusCode, payload) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(payload)
    };
}

function pickExtension(mime) {
    const type = String(mime || '').toLowerCase();
    if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a';
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    if (type.includes('wav')) return 'wav';
    if (type.includes('ogg')) return 'ogg';
    return 'webm';
}

export async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders };
    }
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'POST only' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return json(500, { error: 'GROQ_API_KEY가 아직 설정되지 않았습니다.' });
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (error) {
        return json(400, { error: '잘못된 요청입니다.' });
    }

    const audio = payload.audio;
    const mime = payload.mime || 'audio/webm';
    if (!audio || typeof audio !== 'string') {
        return json(400, { error: '녹음 데이터가 없습니다.' });
    }
    if (audio.length > 5500000) {
        return json(413, { error: '녹음이 너무 깁니다. 짧게 다시 말해 주세요.' });
    }

    const binary = Buffer.from(audio, 'base64');
    if (binary.length < 400) {
        return json(400, { error: '말이 잘 들리지 않았어요. 다시 녹음해 주세요.' });
    }

    const ext = pickExtension(mime);
    const form = new FormData();
    form.append('file', new File([binary], `speech.${ext}`, { type: mime }));
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'ko');
    form.append('response_format', 'json');

    try {
        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form
        });
        const data = await response.json();
        if (!response.ok) {
            const message = data && data.error && data.error.message
                ? data.error.message
                : '음성 인식 서버에 연결하지 못했습니다.';
            return json(502, { error: message });
        }
        return json(200, { text: (data && data.text ? String(data.text) : '').trim() });
    } catch (error) {
        return json(502, { error: '음성 인식 서버에 연결하지 못했습니다.' });
    }
}
