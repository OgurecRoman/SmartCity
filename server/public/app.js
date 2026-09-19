/* Мини-приложение «Умный дом»: выбор дома на карте, регистрация квартиры, заявки.
   Без сборки: обычный JS, Leaflet с тайлами OpenStreetMap, API — тот же сервер. */
(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.slice(1));
  // SDK MAX даёт пользователя в initDataUnsafe (id, first_name…) и подписанную строку initData;
  // при открытии по ссылке те же данные лежат в фрагменте URL (WebAppData). Для разработки — ?dev=<MAX id>
  const sdkUser = (window.WebApp && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.user) || null;
  const initData = (window.WebApp && window.WebApp.initData) || hashParams.get('WebAppData') || '';
  const userId = params.get('dev') || (sdkUser && sdkUser.id ? String(sdkUser.id) : '');

  let me = null;
  let map = null;
  let marker = null;
  let selected = null; // { lat, lng, building, house }
  let residentType = 'OWNER';
  let categories = [];

  function authHeaders() {
    const headers = {};
    // Простой режим сервера (DEV_AUTH_BYPASS=true) верит этим заголовкам, строгий — проверяет подпись initData
    if (userId) headers['X-Dev-User-Id'] = userId;
    if (sdkUser) headers['X-Dev-User-Name'] = encodeURIComponent([sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(' '));
    if (initData) headers.Authorization = 'MaxInitData ' + initData;
    return headers;
  }

  async function api(method, path, body) {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error((data && data.error && data.error.message) || 'Ошибка ' + res.status);
      error.code = data && data.error && data.error.code;
      throw error;
    }
    return data;
  }

  function show(name) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === 'screen-' + name));
    if (name === 'map' && map) setTimeout(() => map.invalidateSize(), 0);
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function describeBuilding(b) {
    if (!b.apartmentsCount && !b.entrances.length) return 'Число квартир в открытых данных не указано — номер квартиры не проверяется';
    const parts = [];
    if (b.apartmentsCount) parts.push(`${b.apartmentsCount} ${plural(b.apartmentsCount, 'квартира', 'квартиры', 'квартир')}`);
    if (b.entrances.length) parts.push(`${b.entrances.length} ${plural(b.entrances.length, 'подъезд', 'подъезда', 'подъездов')}`);
    return parts.join(', ');
  }

  // ---------- Экран карты ----------
  function showMap() {
    show('map');
    if (map) return;
    map = L.map('map').setView([55.7887, 49.1221], 12); // Казань
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    map.on('click', (e) => pickPoint(e.latlng.lat, e.latlng.lng));
    api('GET', '/houses').then((houses) => {
      const known = houses.filter((h) => h.lat !== null);
      known.forEach((h) => L.circleMarker([h.lat, h.lng], { radius: 8, color: '#1a9c4b', fillOpacity: 0.7 }).addTo(map).bindTooltip(h.address));
      if (known.length) map.fitBounds(known.map((h) => [h.lat, h.lng]), { maxZoom: 16, padding: [30, 30] });
    }).catch(() => {});
    if (me && me.house && me.house.lat !== null) map.setView([me.house.lat, me.house.lng], 17);
  }

  async function pickPoint(lat, lng) {
    if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng]).addTo(map);
    const card = $('house-card');
    card.className = 'card muted';
    card.textContent = 'Ищем дом…';
    try {
      const { building, house } = await api('GET', `/houses/lookup?lat=${lat}&lng=${lng}`);
      selected = { lat, lng, building, house };
      card.className = 'card';
      card.innerHTML = `<div style="font-weight:600">${building.address}</div><div class="muted">${describeBuilding(building)}</div>` +
        `<button id="pick-house" style="margin-top:10px;width:100%">Это мой дом</button>`;
      $('pick-house').onclick = confirmHouse;
    } catch (e) {
      selected = null;
      card.className = 'card error';
      card.textContent = e.message;
    }
  }

  async function confirmHouse() {
    const btn = $('pick-house');
    btn.disabled = true;
    try {
      const house = await api('POST', '/houses', { lat: selected.lat, lng: selected.lng });
      selected.house = house;
      $('apt-house').textContent = house.address;
      $('apt-info').textContent = describeBuilding(house);
      $('apt-error').textContent = '';
      $('apartment').value = (me && me.apartment) || '';
      show('apartment');
    } catch (e) {
      $('house-card').className = 'card error';
      $('house-card').textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function searchAddress() {
    const q = $('search').value.trim();
    const box = $('search-results');
    if (q.length < 3) return;
    box.textContent = 'Ищем…';
    try {
      const results = await api('GET', '/geo/search?q=' + encodeURIComponent(q));
      box.innerHTML = '';
      if (!results.length) box.textContent = 'Ничего не найдено — уточните адрес';
      results.forEach((r) => {
        const b = document.createElement('button');
        b.textContent = r.label;
        b.onclick = () => { box.innerHTML = ''; map.setView([r.lat, r.lng], 18); pickPoint(r.lat, r.lng); };
        box.appendChild(b);
      });
    } catch (e) {
      box.textContent = e.message;
    }
  }

  // ---------- Экран квартиры ----------
  function setType(type) {
    residentType = type;
    $('type-owner').className = type === 'OWNER' ? '' : 'secondary';
    $('type-tenant').className = type === 'TENANT' ? '' : 'secondary';
  }

  async function saveApartment() {
    const apartment = $('apartment').value.trim();
    $('apt-error').textContent = '';
    if (!apartment) { $('apt-error').textContent = 'Укажите номер квартиры'; return; }
    try {
      me = await api('PATCH', '/me', { houseId: selected.house.id, apartment, residentType });
      showHome();
    } catch (e) {
      $('apt-error').textContent = e.message; // например: «В доме 80 квартир (1–80), квартиры 81 нет»
    }
  }

  // ---------- Экран заявок ----------
  async function showHome() {
    show('home');
    $('home-address').textContent = me.house.address;
    $('home-apartment').textContent = `кв. ${me.apartment}` + (me.entrance ? `, подъезд ${me.entrance}` : '') + ` · ${me.residentTypeLabel.toLowerCase()}`;
    if (!categories.length) {
      const dict = await api('GET', '/dictionaries');
      categories = dict.categories;
      $('category').innerHTML = categories.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
    }
    loadRequests();
  }

  async function loadRequests() {
    const box = $('requests');
    try {
      const list = await api('GET', '/requests?filter=all&limit=50');
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
          b.onclick = async () => { b.disabled = true; try { await api('POST', `/requests/${r.id}/vote`); loadRequests(); } catch (e) { alert(e.message); b.disabled = false; } };
          el.appendChild(b);
        }
        box.appendChild(el);
      });
    } catch (e) {
      box.className = 'error';
      box.textContent = e.message;
    }
  }

  async function sendRequest() {
    $('req-error').textContent = '';
    $('req-ok').textContent = '';
    const btn = $('req-send');
    btn.disabled = true;
    try {
      const r = await api('POST', '/requests', {
        category: $('category').value,
        description: $('description').value.trim(),
        priority: $('emergency').checked ? 'EMERGENCY' : 'NORMAL',
      });
      $('description').value = '';
      $('emergency').checked = false;
      $('req-ok').textContent = r.status === 'VOTING' ? `Заявка №${r.id} создана. Нужно ${r.votesRequired} ${plural(r.votesRequired, 'подпись', 'подписи', 'подписей')} соседей.` : `Заявка №${r.id} передана в УК.`;
      loadRequests();
    } catch (e) {
      $('req-error').textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- Запуск ----------
  async function start() {
    if (window.WebApp && typeof window.WebApp.ready === 'function') window.WebApp.ready();
    if (!userId && !initData) {
      $('fatal').textContent = 'Откройте приложение из бота в MAX. Для разработки добавьте к адресу ?dev=<MAX id>, например /app/?dev=900000001';
      show('error');
      return;
    }
    $('search-btn').onclick = searchAddress;
    $('search').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchAddress(); });
    $('locate-btn').onclick = () => map.locate({ setView: true, maxZoom: 17 });
    $('type-owner').onclick = () => setType('OWNER');
    $('type-tenant').onclick = () => setType('TENANT');
    $('apt-back').onclick = showMap;
    $('apt-save').onclick = saveApartment;
    $('change-house').onclick = showMap;
    $('req-send').onclick = sendRequest;
    setType('OWNER');
    try {
      me = await api('GET', '/me');
      if (me.role === 'UK_EMPLOYEE') { $('fatal').textContent = 'Панель сотрудника УК — в боте (команда /requests). Мини-приложение предназначено для жителей.'; show('error'); return; }
      if (me.onboarded) showHome(); else showMap();
    } catch (e) {
      $('fatal').textContent = e.message;
      show('error');
    }
  }

  start();
})();
