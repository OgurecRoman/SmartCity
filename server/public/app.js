"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.slice(1));
  const sdkUser = window.WebApp && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.user || null;
  const initData = window.WebApp && window.WebApp.initData || hashParams.get("WebAppData") || "";
  const userId = params.get("dev") || (sdkUser && sdkUser.id ? String(sdkUser.id) : "");
  let me = null;
  let map = null;
  let marker = null;
  let selected = null;
  let categories = [];
  const PAGE_SIZE = 5;
  const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1e3;
  let requestsOffset = 0;
  let announcementsOffset = 0;
  let newsOffset = 0;
  let membershipOffset = 0;
  let ukRequestsOffset = 0;
  let organizations = [];
  let resolvingRequestId = null;
  let reopeningRequestId = null;
  let ukHouses = [];
  function canReopen(r) {
    return r.isMine && r.status === "RESOLVED" && !r.reopenedAt && !!r.resolvedAt && Date.now() - new Date(r.resolvedAt).getTime() <= REOPEN_WINDOW_MS;
  }
  function updatePager(infoId, buttonId, shown, total) {
    $(infoId).textContent = total > 0 ? `\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ${shown} \u0438\u0437 ${total}` : "";
    $(buttonId).style.display = shown < total ? "" : "none";
  }
  function authHeaders() {
    const headers = {};
    if (userId) headers["X-Dev-User-Id"] = userId;
    if (sdkUser) headers["X-Dev-User-Name"] = encodeURIComponent([sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(" "));
    if (initData) headers.Authorization = "MaxInitData " + initData;
    return headers;
  }
  async function handleApiResponse(res) {
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error(data && data.error && data.error.message || "\u041E\u0448\u0438\u0431\u043A\u0430 " + res.status);
      error.code = data && data.error && data.error.code;
      throw error;
    }
    return data;
  }
  async function api(method, path, body) {
    const res = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body ? JSON.stringify(body) : void 0
    });
    return handleApiResponse(res);
  }
  async function apiForm(method, path, form) {
    const res = await fetch("/api" + path, { method, headers: authHeaders(), body: form });
    return handleApiResponse(res);
  }
  function show(name) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === "screen-" + name));
    if (name === "map" && map) setTimeout(() => map.invalidateSize(), 0);
  }
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
  function formatReactionTime(minutes) {
    if (minutes < 60) return `${Math.round(minutes)} \u043C\u0438\u043D`;
    const hours = minutes / 60;
    if (hours < 24) return `${hours.toFixed(1)} \u0447`;
    return `${(hours / 24).toFixed(1)} \u0434\u043D`;
  }
  function formatCompanySummary(company) {
    const ratingLine = company.rating.count === 0 ? "\u041E\u0446\u0435\u043D\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442" : `${company.rating.average.toFixed(1)} \u2605 (${company.rating.count} ${plural(company.rating.count, "\u043E\u0446\u0435\u043D\u043A\u0430", "\u043E\u0446\u0435\u043D\u043A\u0438", "\u043E\u0446\u0435\u043D\u043E\u043A")})`;
    const parts = [ratingLine];
    if (company.metrics.avgReactionMinutes !== null) parts.push(`\u0441\u0440\u0435\u0434\u043D\u0435\u0435 \u0432\u0440\u0435\u043C\u044F \u0440\u0435\u0430\u043A\u0446\u0438\u0438 \u2014 ${formatReactionTime(company.metrics.avgReactionMinutes)}`);
    if (company.metrics.noReopenRate !== null) parts.push(`\u0437\u0430\u044F\u0432\u043E\u043A \u0431\u0435\u0437 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u2014 ${Math.round(company.metrics.noReopenRate)}%`);
    return parts.join(" \xB7 ");
  }
  function describeBuilding(b) {
    if (!b.apartmentsCount && !b.entrances.length) return "\u0427\u0438\u0441\u043B\u043E \u043A\u0432\u0430\u0440\u0442\u0438\u0440 \u0432 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E \u2014 \u043D\u043E\u043C\u0435\u0440 \u043A\u0432\u0430\u0440\u0442\u0438\u0440\u044B \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F";
    const parts = [];
    if (b.apartmentsCount) parts.push(`${b.apartmentsCount} ${plural(b.apartmentsCount, "\u043A\u0432\u0430\u0440\u0442\u0438\u0440\u0430", "\u043A\u0432\u0430\u0440\u0442\u0438\u0440\u044B", "\u043A\u0432\u0430\u0440\u0442\u0438\u0440")}`);
    if (b.entrances.length) parts.push(`${b.entrances.length} ${plural(b.entrances.length, "\u043F\u043E\u0434\u044A\u0435\u0437\u0434", "\u043F\u043E\u0434\u044A\u0435\u0437\u0434\u0430", "\u043F\u043E\u0434\u044A\u0435\u0437\u0434\u043E\u0432")}`);
    return parts.join(", ");
  }
  function showMap() {
    show("map");
    if (map) return;
    map = L.map("map").setView([55.7887, 49.1221], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "\xA9 OpenStreetMap" }).addTo(map);
    map.on("click", (e) => pickPoint(e.latlng.lat, e.latlng.lng));
    api("GET", "/houses").then((houses) => {
      const known = houses.filter((h) => h.lat !== null);
      known.forEach((h) => L.circleMarker([h.lat, h.lng], { radius: 8, color: "#1a9c4b", fillOpacity: 0.7 }).addTo(map).bindTooltip(h.address));
      if (known.length) map.fitBounds(known.map((h) => [h.lat, h.lng]), { maxZoom: 16, padding: [30, 30] });
    }).catch(() => {
    });
    if (me && me.house && me.house.lat !== null) map.setView([me.house.lat, me.house.lng], 17);
  }
  async function pickPoint(lat, lng) {
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng]).addTo(map);
    const card = $("house-card");
    card.className = "card muted";
    card.textContent = "\u0418\u0449\u0435\u043C \u0434\u043E\u043C\u2026";
    try {
      const { building, house } = await api("GET", `/houses/lookup?lat=${lat}&lng=${lng}`);
      selected = { lat, lng, building, house };
      card.className = "card";
      card.innerHTML = `<div style="font-weight:600">${building.address}</div><div class="muted">${describeBuilding(building)}</div><button id="pick-house" style="margin-top:10px;width:100%">\u042D\u0442\u043E \u043C\u043E\u0439 \u0434\u043E\u043C</button>`;
      $("pick-house").onclick = confirmHouse;
    } catch (e) {
      selected = null;
      card.className = "card error";
      card.textContent = e.message;
    }
  }
  async function confirmHouse() {
    const btn = $("pick-house");
    btn.disabled = true;
    try {
      const house = await api("POST", "/houses", { lat: selected.lat, lng: selected.lng });
      selected.house = house;
      $("apt-house").textContent = house.address;
      $("apt-info").textContent = describeBuilding(house);
      $("apt-error").textContent = "";
      $("apartment").value = me && me.apartment || "";
      $("full-name").value = me && me.verifiedFullName || "";
      show("apartment");
    } catch (e) {
      $("house-card").className = "card error";
      $("house-card").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  async function searchAddress() {
    const q = $("search").value.trim();
    const box = $("search-results");
    if (q.length < 3) return;
    box.textContent = "\u0418\u0449\u0435\u043C\u2026";
    try {
      const results = await api("GET", "/geo/search?q=" + encodeURIComponent(q));
      box.innerHTML = "";
      if (!results.length) box.textContent = "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u2014 \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441";
      results.forEach((r) => {
        const b = document.createElement("button");
        b.textContent = r.label;
        b.onclick = () => {
          box.innerHTML = "";
          map.setView([r.lat, r.lng], 18);
          pickPoint(r.lat, r.lng);
        };
        box.appendChild(b);
      });
    } catch (e) {
      box.textContent = e.message;
    }
  }
  async function loadMe() {
    me = await api("GET", "/me");
  }
  async function submitMembership() {
    const apartment = $("apartment").value.trim();
    const fullName = $("full-name").value.trim();
    $("apt-error").textContent = "";
    if (!apartment) {
      $("apt-error").textContent = "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u043E\u043C\u0435\u0440 \u043A\u0432\u0430\u0440\u0442\u0438\u0440\u044B";
      return;
    }
    if (!fullName) {
      $("apt-error").textContent = "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0424\u0418\u041E";
      return;
    }
    const btn = $("apt-save");
    btn.disabled = true;
    try {
      await api("PATCH", "/me", { houseId: selected.house.id, apartment, fullName });
      await loadMe();
      showHome();
    } catch (e) {
      $("apt-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  function renderStatus() {
    const card = $("status-card");
    const text = $("status-text");
    if (!me.membership) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";
    if (me.membership.status === "PENDING") {
      card.className = "card muted";
      text.textContent = "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0432\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430 \u0438 \u0436\u0434\u0451\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u0441\u0435\u0434\u0430\u0442\u0435\u043B\u044F \u0422\u0421\u0416 \u0438\u043B\u0438 \u0423\u041A. \u0412\u044B \u0443\u0436\u0435 \u043C\u043E\u0436\u0435\u0442\u0435 \u0447\u0438\u0442\u0430\u0442\u044C \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0438 \u043D\u043E\u0432\u043E\u0441\u0442\u0438 \u0434\u043E\u043C\u0430.";
    } else {
      card.className = "card error";
      text.textContent = `\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0432\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430. \u041F\u0440\u0438\u0447\u0438\u043D\u0430: ${me.membership.rejectReason}`;
    }
  }
  async function showHome() {
    show("home");
    renderStatus();
    $("home-address").textContent = me.house ? me.house.address : "\u0414\u043E\u043C \u0435\u0449\u0451 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D";
    $("home-apartment").textContent = me.apartment ? `\u043A\u0432. ${me.apartment}` + (me.entrance ? `, \u043F\u043E\u0434\u044A\u0435\u0437\u0434 ${me.entrance}` : "") + (me.residentTypeLabel ? ` \xB7 ${me.residentTypeLabel.toLowerCase()}` : "") : "";
    $("change-house").textContent = me.onboarded ? "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0434\u043E\u043C" : "\u041F\u043E\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0437\u0430\u043D\u043E\u0432\u043E";
    const approved = me.onboarded;
    $("cameras-card").style.display = approved ? "" : "none";
    $("request-form-card").style.display = approved ? "" : "none";
    $("requests-list-card").style.display = approved ? "" : "none";
    $("news-form-card").style.display = approved ? "" : "none";
    $("membership-card").style.display = approved && me.role === "CHAIRMAN" ? "" : "none";
    if (approved) {
      if (!categories.length) {
        const dict = await api("GET", "/dictionaries");
        categories = dict.categories;
        $("category").innerHTML = categories.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");
        $("requests-filter-category").innerHTML = '<option value="">\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438</option>' + categories.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");
        $("requests-filter-status").innerHTML = '<option value="">\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B</option>' + dict.statuses.map((s) => `<option value="${s.value}">${s.label}</option>`).join("");
      }
      loadRequests();
    }
    loadAnnouncements();
    loadNews();
    loadCompanyCard();
  }
  async function loadCompanyCard() {
    const card = $("company-card");
    try {
      const company = await api("GET", "/company");
      if (!company) {
        card.style.display = "none";
        return;
      }
      card.style.display = "";
      card.textContent = `${company.name} \xB7 ${formatCompanySummary(company)}`;
    } catch {
      card.style.display = "none";
    }
  }
  function renderPhotoStrip(photoUrls) {
    if (!photoUrls.length) return "";
    const thumbs = photoUrls.map((url) => `<a href="${url}" target="_blank"><img src="${url}" class="photo-thumb"></a>`).join("");
    return `<div class="photo-strip">${thumbs}</div>`;
  }
  function renderAnnouncementItem(a) {
    const el = document.createElement("div");
    el.className = "request";
    el.innerHTML = `<div style="font-weight:600">${a.title}</div><div>${a.description}</div>` + renderPhotoStrip(a.photoUrls) + `<div class="muted">${a.author.name} \xB7 ${new Date(a.createdAt).toLocaleDateString("ru-RU")}</div>`;
    return el;
  }
  async function loadAnnouncements(reset = true) {
    const wrap = $("announcements-card");
    const box = $("announcements");
    if (reset) announcementsOffset = 0;
    try {
      const { items, total } = await api("GET", `/announcements?limit=${PAGE_SIZE}&offset=${announcementsOffset}`);
      if (reset) {
        if (!total) {
          wrap.style.display = "none";
          return;
        }
        wrap.style.display = "";
        box.className = "";
        box.innerHTML = "";
      }
      items.forEach((a) => box.appendChild(renderAnnouncementItem(a)));
      announcementsOffset += items.length;
      updatePager("announcements-pager-info", "announcements-more", announcementsOffset, total);
    } catch {
      wrap.style.display = "none";
    }
  }
  function renderRequestItem(r) {
    const el = document.createElement("div");
    el.className = "request";
    const votes = r.status === "VOTING" ? `<div class="muted">\u041F\u043E\u0434\u043F\u0438\u0441\u0435\u0439: ${r.votesCount} \u0438\u0437 ${r.votesRequired}</div>` : "";
    const resultPhotos = r.resultPhotoUrls.length ? `<div class="muted" style="margin-top:6px">\u{1F4F7} \u0424\u043E\u0442\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430:</div>${renderPhotoStrip(r.resultPhotoUrls)}` : "";
    el.innerHTML = `<div>${r.title}${r.isMine ? ' <span class="muted">(\u043C\u043E\u044F)</span>' : ""}<span class="status">${r.statusLabel}</span></div><div class="muted">${r.author.name}, \u043A\u0432. ${r.author.apartment || "\u2014"}</div>${votes}` + renderPhotoStrip(r.photoUrls) + resultPhotos;
    if (r.canVote) {
      const b = document.createElement("button");
      b.textContent = "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0430\u0442\u044C";
      b.className = "secondary";
      b.style.marginTop = "6px";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await api("POST", `/requests/${r.id}/vote`);
          loadRequests(true);
        } catch (e) {
          alert(e.message);
          b.disabled = false;
        }
      };
      el.appendChild(b);
    }
    if (canReopen(r)) {
      const b = document.createElement("button");
      b.textContent = "\u{1F504} \u041D\u0435 \u0441\u0434\u0435\u043B\u0430\u043D\u043E, \u0432\u0435\u0440\u043D\u0443\u0442\u044C";
      b.className = "secondary";
      b.style.marginTop = "6px";
      b.onclick = () => showReopen(r.id, r.title);
      el.appendChild(b);
    }
    if (r.isMine && r.status === "RESOLVED") {
      el.appendChild(renderRatingWidget(r));
    }
    return el;
  }
  function renderRatingWidget(r) {
    const wrap = document.createElement("div");
    wrap.style.marginTop = "8px";
    const label = document.createElement("div");
    label.className = "muted";
    label.textContent = r.rating ? "\u0412\u0430\u0448\u0430 \u043E\u0446\u0435\u043D\u043A\u0430 \u0440\u0430\u0431\u043E\u0442\u044B \u0423\u041A:" : "\u041E\u0446\u0435\u043D\u0438\u0442\u0435 \u0440\u0430\u0431\u043E\u0442\u0443 \u0423\u041A \u043F\u043E \u044D\u0442\u043E\u0439 \u0437\u0430\u044F\u0432\u043A\u0435:";
    wrap.appendChild(label);
    const stars = document.createElement("div");
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement("span");
      star.textContent = r.rating && i <= r.rating ? "\u2605" : "\u2606";
      star.style.cursor = "pointer";
      star.style.fontSize = "22px";
      star.style.color = r.rating && i <= r.rating ? "#f5a623" : "#ccc";
      star.onclick = async () => {
        try {
          await api("POST", `/requests/${r.id}/rate`, { rating: i });
          loadRequests(true);
        } catch (e) {
          alert(e.message);
        }
      };
      stars.appendChild(star);
    }
    wrap.appendChild(stars);
    return wrap;
  }
  async function loadRequests(reset = true) {
    const box = $("requests");
    if (reset) requestsOffset = 0;
    const category = $("requests-filter-category").value;
    const status = $("requests-filter-status").value;
    const query = new URLSearchParams({ filter: "all", limit: String(PAGE_SIZE), offset: String(requestsOffset) });
    if (category) query.set("category", category);
    if (status) query.set("status", status);
    try {
      const { items, total } = await api("GET", "/requests?" + query.toString());
      if (reset) {
        box.className = "";
        box.innerHTML = total ? "" : '<div class="muted">\u0417\u0430\u044F\u0432\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442</div>';
      }
      items.forEach((r) => box.appendChild(renderRequestItem(r)));
      requestsOffset += items.length;
      updatePager("requests-pager-info", "requests-more", requestsOffset, total);
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
      updatePager("requests-pager-info", "requests-more", 0, 0);
    }
  }
  function renderNewsItem(n) {
    const el = document.createElement("div");
    el.className = "request";
    el.innerHTML = `<div style="font-weight:600">${n.title}${n.isMine ? ' <span class="muted">(\u043C\u043E\u044F)</span>' : ""}</div><div>${n.description}</div>` + renderPhotoStrip(n.photoUrls) + `<div class="muted">${n.author.name} \xB7 ${new Date(n.createdAt).toLocaleDateString("ru-RU")}</div><div class="muted">\u0421\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F: ${n.contact}</div>`;
    if (n.isMine) {
      const b = document.createElement("button");
      b.textContent = "\u0423\u0434\u0430\u043B\u0438\u0442\u044C";
      b.className = "secondary";
      b.style.marginTop = "6px";
      b.onclick = async () => {
        if (!confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C?")) return;
        try {
          await api("DELETE", `/news/${n.id}`);
          loadNews(true);
        } catch (e) {
          alert(e.message);
        }
      };
      el.appendChild(b);
    }
    return el;
  }
  async function loadNews(reset = true) {
    const box = $("news-list");
    if (reset) newsOffset = 0;
    try {
      const { items, total } = await api("GET", `/news?limit=${PAGE_SIZE}&offset=${newsOffset}`);
      if (reset) {
        box.className = "";
        box.innerHTML = total ? "" : '<div class="muted">\u041D\u043E\u0432\u043E\u0441\u0442\u0435\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442</div>';
      }
      items.forEach((n) => box.appendChild(renderNewsItem(n)));
      newsOffset += items.length;
      updatePager("news-pager-info", "news-more", newsOffset, total);
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
      updatePager("news-pager-info", "news-more", 0, 0);
    }
  }
  function renderFilePreview(input, box) {
    box.innerHTML = "";
    Array.from(input.files ?? []).forEach((file) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      box.appendChild(img);
    });
  }
  function appendPhotos(form, input) {
    Array.from(input.files ?? []).forEach((file) => form.append("photos", file));
  }
  async function sendNews() {
    $("news-error").textContent = "";
    $("news-ok").textContent = "";
    const btn = $("news-send");
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set("title", $("news-title").value.trim());
      form.set("description", $("news-description").value.trim());
      form.set("contact", $("news-contact").value.trim());
      const photosInput = $("news-photos");
      appendPhotos(form, photosInput);
      await apiForm("POST", "/news", form);
      $("news-title").value = "";
      $("news-description").value = "";
      $("news-contact").value = "";
      photosInput.value = "";
      $("news-photos-preview").innerHTML = "";
      $("news-ok").textContent = "\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u043E\u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u043D\u0430.";
      loadNews();
    } catch (e) {
      $("news-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  function renderCameras(box, cameras) {
    box.className = "";
    box.innerHTML = cameras.length ? "" : '<div class="muted">\u0412 \u044D\u0442\u043E\u043C \u0434\u043E\u043C\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043A\u0430\u043C\u0435\u0440</div>';
    cameras.forEach((c) => {
      const el = document.createElement("div");
      el.className = "request";
      el.innerHTML = `<div style="font-weight:600">${c.label}</div><div class="camera-box">${c.streamUrl ? `<a href="${c.streamUrl}" target="_blank">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u0440\u0430\u043D\u0441\u043B\u044F\u0446\u0438\u044E</a>` : "\u0417\u0434\u0435\u0441\u044C \u0431\u0443\u0434\u0435\u0442 \u0442\u0440\u0430\u043D\u0441\u043B\u044F\u0446\u0438\u044F"}</div>`;
      box.appendChild(el);
    });
  }
  async function showCameras() {
    show("cameras");
    $("cameras-house").textContent = me.house ? me.house.address : "";
    const box = $("cameras-list");
    box.className = "muted";
    box.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    try {
      const cameras = await api("GET", "/cameras");
      renderCameras(box, cameras);
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
    }
  }
  async function loadUkCameras() {
    const box = $("uk-cameras");
    const houseId = $("uk-house").value;
    if (!houseId) {
      box.className = "muted";
      box.textContent = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u043C";
      return;
    }
    box.className = "muted";
    box.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    try {
      const cameras = await api("GET", `/cameras?houseId=${houseId}`);
      renderCameras(box, cameras);
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
    }
  }
  async function showUk() {
    show("uk");
    const select = $("uk-house");
    if (!select.options.length) {
      ukHouses = await api("GET", "/houses");
      select.innerHTML = '<option value="">\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u043C \u2014</option>' + ukHouses.map((h) => `<option value="${h.id}">${h.address}</option>`).join("");
    }
    const ratingBox = $("uk-rating");
    try {
      const company = await api("GET", "/company");
      ratingBox.textContent = company ? formatCompanySummary(company) : "\u0423\u041A \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430";
    } catch (e) {
      ratingBox.textContent = e.message;
    }
  }
  async function loadUkResidents() {
    const box = $("uk-residents");
    const houseId = $("uk-house").value;
    if (!houseId) {
      box.className = "muted";
      box.textContent = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u043C";
      return;
    }
    box.className = "muted";
    box.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    try {
      const list = await api("GET", `/residents?houseId=${houseId}`);
      box.className = "";
      box.innerHTML = list.length ? "" : '<div class="muted">\u0412 \u044D\u0442\u043E\u043C \u0434\u043E\u043C\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u0436\u0438\u0442\u0435\u043B\u0435\u0439</div>';
      list.forEach((r) => {
        const el = document.createElement("div");
        el.className = "request";
        el.innerHTML = `<div style="font-weight:600">\u041A\u0432. ${r.apartment ?? "\u2014"} \xB7 ${r.fullName}${r.verified ? "" : ' <span class="muted">(\u0424\u0418\u041E \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E)</span>'}</div><div class="muted">${r.residentTypeLabel ?? ""} \xB7 ${r.username ? "@" + r.username : "\u0431\u0435\u0437 \u043D\u0438\u043A\u0430"} \xB7 MAX ID ${r.maxUserId}</div>`;
        box.appendChild(el);
      });
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
    }
  }
  function loadUkVotePercent() {
    const houseId = $("uk-house").value;
    const input = $("uk-vote-percent");
    $("uk-vote-percent-ok").textContent = "";
    $("uk-vote-percent-error").textContent = "";
    const house = ukHouses.find((h) => String(h.id) === houseId);
    if (!house) {
      input.value = "";
      input.disabled = true;
      input.placeholder = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u043C";
      return;
    }
    input.disabled = false;
    input.value = String(house.votePercent);
  }
  async function saveUkVotePercent() {
    $("uk-vote-percent-ok").textContent = "";
    $("uk-vote-percent-error").textContent = "";
    const houseId = $("uk-house").value;
    if (!houseId) {
      $("uk-vote-percent-error").textContent = "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u043C.";
      return;
    }
    const input = $("uk-vote-percent");
    const percent = Number(input.value);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      $("uk-vote-percent-error").textContent = "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0435\u043B\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u043E\u0442 0 \u0434\u043E 100.";
      return;
    }
    const btn = $("uk-vote-percent-save");
    btn.disabled = true;
    try {
      const updated = await api("PATCH", `/houses/${houseId}`, { votePercent: percent });
      const house = ukHouses.find((h) => h.id === updated.id);
      if (house) house.votePercent = updated.votePercent;
      $("uk-vote-percent-ok").textContent = "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E.";
    } catch (e) {
      $("uk-vote-percent-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  function loadUkHouse() {
    loadUkVotePercent();
    loadUkResidents();
    loadUkCameras();
  }
  async function ensureOrganizations() {
    if (!organizations.length) organizations = await api("GET", "/organizations");
    return organizations;
  }
  async function ukChangeStatus(requestId, status) {
    try {
      await api("PATCH", `/requests/${requestId}/status`, { status });
      loadUkRequests(true);
    } catch (e) {
      alert(e.message);
    }
  }
  async function ukReject(requestId) {
    const comment = prompt("\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E):");
    if (comment === null) return;
    try {
      await api("PATCH", `/requests/${requestId}/status`, { status: "REJECTED", comment: comment.trim() || void 0 });
      loadUkRequests(true);
    } catch (e) {
      alert(e.message);
    }
  }
  async function toggleDelegatePicker(container, requestId) {
    const existing = container.querySelector(".delegate-picker");
    if (existing) {
      existing.remove();
      return;
    }
    const orgs = await ensureOrganizations();
    const wrap = document.createElement("div");
    wrap.className = "delegate-picker row";
    wrap.style.marginTop = "6px";
    const select = document.createElement("select");
    select.innerHTML = orgs.map((o) => `<option value="${o.id}">${o.name}</option>`).join("");
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C";
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try {
        await api("PATCH", `/requests/${requestId}/status`, { status: "DELEGATED", organizationId: Number(select.value) });
        loadUkRequests(true);
      } catch (e) {
        alert(e.message);
        confirmBtn.disabled = false;
      }
    };
    wrap.appendChild(select);
    wrap.appendChild(confirmBtn);
    container.appendChild(wrap);
  }
  function renderUkRequestItem(r) {
    const el = document.createElement("div");
    el.className = "request";
    const resolution = r.resolutionNote ? `<div class="muted" style="margin-top:6px">\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E: ${r.resolutionNote}${r.resolvedByName ? ` (${r.resolvedByName})` : ""}</div>` : "";
    const resultPhotos = r.resultPhotoUrls.length ? `<div class="muted" style="margin-top:6px">\u{1F4F7} \u0424\u043E\u0442\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430:</div>${renderPhotoStrip(r.resultPhotoUrls)}` : "";
    el.innerHTML = `<div>${r.title}<span class="status">${r.statusLabel}</span></div><div class="muted">${r.categoryLabel} \xB7 ${r.author.name}, \u043A\u0432. ${r.author.apartment || "\u2014"} \xB7 ${r.house.address}</div><div>${r.description}</div>` + (r.delegatedTo ? `<div class="muted">\u041F\u0435\u0440\u0435\u0434\u0430\u043D\u0430 \u0432: ${r.delegatedTo.name}</div>` : "") + resolution + renderPhotoStrip(r.photoUrls) + resultPhotos;
    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.marginTop = "8px";
    actions.style.flexWrap = "wrap";
    const addBtn = (text, onClick) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.className = "secondary";
      b.style.marginTop = "6px";
      b.onclick = onClick;
      actions.appendChild(b);
    };
    if (r.status === "SUBMITTED") addBtn("\u{1F6E0} \u0412\u0437\u044F\u0442\u044C \u0432 \u0440\u0430\u0431\u043E\u0442\u0443", () => ukChangeStatus(r.id, "IN_PROGRESS"));
    if (r.status === "DELEGATED") addBtn("\u{1F6E0} \u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0432 \u0440\u0430\u0431\u043E\u0442\u0443", () => ukChangeStatus(r.id, "IN_PROGRESS"));
    if (r.status === "SUBMITTED" || r.status === "IN_PROGRESS") addBtn("\u27A1\uFE0F \u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C", () => toggleDelegatePicker(el, r.id));
    addBtn("\u2705 \u0421\u0434\u0435\u043B\u0430\u043D\u043E", () => showResolve(r.id, r.title));
    addBtn("\u274C \u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C", () => ukReject(r.id));
    el.appendChild(actions);
    return el;
  }
  async function loadUkRequests(reset = true) {
    const box = $("uk-requests-list");
    if (reset) ukRequestsOffset = 0;
    try {
      const { items, total } = await api("GET", `/uk/requests?limit=${PAGE_SIZE}&offset=${ukRequestsOffset}`);
      if (reset) {
        box.className = "";
        box.innerHTML = total ? "" : '<div class="muted">\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0437\u0430\u044F\u0432\u043E\u043A \u043D\u0435\u0442</div>';
      }
      items.forEach((r) => box.appendChild(renderUkRequestItem(r)));
      ukRequestsOffset += items.length;
      updatePager("uk-requests-pager-info", "uk-requests-more", ukRequestsOffset, total);
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
      updatePager("uk-requests-pager-info", "uk-requests-more", 0, 0);
    }
  }
  async function showUkRequests() {
    show("uk-requests");
    await loadUkRequests(true);
  }
  function showResolve(requestId, title) {
    resolvingRequestId = requestId;
    $("resolve-request-title").textContent = title;
    $("resolve-note").value = "";
    $("resolve-name").value = "";
    $("resolve-photos").value = "";
    $("resolve-photos-preview").innerHTML = "";
    $("resolve-error").textContent = "";
    show("resolve");
  }
  async function sendResolve() {
    $("resolve-error").textContent = "";
    const note = $("resolve-note").value.trim();
    const name = $("resolve-name").value.trim();
    if (!note) {
      $("resolve-error").textContent = "\u041E\u043F\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043E \u0431\u044B\u043B\u043E \u0441\u0434\u0435\u043B\u0430\u043D\u043E.";
      return;
    }
    if (!name) {
      $("resolve-error").textContent = "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0424\u0418\u041E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E.";
      return;
    }
    if (resolvingRequestId === null) return;
    const btn = $("resolve-send");
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set("status", "RESOLVED");
      form.set("resolutionNote", note);
      form.set("resolvedByName", name);
      appendPhotos(form, $("resolve-photos"));
      await apiForm("PATCH", `/requests/${resolvingRequestId}/status`, form);
      resolvingRequestId = null;
      await showUkRequests();
    } catch (e) {
      $("resolve-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  function showReopen(requestId, title) {
    reopeningRequestId = requestId;
    $("reopen-request-title").textContent = title;
    $("reopen-reason").value = "";
    $("reopen-photos").value = "";
    $("reopen-photos-preview").innerHTML = "";
    $("reopen-error").textContent = "";
    show("reopen");
  }
  async function sendReopen() {
    $("reopen-error").textContent = "";
    const reason = $("reopen-reason").value.trim();
    const photosInput = $("reopen-photos");
    if (!reason) {
      $("reopen-error").textContent = "\u041E\u043F\u0438\u0448\u0438\u0442\u0435, \u043F\u043E\u0447\u0435\u043C\u0443 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430 \u043D\u0435 \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0430.";
      return;
    }
    if (!photosInput.files || photosInput.files.length === 0) {
      $("reopen-error").textContent = "\u041F\u0440\u0438\u043B\u043E\u0436\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u0444\u043E\u0442\u043E.";
      return;
    }
    if (reopeningRequestId === null) return;
    const btn = $("reopen-send");
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set("reason", reason);
      appendPhotos(form, photosInput);
      await apiForm("POST", `/requests/${reopeningRequestId}/reopen`, form);
      reopeningRequestId = null;
      await showHome();
    } catch (e) {
      $("reopen-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  function renderMembershipItem(m) {
    const el = document.createElement("div");
    el.className = "request";
    el.innerHTML = `<div style="font-weight:600">\u041A\u0432. ${m.apartment} \xB7 ${m.fullName}</div><div class="muted">${m.houseAddress} \xB7 \u0437\u0430\u044F\u0432\u0438\u0442\u0435\u043B\u044C: ${m.applicant.name} \xB7 ${new Date(m.createdAt).toLocaleDateString("ru-RU")}</div>`;
    const row = document.createElement("div");
    row.className = "row";
    row.style.marginTop = "6px";
    const approveBtn = document.createElement("button");
    approveBtn.textContent = "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C";
    approveBtn.onclick = async () => {
      approveBtn.disabled = true;
      try {
        await api("POST", `/membership/requests/${m.id}/approve`);
        loadMembership(true);
      } catch (e) {
        alert(e.message);
        approveBtn.disabled = false;
      }
    };
    const rejectBtn = document.createElement("button");
    rejectBtn.textContent = "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C";
    rejectBtn.className = "secondary";
    rejectBtn.onclick = async () => {
      const reason = prompt("\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u0430\u0437\u0430:");
      if (!reason || !reason.trim()) return;
      rejectBtn.disabled = true;
      try {
        await api("POST", `/membership/requests/${m.id}/reject`, { reason: reason.trim() });
        loadMembership(true);
      } catch (e) {
        alert(e.message);
        rejectBtn.disabled = false;
      }
    };
    row.appendChild(approveBtn);
    row.appendChild(rejectBtn);
    el.appendChild(row);
    return el;
  }
  let membershipReturnTo = "home";
  async function showMembership(returnTo) {
    membershipReturnTo = returnTo;
    show("membership");
    await loadMembership(true);
  }
  async function loadMembership(reset = true) {
    const box = $("membership-list");
    if (reset) {
      membershipOffset = 0;
      box.className = "muted";
      box.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026";
    }
    try {
      const { items, total } = await api("GET", `/membership/requests?limit=${PAGE_SIZE}&offset=${membershipOffset}`);
      if (reset) {
        box.className = "";
        box.innerHTML = total ? "" : '<div class="muted">\u0417\u0430\u044F\u0432\u043E\u043A \u043D\u0430 \u0432\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u043D\u0435\u0442</div>';
      }
      items.forEach((m) => box.appendChild(renderMembershipItem(m)));
      membershipOffset += items.length;
      updatePager("membership-pager-info", "membership-more", membershipOffset, total);
    } catch (e) {
      box.className = "error";
      box.textContent = e.message;
      updatePager("membership-pager-info", "membership-more", 0, 0);
    }
  }
  async function sendRequest() {
    $("req-error").textContent = "";
    $("req-ok").textContent = "";
    const btn = $("req-send");
    btn.disabled = true;
    try {
      const form = new FormData();
      form.set("category", $("category").value);
      form.set("description", $("description").value.trim());
      form.set("priority", $("emergency").checked ? "EMERGENCY" : "NORMAL");
      const photosInput = $("req-photos");
      appendPhotos(form, photosInput);
      const r = await apiForm("POST", "/requests", form);
      $("description").value = "";
      $("emergency").checked = false;
      photosInput.value = "";
      $("req-photos-preview").innerHTML = "";
      $("req-ok").textContent = r.status === "VOTING" ? `\u0417\u0430\u044F\u0432\u043A\u0430 \u2116${r.id} \u0441\u043E\u0437\u0434\u0430\u043D\u0430. \u041D\u0443\u0436\u043D\u043E ${r.votesRequired} ${plural(r.votesRequired, "\u043F\u043E\u0434\u043F\u0438\u0441\u044C", "\u043F\u043E\u0434\u043F\u0438\u0441\u0438", "\u043F\u043E\u0434\u043F\u0438\u0441\u0435\u0439")} \u0441\u043E\u0441\u0435\u0434\u0435\u0439.` : `\u0417\u0430\u044F\u0432\u043A\u0430 \u2116${r.id} \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u0430 \u0432 \u0423\u041A.`;
      loadRequests();
    } catch (e) {
      $("req-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  async function start() {
    if (window.WebApp && typeof window.WebApp.ready === "function") window.WebApp.ready();
    if (!userId && !initData) {
      $("fatal").textContent = "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438\u0437 \u0431\u043E\u0442\u0430 \u0432 MAX. \u0414\u043B\u044F \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043A \u0430\u0434\u0440\u0435\u0441\u0443 ?dev=<MAX id>, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 /app/?dev=900000001";
      show("error");
      return;
    }
    $("search-btn").onclick = searchAddress;
    $("search").addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchAddress();
    });
    $("locate-btn").onclick = () => map.locate({ setView: true, maxZoom: 17 });
    $("apt-back").onclick = showMap;
    $("apt-save").onclick = submitMembership;
    $("change-house").onclick = showMap;
    $("req-send").onclick = sendRequest;
    $("news-send").onclick = sendNews;
    $("req-photos").onchange = () => renderFilePreview($("req-photos"), $("req-photos-preview"));
    $("news-photos").onchange = () => renderFilePreview($("news-photos"), $("news-photos-preview"));
    $("requests-filter-category").onchange = () => loadRequests(true);
    $("requests-filter-status").onchange = () => loadRequests(true);
    $("requests-more").onclick = () => loadRequests(false);
    $("announcements-more").onclick = () => loadAnnouncements(false);
    $("news-more").onclick = () => loadNews(false);
    $("cameras-open").onclick = showCameras;
    $("cameras-back").onclick = showHome;
    $("uk-house").onchange = loadUkHouse;
    $("uk-vote-percent-save").onclick = saveUkVotePercent;
    $("membership-open").onclick = () => showMembership("home");
    $("membership-open-uk").onclick = () => showMembership("uk");
    $("membership-more").onclick = () => loadMembership(false);
    $("membership-back").onclick = () => membershipReturnTo === "uk" ? showUk() : showHome();
    $("uk-requests-open").onclick = showUkRequests;
    $("uk-requests-back").onclick = showUk;
    $("uk-requests-more").onclick = () => loadUkRequests(false);
    $("resolve-back").onclick = showUkRequests;
    $("resolve-send").onclick = sendResolve;
    $("resolve-photos").onchange = () => renderFilePreview($("resolve-photos"), $("resolve-photos-preview"));
    $("reopen-back").onclick = showHome;
    $("reopen-send").onclick = sendReopen;
    $("reopen-photos").onchange = () => renderFilePreview($("reopen-photos"), $("reopen-photos-preview"));
    if (sdkUser && (sdkUser.first_name || sdkUser.last_name)) {
      $("use-profile-name").style.display = "";
      $("use-profile-name").onclick = () => {
        $("full-name").value = [sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(" ").trim();
      };
    }
    try {
      await loadMe();
      if (me.role === "UK_EMPLOYEE") {
        showUk();
        return;
      }
      if (me.onboarded || me.membership) showHome();
      else showMap();
    } catch (e) {
      $("fatal").textContent = e.message;
      show("error");
    }
  }
  start();
})();
