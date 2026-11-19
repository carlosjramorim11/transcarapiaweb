const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const recentRequests = new Map();

const fieldLimits = {
    name: 120,
    company: 120,
    phone: 24,
    email: 254,
    origin: 120,
    destination: 120,
    cargo: 120,
    quantity: 100,
    details: 2000
};

function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}

function parseBody(body) {
    if (typeof body === 'string') {
        return JSON.parse(body);
    }
    return body;
}

function validateFields(body) {
    const fields = {};

    for (const [name, maxLength] of Object.entries(fieldLimits)) {
        if (typeof body[name] !== 'string') {
            return null;
        }
        fields[name] = body[name].trim();
        if (fields[name].length === 0 || fields[name].length > maxLength) {
            return null;
        }
    }

    if (fields.name.length < 2 || fields.company.length < 2 ||
        fields.origin.length < 3 || fields.destination.length < 3 ||
        fields.cargo.length < 2 || fields.details.length < 10) {
        return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = fields.phone.replace(/\D/g, '');
    if (!emailPattern.test(fields.email) || phoneDigits.length < 8 || phoneDigits.length > 15) {
        return null;
    }

    return fields;
}

function isRateLimited(ip) {
    const now = Date.now();
    const recent = (recentRequests.get(ip) || []).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
        recentRequests.set(ip, recent);
        return true;
    }
    recent.push(now);
    recentRequests.set(ip, recent);

    if (recentRequests.size > 10000) {
        for (const [key, timestamps] of recentRequests) {
            if (timestamps.every(timestamp => now - timestamp >= RATE_LIMIT_WINDOW_MS)) {
                recentRequests.delete(key);
            }
        }
    }
    return false;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { ok: false, message: 'Método não permitido.' });
    }

    const origin = req.headers.origin;
    const host = req.headers.host;
    try {
        if (!origin || !host || new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
            return sendJson(res, 403, { ok: false, message: 'Origem da solicitação não autorizada.' });
        }
    } catch {
        return sendJson(res, 403, { ok: false, message: 'Origem da solicitação não autorizada.' });
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        return sendJson(res, 415, { ok: false, message: 'Formato de solicitação inválido.' });
    }

    let body;
    try {
        body = parseBody(req.body);
    } catch {
        return sendJson(res, 400, { ok: false, message: 'Não foi possível ler os dados enviados.' });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Buffer.byteLength(JSON.stringify(body), 'utf8') > 10000) {
        return sendJson(res, 400, { ok: false, message: 'Dados inválidos ou muito extensos.' });
    }

    if (typeof body.website === 'string' && body.website.trim() !== '') {
        return sendJson(res, 200, { ok: true });
    }

    const fields = validateFields(body);
    if (!fields) {
        return sendJson(res, 400, { ok: false, message: 'Confira os dados obrigatórios e tente novamente.' });
    }

    const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    if (isRateLimited(ip)) {
        return sendJson(res, 429, { ok: false, message: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const to = process.env.SALES_REQUEST_TO_EMAIL;
    if (!apiKey || !from || !to) {
        console.error('E-mail comercial indisponível: variáveis do Resend não configuradas.');
        return sendJson(res, 503, { ok: false, message: 'O envio está temporariamente indisponível. Tente novamente mais tarde.' });
    }

    const message = [
        'Nova solicitação comercial pelo site Transcarapia',
        '',
        `Nome: ${fields.name}`,
        `Empresa: ${fields.company}`,
        `Telefone/WhatsApp: ${fields.phone}`,
        `E-mail: ${fields.email}`,
        `Origem: ${fields.origin}`,
        `Destino: ${fields.destination}`,
        `Carga: ${fields.cargo}`,
        `Peso/volume aproximado: ${fields.quantity}`,
        '',
        'Necessidade de transporte:',
        fields.details
    ].join('\n');

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from,
                to: [to],
                reply_to: fields.email,
                subject: `Solicitação comercial - ${fields.company}`,
                text: message
            })
        });

        if (!response.ok) {
            console.error(`Resend recusou a solicitação (HTTP ${response.status}).`);
            return sendJson(res, 502, { ok: false, message: 'Não foi possível enviar sua solicitação agora. Tente novamente.' });
        }

        return sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error('Falha de conexão com o serviço de e-mail:', error.message);
        return sendJson(res, 502, { ok: false, message: 'Falha de conexão ao enviar. Verifique sua internet e tente novamente.' });
    }
};
