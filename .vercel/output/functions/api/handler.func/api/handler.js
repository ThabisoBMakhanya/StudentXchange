import { app } from '../server/src/app.js';
export default function handler(req, res) {
    const rawPath = req.query.__sx_path;
    const route = Array.isArray(rawPath) ? rawPath[0] : String(rawPath ?? '');
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key === '__sx_path')
            continue;
        for (const entry of Array.isArray(value) ? value : [value])
            if (entry !== undefined)
                params.append(key, String(entry));
    }
    const query = params.toString();
    req.url = `/api/${route}${query ? `?${query}` : ''}`;
    return app(req, res);
}
//# sourceMappingURL=handler.js.map