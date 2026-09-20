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

    const questions = payload.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        return json(400, { error: '문제 데이터가 비어 있습니다.' });
    }

    const content = JSON.stringify(questions, null, 2);
    if (content.length > 1200000) {
        return json(413, { error: '문제 데이터가 너무 큽니다.' });
    }

    const api = `https://api.github.com/repos/${owner}/${repo}/contents/questions.json`;
    const headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'korean-challenge-admin'
    };

    try {
        const existing = await fetch(api + '?ref=' + encodeURIComponent(branch), { headers });
        const existingJson = existing.ok ? await existing.json() : {};
        const res = await fetch(api, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: '관리자 페이지에서 문제를 수정함',
                content: Buffer.from(content, 'utf8').toString('base64'),
                sha: existingJson.sha,
                branch
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const message = data && data.message ? data.message : 'GitHub 게시에 실패했습니다.';
            return json(502, { error: message });
        }
        return json(200, { ok: true });
    } catch (error) {
        return json(502, { error: 'GitHub에 연결하지 못했습니다.' });
    }
}
