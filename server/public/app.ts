interface MaxWebApp {
  initData?: string;
  initDataUnsafe?: { user?: { id?: number; first_name?: string; last_name?: string } };
  ready?: () => void;
}

interface Window {
  WebApp?: MaxWebApp;
}

interface Building {
  address: string;
  apartmentsCount: number | null;
  entrances: unknown[];
}

interface House extends Building {
  id: number;
  lat: number | null;
  lng: number | null;
}

interface Me {
  role: string;
  onboarded: boolean;
  apartment: string | null;
  entrance: string | null;
  residentTypeLabel: string;
  house: House | null;
}

interface RequestItem {
  id: number;
  title: string;
  status: string;
  statusLabel: string;
  isMine: boolean;
  canVote: boolean;
  votesCount: number;
  votesRequired: number;
  author: { name: string; apartment: string | null };
}

interface SearchHit {
  label: string;
  lat: number;
  lng: number;
}

interface AnnouncementItem {
  id: number;
  title: string;
  description: string;
  author: { name: string };
  createdAt: string;
}

interface NewsItem {
  id: number;
  title: string;
  description: string;
  contact: string;
  author: { name: string };
  isMine: boolean;
  createdAt: string;
}

type ApiError = Error & { code?: string };

(() => {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.slice(1));

  const sdkUser = (window.WebApp && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.user) || null;
  const initData = (window.WebApp && window.WebApp.initData) || hashParams.get('WebAppData') || '';
  const userId = params.get('dev') || (sdkUser && sdkUser.id ? String(sdkUser.id) : '');

  let me: Me | null = null;
  let map: L.Map | null = null;
  let marker: L.Marker | null = null;
  let selected: { lat: number; lng: number; building: Building; house: House | null } | null = null;
  let residentType = 'OWNER';
  let categories: { value: string; label: string }[] = [];

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (userId) headers['X-Dev-User-Id'] = userId;
    if (sdkUser) headers['X-Dev-User-Name'] = encodeURIComponent([sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(' '));
    if (initData) headers.Authorization = 'MaxInitData ' + initData;
    return headers;
  }

  async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const error: ApiError = new Error((data && data.error && data.error.message) || 'Ошибка ' + res.status);
      error.code = data && data.error && data.error.code;
      throw error;
    }
    return data as T;
  }

  function show(name: string): void {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === 'screen-' + name));
    if (name === 'map' && map) setTimeout(() => map!.invalidateSize(), 0);
  }

  function plural(n: number, one: string, few: string, many: string): string {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function describeBuilding(b: Building): string {
    if (!b.apartmentsCount && !b.entrances.length) return 'Число квартир в открытых данных не указано — номер квартиры не проверяется';
    const parts: string[] = [];
    if (b.apartmentsCount) parts.push(`${b.apartmentsCount} ${plural(b.apartmentsCount, 'квартира', 'квартиры', 'квартир')}`);
    if (b.entrances.length) parts.push(`${b.entrances.length} ${plural(b.entrances.length, 'подъезд', 'подъезда', 'подъездов')}`);
    return parts.join(', ');
  }

  function showMap(): void {
    show('map');
    if (map) return;
    map = L.map('map').setView([55.7887, 49.1221], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    map.on('click', (e) => pickPoint(e.latlng.lat, e.latlng.lng));
    api<House[]>('GET', '/houses').then((houses) => {
      const known = houses.filter((h) => h.lat !== null);
      known.forEach((h) => L.circleMarker([h.lat!, h.lng!], { radius: 8, color: '#1a9c4b', fillOpacity: 0.7 }).addTo(map!).bindTooltip(h.address));
      if (known.length) map!.fitBounds(known.map((h) => [h.lat!, h.lng!] as [number, number]), { maxZoom: 16, padding: [30, 30] });
    }).catch(() => {});
    if (me && me.house && me.house.lat !== null) map.setView([me.house.lat, me.house.lng!], 17);
  }

  async function pickPoint(lat: number, lng: number): Promise<void> {
    if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map!);
    const card = $('house-card');
    card.className = 'card muted';
    card.textContent = 'Ищем дом…';
    try {
      const { building, house } = await api<{ building: Building; house: House | null }>('GET', `/houses/lookup?lat=${lat}&lng=${lng}`);
      selected = { lat, lng, building, house };
      card.className = 'card';
      card.innerHTML = `<div style="font-weight:600">${building.address}</div><div class="muted">${describeBuilding(building)}</div>` +
        `<button id="pick-house" style="margin-top:10px;width:100%">Это мой дом</button>`;
      $('pick-house').onclick = confirmHouse;
    } catch (e) {
      selected = null;
      card.className = 'card error';
      card.textContent = (e as Error).message;
    }
  }

  async function confirmHouse(): Promise<void> {
    const btn = $<HTMLButtonElement>('pick-house');
    btn.disabled = true;
    try {
      const house = await api<House>('POST', '/houses', { lat: selected!.lat, lng: selected!.lng });
      selected!.house = house;
      $('apt-house').textContent = house.address;
      $('apt-info').textContent = describeBuilding(house);
      $('apt-error').textContent = '';
      $<HTMLInputElement>('apartment').value = (me && me.apartment) || '';
      show('apartment');
    } catch (e) {
      $('house-card').className = 'card error';
      $('house-card').textContent = (e as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  async function searchAddress(): Promise<void> {
    const q = $<HTMLInputElement>('search').value.trim();
    const box = $('search-results');
    if (q.length < 3) return;
    box.textContent = 'Ищем…';
    try {
      const results = await api<SearchHit[]>('GET', '/geo/search?q=' + encodeURIComponent(q));
      box.innerHTML = '';
      if (!results.length) box.textContent = 'Ничего не найдено — уточните адрес';
      results.forEach((r) => {
        const b = document.createElement('button');
        b.textContent = r.label;
        b.onclick = () => { box.innerHTML = ''; map!.setView([r.lat, r.lng], 18); pickPoint(r.lat, r.lng); };
        box.appendChild(b);
      });
    } catch (e) {
      box.textContent = (e as Error).message;
    }
  }

  function setType(type: string): void {
    residentType = type;
    $('type-owner').className = type === 'OWNER' ? '' : 'secondary';
    $('type-tenant').className = type === 'TENANT' ? '' : 'secondary';
  }

  async function saveApartment(): Promise<void> {
    const apartment = $<HTMLInputElement>('apartment').value.trim();
    $('apt-error').textContent = '';
    if (!apartment) { $('apt-error').textContent = 'Укажите номер квартиры'; return; }
    try {
      me = await api<Me>('PATCH', '/me', { houseId: selected!.house!.id, apartment, residentType });
      showHome();
    } catch (e) {
      $('apt-error').textContent = (e as Error).message;
    }
  }

  async function showHome(): Promise<void> {
    show('home');
    $('home-address').textContent = me!.house!.address;
    $('home-apartment').textContent = `кв. ${me!.apartment}` + (me!.entrance ? `, подъезд ${me!.entrance}` : '') + ` · ${me!.residentTypeLabel.toLowerCase()}`;
    if (!categories.length) {
      const dict = await api<{ categories: { value: string; label: string }[] }>('GET', '/dictionaries');
      categories = dict.categories;
      $('category').innerHTML = categories.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
    }
    loadAnnouncements();
    loadRequests();
    loadNews();
  }

  async function loadAnnouncements(): Promise<void> {
    const wrap = $('announcements-card');
    const box = $('announcements');
    try {
      const list = await api<AnnouncementItem[]>('GET', '/announcements?limit=20');
      if (!list.length) { wrap.style.display = 'none'; return; }
      wrap.style.display = '';
      box.className = '';
      box.innerHTML = '';
      list.forEach((a) => {
        const el = document.createElement('div');
        el.className = 'request';
        el.innerHTML = `<div style="font-weight:600">${a.title}</div><div>${a.description}</div>` +
          `<div class="muted">${a.author.name} · ${new Date(a.createdAt).toLocaleDateString('ru-RU')}</div>`;
        box.appendChild(el);
      });
    } catch {
      wrap.style.display = 'none';
    }
  }

  async function loadRequests(): Promise<void> {
    const box = $('requests');
    try {
      const list = await api<RequestItem[]>('GET', '/requests?filter=all&limit=50');
      box.className = '';
      box.innerHTML = list.length ? '' : '<div class="muted">Заявок пока нет</div>';
      list.forEach((r) => {
        const el = document.createElement('div');
        el.className = 'request';
        const votes = r.status === 'VOTING' ? `<div class="muted">Подписей: ${r.votesCount} из ${r.votesRequired}</div>` : '';
        el.innerHTML = `<div>${r.title}${r.isMine ? ' <span class="muted">(моя)</span>' : ''}<span class="status">${r.statusLabel}</span></div>` +
          `<div class="muted">${r.author.name}, кв. ${r.author.apartment || '—'}</div>${votes}`;
        if (r.canVote) {
          const b = document.createElement('button');
          b.textContent = 'Поддержать';
          b.className = 'secondary';
          b.style.marginTop = '6px';
          b.onclick = async () => { b.disabled = true; try { await api('POST', `/requests/${r.id}/vote`); loadRequests(); } catch (e) { alert((e as Error).message); b.disabled = false; } };
          el.appendChild(b);
        }
        box.appendChild(el);
      });
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
    }
  }

  async function loadNews(): Promise<void> {
    const box = $('news-list');
    try {
      const list = await api<NewsItem[]>('GET', '/news?limit=20');
      box.className = '';
      box.innerHTML = list.length ? '' : '<div class="muted">Новостей пока нет</div>';
      list.forEach((n) => {
        const el = document.createElement('div');
        el.className = 'request';
        el.innerHTML = `<div style="font-weight:600">${n.title}${n.isMine ? ' <span class="muted">(моя)</span>' : ''}</div><div>${n.description}</div>` +
          `<div class="muted">${n.author.name} · ${new Date(n.createdAt).toLocaleDateString('ru-RU')}</div>` +
          `<div class="muted">Связаться: ${n.contact}</div>`;
        if (n.isMine) {
          const b = document.createElement('button');
          b.textContent = 'Удалить';
          b.className = 'secondary';
          b.style.marginTop = '6px';
          b.onclick = async () => { if (!confirm('Удалить новость?')) return; try { await api('DELETE', `/news/${n.id}`); loadNews(); } catch (e) { alert((e as Error).message); } };
          el.appendChild(b);
        }
        box.appendChild(el);
      });
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
    }
  }

  async function sendNews(): Promise<void> {
    $('news-error').textContent = '';
    $('news-ok').textContent = '';
    const btn = $<HTMLButtonElement>('news-send');
    btn.disabled = true;
    try {
      await api<NewsItem>('POST', '/news', {
        title: $<HTMLInputElement>('news-title').value.trim(),
        description: $<HTMLTextAreaElement>('news-description').value.trim(),
        contact: $<HTMLInputElement>('news-contact').value.trim(),
      });
      $<HTMLInputElement>('news-title').value = '';
      $<HTMLTextAreaElement>('news-description').value = '';
      $<HTMLInputElement>('news-contact').value = '';
      $('news-ok').textContent = 'Новость опубликована.';
      loadNews();
    } catch (e) {
      $('news-error').textContent = (e as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  async function sendRequest(): Promise<void> {
    $('req-error').textContent = '';
    $('req-ok').textContent = '';
    const btn = $<HTMLButtonElement>('req-send');
    btn.disabled = true;
    try {
      const r = await api<RequestItem>('POST', '/requests', {
        category: $<HTMLSelectElement>('category').value,
        description: $<HTMLTextAreaElement>('description').value.trim(),
        priority: $<HTMLInputElement>('emergency').checked ? 'EMERGENCY' : 'NORMAL',
      });
      $<HTMLTextAreaElement>('description').value = '';
      $<HTMLInputElement>('emergency').checked = false;
      $('req-ok').textContent = r.status === 'VOTING' ? `Заявка №${r.id} создана. Нужно ${r.votesRequired} ${plural(r.votesRequired, 'подпись', 'подписи', 'подписей')} соседей.` : `Заявка №${r.id} передана в УК.`;
      loadRequests();
    } catch (e) {
      $('req-error').textContent = (e as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  async function start(): Promise<void> {
    if (window.WebApp && typeof window.WebApp.ready === 'function') window.WebApp.ready();
    if (!userId && !initData) {
      $('fatal').textContent = 'Откройте приложение из бота в MAX. Для разработки добавьте к адресу ?dev=<MAX id>, например /app/?dev=900000001';
      show('error');
      return;
    }
    $('search-btn').onclick = searchAddress;
    $('search').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchAddress(); });
    $('locate-btn').onclick = () => map!.locate({ setView: true, maxZoom: 17 });
    $('type-owner').onclick = () => setType('OWNER');
    $('type-tenant').onclick = () => setType('TENANT');
    $('apt-back').onclick = showMap;
    $('apt-save').onclick = saveApartment;
    $('change-house').onclick = showMap;
    $('req-send').onclick = sendRequest;
    $('news-send').onclick = sendNews;
    setType('OWNER');
    try {
      me = await api<Me>('GET', '/me');
      if (me.role === 'UK_EMPLOYEE') { $('fatal').textContent = 'Панель сотрудника УК — в боте (команда /requests). Мини-приложение предназначено для жителей.'; show('error'); return; }
      if (me.onboarded) showHome(); else showMap();
    } catch (e) {
      $('fatal').textContent = (e as Error).message;
      show('error');
    }
  }

  start();
})();
