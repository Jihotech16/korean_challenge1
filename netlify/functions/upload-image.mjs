const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
};

const ALLOWED_EXT = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp'
};

function json(statusCode, payload) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(payload)
    };
}

function safeName(name) {
    const raw = String(name || 'image.png');
    const ext = (raw.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT[ext]) return null;
    const cleanExt = ext === 'jpeg' ? 'jpg' : ext;
    const base = raw
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'image';
    return `${base}-${Date.now()}.${cleanExt}`;
}

export async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders };
    }
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'POST only' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'korean2026';
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'Jihotech16';
    const repo = process.env.GITHUB_REPO || 'korean_challenge1';
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) {
        return json(500, { error: 'Netlify 환경변수 GITHUB_TOKEN이 아직 없습니다.' });
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (error) {
        return json(400, { error: '잘못된 요청입니다.' });
    }

    if (payload.password !== adminPassword) {
        return json(401, { error: '관리자 비밀번호가 올바르지 않습니다.' });
    }

    const filename = safeName(payload.filename);
    const content = String(payload.content || '').replace(/^data:[^;]+;base64,/, '');
    if (!filename || !content) {
        return json(400, { error: 'png, jpg, gif, webp 이미지만 올릴 수 있습니다.' });
    }
    if (content.length > 1800000) {
        return json(413, { error: '이미지가 너무 큽니다. 1.2MB 이하로 줄여 주세요.' });
    }

    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
    const headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'korean-challenge-admin'
    };

    try {
        const res = await fetch(api, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `관리자 페이지에서 이미지 추가: ${filename}`,
                content,
                branch
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = data && data.message ? data.message : '이미지 업로드에 실패했습니다.';
            return json(502, { error: message });
        }
        return json(200, { ok: true, filename });
    } catch (error) {
        return json(502, { error: 'GitHub에 이미지를 올리지 못했습니다.' });
    }
}
