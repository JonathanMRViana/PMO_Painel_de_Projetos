'use client';

const apiOrigin = 'https://pmo-makro-cockpit.finfred-6125.chatgpt.site';
const tokenKey = 'pmo-editor-api-token';

function isGitHubPages() {
  return typeof window !== 'undefined' && window.location.hostname === 'jonathanmrviana.github.io';
}

if (typeof window !== 'undefined' && isGitHubPages() && !window.__pmoApiPatched) {
  // O espelho do GitHub Pages é somente consulta: nunca mantém um acesso de edição.
  window.sessionStorage.removeItem(tokenKey);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const path = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const isApi = path.startsWith('/api/');
    if (!isApi) return nativeFetch(input, init);

    const headers = new Headers(init.headers);
    const response = await nativeFetch(`${apiOrigin}${path}`, { ...init, headers });

    if (path === '/api/editor-session') {
      if (init.method === 'DELETE') window.sessionStorage.removeItem(tokenKey);
      if (init.method === 'POST' && response.ok) window.sessionStorage.removeItem(tokenKey);
    }
    return response;
  };
  window.__pmoApiPatched = true;
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="/"]');
    if (!link || link.target === '_blank' || event.metaKey || event.ctrlKey) return;
    const [route, query = ''] = link.getAttribute('href')!.split('?');
    if (!['/', '/postits', '/acompanhamento', '/projetos', '/visao-executiva', '/postits/visualizar'].includes(route)) return;
    event.preventDefault();
    const page = route === '/' ? '' : `${route}.html`;
    window.location.href = `/PMO_Painel_de_Projetos/${page}${query ? `?${query}` : ''}`;
  });
}

declare global {
  interface Window { __pmoApiPatched?: boolean }
}
