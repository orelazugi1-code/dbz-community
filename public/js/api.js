const API = {
  async request(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'שגיאה');
    return data;
  },
  register: (d) => API.request('POST', '/api/register', d),
  login: (d) => API.request('POST', '/api/login', d),
  logout: () => API.request('POST', '/api/logout'),
  me: () => API.request('GET', '/api/me'),
  getPosts: (page = 1) => API.request('GET', `/api/posts?page=${page}`),
  getPost: (id) => API.request('GET', `/api/posts/${id}`),
  createPost: (d) => API.request('POST', '/api/posts', d),
  deletePost: (id) => API.request('DELETE', `/api/posts/${id}`),
  likePost: (id) => API.request('POST', `/api/posts/${id}/like`),
  comment: (id, content) => API.request('POST', `/api/posts/${id}/comments`, { content }),
  updateSettings: (d) => API.request('PUT', '/api/settings', d),
  regenToken: () => API.request('POST', '/api/settings/regenerate-token'),
  async uploadImage(file) {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאה');
    return data;
  }
};
