// ==================== SERVICE WORKER - ANEST PWA (NOVO LAYOUT) ====================
// Versão do cache - ALTERE AQUI para forçar atualização
const CACHE_VERSION = 'v5.9.3-force-reload-202511201952';
const CACHE_NAME = `anest-app-${CACHE_VERSION}`;

// Arquivos essenciais para cache (funcionamento offline)
const ESSENTIAL_FILES = [
    './',
    './index.html',
    './novo-styles.css',
    './app.js',
    './calculadoras-definitions.js',
    './firebase-config.js',
    './rops-data-from-banco.js',
    './search-index-complete.js',
    './simple-search-COMPLETE.js',
    './logo-anest.png',
    './manifest.json',
    './formulario-publico.html',
    './formulario-publico.js'
];

// Arquivos que podem ser cacheados dinamicamente
const DYNAMIC_CACHE = `anest-dynamic-${CACHE_VERSION}`;

// URLs externas que NÃO devem ser cacheadas
const EXTERNAL_URLS = [
    'https://www.gstatic.com/firebasejs',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net'
];

// ==================== INSTALAÇÃO ====================
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando versão:', CACHE_VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando arquivos essenciais');
                return cache.addAll(ESSENTIAL_FILES);
            })
            .then(() => {
                console.log('[Service Worker] Instalação completa');
                return self.skipWaiting(); // Ativa imediatamente
            })
            .catch((error) => {
                console.error('[Service Worker] Erro na instalação:', error);
            })
    );
});

// ==================== ATIVAÇÃO ====================
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando versão:', CACHE_VERSION);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Remove caches antigos
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
                            console.log('[Service Worker] Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Ativação completa');
                return self.clients.claim(); // Assume controle imediatamente
            })
    );
});

// ==================== FETCH (ESTRATÉGIA DE CACHE) ====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Não cachear URLs externas específicas
    if (EXTERNAL_URLS.some(externalUrl => request.url.startsWith(externalUrl))) {
        event.respondWith(fetch(request));
        return;
    }
    
    // Não cachear chamadas Firebase/Firestore
    if (request.url.includes('firebasestorage') || 
        request.url.includes('firestore.googleapis.com') ||
        request.url.includes('identitytoolkit.googleapis.com')) {
        event.respondWith(fetch(request));
        return;
    }
    
    // Estratégia: Network First para HTML, Cache First para assets
    if (request.destination === 'document') {
        event.respondWith(networkFirst(request));
    } else {
        event.respondWith(cacheFirst(request));
    }
});

// ==================== ESTRATÉGIA: CACHE FIRST ====================
async function cacheFirst(request) {
    try {
        // Tenta buscar no cache primeiro
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            // Atualiza cache em background se for um arquivo essencial
            if (ESSENTIAL_FILES.some(file => request.url.includes(file))) {
                updateCache(request);
            }
            return cachedResponse;
        }
        
        // Se não está no cache, busca na rede
        const networkResponse = await fetch(request);
        
        // Cachear dinamicamente se for uma resposta válida
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Erro no cache first:', error);
        
        // Retorna resposta de erro
        return new Response('Offline - Não foi possível carregar o recurso', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// ==================== ESTRATÉGIA: NETWORK FIRST ====================
async function networkFirst(request) {
    try {
        // Tenta buscar na rede primeiro
        const networkResponse = await fetch(request);
        
        // Se conseguiu, atualiza o cache
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Rede falhou, buscando no cache:', error);
        
        // Se falhar, busca no cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// ==================== ATUALIZAÇÃO DE CACHE EM BACKGROUND ====================
function updateCache(request) {
    return fetch(request)
        .then((response) => {
            if (!response || response.status !== 200) {
                return;
            }
            return caches.open(CACHE_NAME)
                .then((cache) => {
                    cache.put(request, response);
                });
        })
        .catch(() => {
            // Silenciosamente falhar
        });
}

// ==================== MENSAGENS (COMUNICAÇÃO COM APP) ====================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

console.log('[Service Worker] Carregado - Versão:', CACHE_VERSION);

