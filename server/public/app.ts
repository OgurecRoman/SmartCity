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

interface Membership {
  status: 'PENDING' | 'REJECTED';
  rejectReason: string | null;
}

interface Me {
  role: string;
  onboarded: boolean;
  apartment: string | null;
  entrance: string | null;
  residentTypeLabel: string | null;
  verifiedFullName: string | null;
  house: House | null;
  membership: Membership | null;
}

interface RequestItem {
  id: number;
  title: string;
  description: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  isMine: boolean;
  canVote: boolean;
  votesCount: number;
  votesRequired: number;
  author: { name: string; apartment: string | null };
  house: { id: number; address: string };
  delegatedTo: { id: number; name: string } | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
  photoUrls: string[];
  resultPhotoUrls: string[];
}

interface Organization {
  id: number;
  name: string;
  categories: string[];
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
  photoUrls: string[];
  createdAt: string;
}

interface NewsItem {
  id: number;
  title: string;
  description: string;
  contact: string;
  author: { name: string };
  isMine: boolean;
  photoUrls: string[];
  createdAt: string;
}

interface Resident {
  id: number;
  maxUserId: string;
  username: string | null;
  apartment: string | null;
  fullName: string;
  verified: boolean;
  residentTypeLabel: string | null;
}

interface Camera {
  id: number;
  houseId: number;
  houseAddress: string;
  label: string;
  streamUrl: string | null;
}

interface MembershipRequestItem {
  id: number;
  houseAddress: string;
  apartment: string;
  fullName: string;
  applicant: { name: string };
  createdAt: string;
}

interface Page<T> {
  items: T[];
  total: number;
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
  let categories: { value: string; label: string }[] = [];

  const PAGE_SIZE = 5;
  let requestsOffset = 0;
  let announcementsOffset = 0;
  let newsOffset = 0;
  let membershipOffset = 0;
  let ukRequestsOffset = 0;
  let organizations: Organization[] = [];
  let resolvingRequestId: number | null = null;

  function updatePager(infoId: string, buttonId: string, shown: number, total: number): void {
    $(infoId).textContent = total > 0 ? `Показано ${shown} из ${total}` : '';
    $<HTMLButtonElement>(buttonId).style.display = shown < total ? '' : 'none';
  }

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (userId) headers['X-Dev-User-Id'] = userId;
    if (sdkUser) headers['X-Dev-User-Name'] = encodeURIComponent([sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(' '));
    if (initData) headers.Authorization = 'MaxInitData ' + initData;
    return headers;
  }

