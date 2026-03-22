export async function http(path, options = {}) {
    const token = localStorage.getItem('accessToken');

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let resp = await fetch(path, {
        ...options,
        headers,
        credentials: 'include',
    });

    if (resp.status === 401) {
        const refreshResp = await fetch('/api/refresh/login', {
            method: 'POST',
            credentials: 'include',
        });

        if (refreshResp.ok) {
            const refreshJson = await refreshResp.json();
            const newToken = refreshJson?.data?.accessToken;
            if (newToken) {
                localStorage.setItem('accessToken', newToken);
                resp = await fetch(path, {
                    ...options,
                    headers: { ...headers, Authorization: `Bearer ${newToken}` },
                    credentials: 'include',
                });
            }
        }
    }

    return resp;
}