  async function handleApiResponse<T>(res: Response): Promise<T> {
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const error: ApiError = new Error((data && data.error && data.error.message) || 'Ошибка ' + res.status);
      error.code = data && data.error && data.error.code;
      throw error;
    }
    return data as T;
  }

  async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleApiResponse<T>(res);
  }

  async function apiForm<T>(method: string, path: string, form: FormData): Promise<T> {
    const res = await fetch('/api' + path, { method, headers: authHeaders(), body: form });
    return handleApiResponse<T>(res);
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
      $<HTMLInputElement>('full-name').value = (me && me.verifiedFullName) || '';
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

  async function loadMe(): Promise<void> {
    me = await api<Me>('GET', '/me');
  }

  async function submitMembership(): Promise<void> {
    const apartment = $<HTMLInputElement>('apartment').value.trim();
    const fullName = $<HTMLInputElement>('full-name').value.trim();
    $('apt-error').textContent = '';
    if (!apartment) { $('apt-error').textContent = 'Укажите номер квартиры'; return; }
    if (!fullName) { $('apt-error').textContent = 'Укажите ФИО'; return; }
    const btn = $<HTMLButtonElement>('apt-save');
    btn.disabled = true;
    try {
      await api('PATCH', '/me', { houseId: selected!.house!.id, apartment, fullName });
      await loadMe();
      showHome();
    } catch (e) {
      $('apt-error').textContent = (e as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  function renderStatus(): void {
    const card = $('status-card');
    const text = $('status-text');
    if (!me!.membership) { card.style.display = 'none'; return; }
    card.style.display = '';
    if (me!.membership.status === 'PENDING') {
      card.className = 'card muted';
      text.textContent = 'Заявка на вступление отправлена и ждёт подтверждения председателя ТСЖ или УК. Вы уже можете читать объявления и новости дома.';
    } else {
      card.className = 'card error';
      text.textContent = `Заявка на вступление отклонена. Причина: ${me!.membership.rejectReason}`;
    }
  }

  async function showHome(): Promise<void> {
    show('home');
    renderStatus();
    $('home-address').textContent = me!.house ? me!.house.address : 'Дом ещё не выбран';
    $('home-apartment').textContent = me!.apartment
      ? `кв. ${me!.apartment}` + (me!.entrance ? `, подъезд ${me!.entrance}` : '') + (me!.residentTypeLabel ? ` · ${me!.residentTypeLabel.toLowerCase()}` : '')
      : '';
    $('change-house').textContent = me!.onboarded ? 'Сменить дом' : 'Подать заявку заново';

    const approved = me!.onboarded;
    $('cameras-card').style.display = approved ? '' : 'none';
    $('request-form-card').style.display = approved ? '' : 'none';
    $('requests-list-card').style.display = approved ? '' : 'none';
    $('news-form-card').style.display = approved ? '' : 'none';
    $('membership-card').style.display = approved && me!.role === 'CHAIRMAN' ? '' : 'none';

    if (approved) {
      if (!categories.length) {
        const dict = await api<{
          categories: { value: string; label: string }[];
          statuses: { value: string; label: string }[];
        }>('GET', '/dictionaries');
        categories = dict.categories;
        $('category').innerHTML = categories.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
        $('requests-filter-category').innerHTML = '<option value="">Все категории</option>' +
          categories.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
        $('requests-filter-status').innerHTML = '<option value="">Все статусы</option>' +
          dict.statuses.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');
      }
      loadRequests();
    }
    loadAnnouncements();
    loadNews();
  }

  function renderPhotoStrip(photoUrls: string[]): string {
    if (!photoUrls.length) return '';
    const thumbs = photoUrls.map((url) => `<a href="${url}" target="_blank"><img src="${url}" class="photo-thumb"></a>`).join('');
    return `<div class="photo-strip">${thumbs}</div>`;
  }

  function renderAnnouncementItem(a: AnnouncementItem): HTMLElement {
    const el = document.createElement('div');
    el.className = 'request';
    el.innerHTML = `<div style="font-weight:600">${a.title}</div><div>${a.description}</div>` +
      renderPhotoStrip(a.photoUrls) +
      `<div class="muted">${a.author.name} · ${new Date(a.createdAt).toLocaleDateString('ru-RU')}</div>`;
    return el;
  }

  async function loadAnnouncements(reset = true): Promise<void> {
    const wrap = $('announcements-card');
    const box = $('announcements');
    if (reset) announcementsOffset = 0;
    try {
      const { items, total } = await api<Page<AnnouncementItem>>('GET', `/announcements?limit=${PAGE_SIZE}&offset=${announcementsOffset}`);
      if (reset) {
        if (!total) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';
        box.className = '';
        box.innerHTML = '';
      }
      items.forEach((a) => box.appendChild(renderAnnouncementItem(a)));
      announcementsOffset += items.length;
      updatePager('announcements-pager-info', 'announcements-more', announcementsOffset, total);
    } catch {
      wrap.style.display = 'none';
    }
  }

  function renderRequestItem(r: RequestItem): HTMLElement {
    const el = document.createElement('div');
    el.className = 'request';
    const votes = r.status === 'VOTING' ? `<div class="muted">Подписей: ${r.votesCount} из ${r.votesRequired}</div>` : '';
    const resultPhotos = r.resultPhotoUrls.length
      ? `<div class="muted" style="margin-top:6px">📷 Фото результата:</div>${renderPhotoStrip(r.resultPhotoUrls)}`
      : '';
    el.innerHTML = `<div>${r.title}${r.isMine ? ' <span class="muted">(моя)</span>' : ''}<span class="status">${r.statusLabel}</span></div>` +
      `<div class="muted">${r.author.name}, кв. ${r.author.apartment || '—'}</div>${votes}` +
      renderPhotoStrip(r.photoUrls) + resultPhotos;
    if (r.canVote) {
      const b = document.createElement('button');
      b.textContent = 'Поддержать';
      b.className = 'secondary';
      b.style.marginTop = '6px';
      b.onclick = async () => { b.disabled = true; try { await api('POST', `/requests/${r.id}/vote`); loadRequests(true); } catch (e) { alert((e as Error).message); b.disabled = false; } };
      el.appendChild(b);
    }
    return el;
  }

  async function loadRequests(reset = true): Promise<void> {
    const box = $('requests');
    if (reset) requestsOffset = 0;
    const category = $<HTMLSelectElement>('requests-filter-category').value;
    const status = $<HTMLSelectElement>('requests-filter-status').value;
    const query = new URLSearchParams({ filter: 'all', limit: String(PAGE_SIZE), offset: String(requestsOffset) });
    if (category) query.set('category', category);
    if (status) query.set('status', status);
    try {
      const { items, total } = await api<Page<RequestItem>>('GET', '/requests?' + query.toString());
      if (reset) {
        box.className = '';
        box.innerHTML = total ? '' : '<div class="muted">Заявок пока нет</div>';
      }
      items.forEach((r) => box.appendChild(renderRequestItem(r)));
      requestsOffset += items.length;
      updatePager('requests-pager-info', 'requests-more', requestsOffset, total);
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
      updatePager('requests-pager-info', 'requests-more', 0, 0);
    }
  }

  function renderNewsItem(n: NewsItem): HTMLElement {
    const el = document.createElement('div');
    el.className = 'request';
    el.innerHTML = `<div style="font-weight:600">${n.title}${n.isMine ? ' <span class="muted">(моя)</span>' : ''}</div><div>${n.description}</div>` +
      renderPhotoStrip(n.photoUrls) +
      `<div class="muted">${n.author.name} · ${new Date(n.createdAt).toLocaleDateString('ru-RU')}</div>` +
      `<div class="muted">Связаться: ${n.contact}</div>`;
    if (n.isMine) {
      const b = document.createElement('button');
      b.textContent = 'Удалить';
      b.className = 'secondary';
      b.style.marginTop = '6px';
      b.onclick = async () => { if (!confirm('Удалить новость?')) return; try { await api('DELETE', `/news/${n.id}`); loadNews(true); } catch (e) { alert((e as Error).message); } };
      el.appendChild(b);
    }
    return el;
  }

  async function loadNews(reset = true): Promise<void> {
    const box = $('news-list');
    if (reset) newsOffset = 0;
    try {
      const { items, total } = await api<Page<NewsItem>>('GET', `/news?limit=${PAGE_SIZE}&offset=${newsOffset}`);
      if (reset) {
        box.className = '';
        box.innerHTML = total ? '' : '<div class="muted">Новостей пока нет</div>';
      }
      items.forEach((n) => box.appendChild(renderNewsItem(n)));
      newsOffset += items.length;
      updatePager('news-pager-info', 'news-more', newsOffset, total);
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
      updatePager('news-pager-info', 'news-more', 0, 0);
    }
  }

  function renderFilePreview(input: HTMLInputElement, box: HTMLElement): void {
    box.innerHTML = '';
    Array.from(input.files ?? []).forEach((file) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      box.appendChild(img);
    });
  }

  function appendPhotos(form: FormData, input: HTMLInputElement): void {
    Array.from(input.files ?? []).forEach((file) => form.append('photos', file));
  }

  async function sendNews(): Promise<void> {
    $('news-error').textContent = '';
    $('news-ok').textContent = '';
    const btn = $<HTMLButtonElement>('news-send');
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set('title', $<HTMLInputElement>('news-title').value.trim());
      form.set('description', $<HTMLTextAreaElement>('news-description').value.trim());
      form.set('contact', $<HTMLInputElement>('news-contact').value.trim());
      const photosInput = $<HTMLInputElement>('news-photos');
      appendPhotos(form, photosInput);
      await apiForm<NewsItem>('POST', '/news', form);
      $<HTMLInputElement>('news-title').value = '';
      $<HTMLTextAreaElement>('news-description').value = '';
      $<HTMLInputElement>('news-contact').value = '';
      photosInput.value = '';
      $('news-photos-preview').innerHTML = '';
      $('news-ok').textContent = 'Новость опубликована.';
      loadNews();
    } catch (e) {
      $('news-error').textContent = (e as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  function renderCameras(box: HTMLElement, cameras: Camera[]): void {
    box.className = '';
    box.innerHTML = cameras.length ? '' : '<div class="muted">В этом доме пока нет камер</div>';
    cameras.forEach((c) => {
      const el = document.createElement('div');
      el.className = 'request';
      el.innerHTML = `<div style="font-weight:600">${c.label}</div>` +
        `<div class="camera-box">${c.streamUrl ? `<a href="${c.streamUrl}" target="_blank">Открыть трансляцию</a>` : 'Здесь будет трансляция'}</div>`;
      box.appendChild(el);
    });
  }

  async function showCameras(): Promise<void> {
    show('cameras');
    $('cameras-house').textContent = me!.house ? me!.house.address : '';
    const box = $('cameras-list');
    box.className = 'muted';
    box.textContent = 'Загрузка…';
    try {
      const cameras = await api<Camera[]>('GET', '/cameras');
      renderCameras(box, cameras);
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
    }
  }

  async function loadUkCameras(): Promise<void> {
    const box = $('uk-cameras');
    const houseId = $<HTMLSelectElement>('uk-house').value;
    if (!houseId) { box.className = 'muted'; box.textContent = 'Выберите дом'; return; }
    box.className = 'muted';
    box.textContent = 'Загрузка…';
    try {
      const cameras = await api<Camera[]>('GET', `/cameras?houseId=${houseId}`);
      renderCameras(box, cameras);
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
    }
  }

  async function showUk(): Promise<void> {
    show('uk');
    const select = $<HTMLSelectElement>('uk-house');
    if (!select.options.length) {
      const houses = await api<House[]>('GET', '/houses');
      select.innerHTML = '<option value="">— выберите дом —</option>' + houses.map((h) => `<option value="${h.id}">${h.address}</option>`).join('');
    }
  }

  async function loadUkResidents(): Promise<void> {
    const box = $('uk-residents');
    const houseId = $<HTMLSelectElement>('uk-house').value;
    if (!houseId) { box.className = 'muted'; box.textContent = 'Выберите дом'; return; }
    box.className = 'muted';
    box.textContent = 'Загрузка…';
    try {
      const list = await api<Resident[]>('GET', `/residents?houseId=${houseId}`);
      box.className = '';
      box.innerHTML = list.length ? '' : '<div class="muted">В этом доме пока нет подтверждённых жителей</div>';
      list.forEach((r) => {
        const el = document.createElement('div');
        el.className = 'request';
        el.innerHTML = `<div style="font-weight:600">Кв. ${r.apartment ?? '—'} · ${r.fullName}${r.verified ? '' : ' <span class="muted">(ФИО не подтверждено)</span>'}</div>` +
          `<div class="muted">${r.residentTypeLabel ?? ''} · ${r.username ? '@' + r.username : 'без ника'} · MAX ID ${r.maxUserId}</div>`;
        box.appendChild(el);
      });
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
    }
  }

  function loadUkHouse(): void {
    loadUkResidents();
    loadUkCameras();
  }

  async function ensureOrganizations(): Promise<Organization[]> {
    if (!organizations.length) organizations = await api<Organization[]>('GET', '/organizations');
    return organizations;
  }

  async function ukChangeStatus(requestId: number, status: string): Promise<void> {
    try {
      await api('PATCH', `/requests/${requestId}/status`, { status });
      loadUkRequests(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function ukReject(requestId: number): Promise<void> {
    const comment = prompt('Причина отклонения (необязательно):');
    if (comment === null) return;
    try {
      await api('PATCH', `/requests/${requestId}/status`, { status: 'REJECTED', comment: comment.trim() || undefined });
      loadUkRequests(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function toggleDelegatePicker(container: HTMLElement, requestId: number): Promise<void> {
    const existing = container.querySelector('.delegate-picker');
    if (existing) { existing.remove(); return; }
    const orgs = await ensureOrganizations();
    const wrap = document.createElement('div');
    wrap.className = 'delegate-picker row';
    wrap.style.marginTop = '6px';
    const select = document.createElement('select');
    select.innerHTML = orgs.map((o) => `<option value="${o.id}">${o.name}</option>`).join('');
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Передать';
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try {
        await api('PATCH', `/requests/${requestId}/status`, { status: 'DELEGATED', organizationId: Number(select.value) });
        loadUkRequests(true);
      } catch (e) {
        alert((e as Error).message);
        confirmBtn.disabled = false;
      }
    };
    wrap.appendChild(select);
    wrap.appendChild(confirmBtn);
    container.appendChild(wrap);
  }

  function renderUkRequestItem(r: RequestItem): HTMLElement {
    const el = document.createElement('div');
    el.className = 'request';
    const resolution = r.resolutionNote
      ? `<div class="muted" style="margin-top:6px">Выполнено: ${r.resolutionNote}${r.resolvedByName ? ` (${r.resolvedByName})` : ''}</div>`
      : '';
    const resultPhotos = r.resultPhotoUrls.length
      ? `<div class="muted" style="margin-top:6px">📷 Фото результата:</div>${renderPhotoStrip(r.resultPhotoUrls)}`
      : '';
    el.innerHTML = `<div>${r.title}<span class="status">${r.statusLabel}</span></div>` +
      `<div class="muted">${r.categoryLabel} · ${r.author.name}, кв. ${r.author.apartment || '—'} · ${r.house.address}</div>` +
      `<div>${r.description}</div>` +
      (r.delegatedTo ? `<div class="muted">Передана в: ${r.delegatedTo.name}</div>` : '') +
      resolution + renderPhotoStrip(r.photoUrls) + resultPhotos;

    const actions = document.createElement('div');
    actions.className = 'row';
    actions.style.marginTop = '8px';
    actions.style.flexWrap = 'wrap';

    const addBtn = (text: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.className = 'secondary';
      b.style.marginTop = '6px';
      b.onclick = onClick;
      actions.appendChild(b);
    };

    if (r.status === 'SUBMITTED') addBtn('🛠 Взять в работу', () => ukChangeStatus(r.id, 'IN_PROGRESS'));
    if (r.status === 'DELEGATED') addBtn('🛠 Вернуть в работу', () => ukChangeStatus(r.id, 'IN_PROGRESS'));
    if (r.status === 'SUBMITTED' || r.status === 'IN_PROGRESS') addBtn('➡️ Передать', () => toggleDelegatePicker(el, r.id));
    addBtn('✅ Сделано', () => showResolve(r.id, r.title));
    addBtn('❌ Отклонить', () => ukReject(r.id));

    el.appendChild(actions);
    return el;
  }

  async function loadUkRequests(reset = true): Promise<void> {
    const box = $('uk-requests-list');
    if (reset) ukRequestsOffset = 0;
    try {
      const { items, total } = await api<Page<RequestItem>>('GET', `/uk/requests?limit=${PAGE_SIZE}&offset=${ukRequestsOffset}`);
      if (reset) {
        box.className = '';
        box.innerHTML = total ? '' : '<div class="muted">Активных заявок нет</div>';
      }
      items.forEach((r) => box.appendChild(renderUkRequestItem(r)));
      ukRequestsOffset += items.length;
      updatePager('uk-requests-pager-info', 'uk-requests-more', ukRequestsOffset, total);
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
      updatePager('uk-requests-pager-info', 'uk-requests-more', 0, 0);
    }
  }

  async function showUkRequests(): Promise<void> {
    show('uk-requests');
    await loadUkRequests(true);
  }

  function showResolve(requestId: number, title: string): void {
    resolvingRequestId = requestId;
    $('resolve-request-title').textContent = title;
    $<HTMLTextAreaElement>('resolve-note').value = '';
    $<HTMLInputElement>('resolve-name').value = '';
    $<HTMLInputElement>('resolve-photos').value = '';
    $('resolve-photos-preview').innerHTML = '';
    $('resolve-error').textContent = '';
    show('resolve');
  }

  async function sendResolve(): Promise<void> {
    $('resolve-error').textContent = '';
    const note = $<HTMLTextAreaElement>('resolve-note').value.trim();
    const name = $<HTMLInputElement>('resolve-name').value.trim();
    if (!note) { $('resolve-error').textContent = 'Опишите, что было сделано.'; return; }
    if (!name) { $('resolve-error').textContent = 'Укажите ФИО ответственного.'; return; }
    if (resolvingRequestId === null) return;
    const btn = $<HTMLButtonElement>('resolve-send');
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set('status', 'RESOLVED');
      form.set('resolutionNote', note);
      form.set('resolvedByName', name);
      appendPhotos(form, $<HTMLInputElement>('resolve-photos'));
      await apiForm('PATCH', `/requests/${resolvingRequestId}/status`, form);
      resolvingRequestId = null;
      await showUkRequests();
    } catch (e) {
      $('resolve-error').textContent = (e as Error).message;
    } finally {
      btn.disabled = false;
    }
  }

  function renderMembershipItem(m: MembershipRequestItem): HTMLElement {
    const el = document.createElement('div');
    el.className = 'request';
    el.innerHTML = `<div style="font-weight:600">Кв. ${m.apartment} · ${m.fullName}</div>` +
      `<div class="muted">${m.houseAddress} · заявитель: ${m.applicant.name} · ${new Date(m.createdAt).toLocaleDateString('ru-RU')}</div>`;
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '6px';
    const approveBtn = document.createElement('button');
    approveBtn.textContent = 'Подтвердить';
    approveBtn.onclick = async () => {
      approveBtn.disabled = true;
      try { await api('POST', `/membership/requests/${m.id}/approve`); loadMembership(true); }
      catch (e) { alert((e as Error).message); approveBtn.disabled = false; }
    };
    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Отклонить';
    rejectBtn.className = 'secondary';
    rejectBtn.onclick = async () => {
      const reason = prompt('Причина отказа:');
      if (!reason || !reason.trim()) return;
      rejectBtn.disabled = true;
      try { await api('POST', `/membership/requests/${m.id}/reject`, { reason: reason.trim() }); loadMembership(true); }
      catch (e) { alert((e as Error).message); rejectBtn.disabled = false; }
    };
    row.appendChild(approveBtn);
    row.appendChild(rejectBtn);
    el.appendChild(row);
    return el;
  }

  let membershipReturnTo: 'home' | 'uk' = 'home';

  async function showMembership(returnTo: 'home' | 'uk'): Promise<void> {
    membershipReturnTo = returnTo;
    show('membership');
    await loadMembership(true);
  }

  async function loadMembership(reset = true): Promise<void> {
    const box = $('membership-list');
    if (reset) {
      membershipOffset = 0;
      box.className = 'muted';
      box.textContent = 'Загрузка…';
    }
    try {
      const { items, total } = await api<Page<MembershipRequestItem>>('GET', `/membership/requests?limit=${PAGE_SIZE}&offset=${membershipOffset}`);
      if (reset) {
        box.className = '';
        box.innerHTML = total ? '' : '<div class="muted">Заявок на вступление нет</div>';
      }
      items.forEach((m) => box.appendChild(renderMembershipItem(m)));
      membershipOffset += items.length;
      updatePager('membership-pager-info', 'membership-more', membershipOffset, total);
    } catch (e) {
      box.className = 'error';
      box.textContent = (e as Error).message;
      updatePager('membership-pager-info', 'membership-more', 0, 0);
    }
  }

  async function sendRequest(): Promise<void> {
    $('req-error').textContent = '';
    $('req-ok').textContent = '';
    const btn = $<HTMLButtonElement>('req-send');
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set('category', $<HTMLSelectElement>('category').value);
      form.set('description', $<HTMLTextAreaElement>('description').value.trim());
      form.set('priority', $<HTMLInputElement>('emergency').checked ? 'EMERGENCY' : 'NORMAL');
      const photosInput = $<HTMLInputElement>('req-photos');
      appendPhotos(form, photosInput);
      const r = await apiForm<RequestItem>('POST', '/requests', form);
      $<HTMLTextAreaElement>('description').value = '';
      $<HTMLInputElement>('emergency').checked = false;
      photosInput.value = '';
      $('req-photos-preview').innerHTML = '';
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
    $('apt-back').onclick = showMap;
    $('apt-save').onclick = submitMembership;
    $('change-house').onclick = showMap;
    $('req-send').onclick = sendRequest;
    $('news-send').onclick = sendNews;
    $<HTMLInputElement>('req-photos').onchange = () => renderFilePreview($<HTMLInputElement>('req-photos'), $('req-photos-preview'));
    $<HTMLInputElement>('news-photos').onchange = () => renderFilePreview($<HTMLInputElement>('news-photos'), $('news-photos-preview'));
    $('requests-filter-category').onchange = () => loadRequests(true);
    $('requests-filter-status').onchange = () => loadRequests(true);
    $('requests-more').onclick = () => loadRequests(false);
    $('announcements-more').onclick = () => loadAnnouncements(false);
    $('news-more').onclick = () => loadNews(false);
    $('cameras-open').onclick = showCameras;
    $('cameras-back').onclick = showHome;
    $('uk-house').onchange = loadUkHouse;
    $('membership-open').onclick = () => showMembership('home');
    $('membership-open-uk').onclick = () => showMembership('uk');
    $('membership-more').onclick = () => loadMembership(false);
    $('membership-back').onclick = () => (membershipReturnTo === 'uk' ? showUk() : showHome());
    $('uk-requests-open').onclick = showUkRequests;
    $('uk-requests-back').onclick = showUk;
    $('uk-requests-more').onclick = () => loadUkRequests(false);
    $('resolve-back').onclick = showUkRequests;
    $('resolve-send').onclick = sendResolve;
    $<HTMLInputElement>('resolve-photos').onchange = () => renderFilePreview($<HTMLInputElement>('resolve-photos'), $('resolve-photos-preview'));
    if (sdkUser && (sdkUser.first_name || sdkUser.last_name)) {
      $('use-profile-name').style.display = '';
      $('use-profile-name').onclick = () => {
        $<HTMLInputElement>('full-name').value = [sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(' ').trim();
      };
    }
    try {
      await loadMe();
      if (me!.role === 'UK_EMPLOYEE') { showUk(); return; }
      if (me!.onboarded || me!.membership) showHome(); else showMap();
    } catch (e) {
      $('fatal').textContent = (e as Error).message;
      show('error');
    }
  }

  start();
})();
