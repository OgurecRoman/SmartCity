"use strict";
(() => {
  // public/app.ts
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
    function authHeaders() {
      const headers = {};
      if (userId) headers["X-Dev-User-Id"] = userId;
      if (sdkUser) headers["X-Dev-User-Name"] = encodeURIComponent([sdkUser.first_name, sdkUser.last_name].filter(Boolean).join(" "));
      if (initData) headers.Authorization = "MaxInitData " + initData;
      return headers;
    }
    async function api(method, path, body) {
      const res = await fetch("/api" + path, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : void 0
      });
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok) {
        const error = new Error(data && data.error && data.error.message || "\u041E\u0448\u0438\u0431\u043A\u0430 " + res.status);
        error.code = data && data.error && data.error.code;
        throw error;
      }
      return data;
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
    }
    async function loadAnnouncements() {
      const wrap = $("announcements-card");
      const box = $("announcements");
      try {
        const list = await api("GET", "/announcements?limit=20");
        if (!list.length) {
          wrap.style.display = "none";
          return;
        }
        wrap.style.display = "";
        box.className = "";
        box.innerHTML = "";
        list.forEach((a) => {
          const el = document.createElement("div");
          el.className = "request";
          el.innerHTML = `<div style="font-weight:600">${a.title}</div><div>${a.description}</div><div class="muted">${a.author.name} \xB7 ${new Date(a.createdAt).toLocaleDateString("ru-RU")}</div>`;
          box.appendChild(el);
        });
      } catch {
        wrap.style.display = "none";
      }
    }
    async function loadRequests() {
      const box = $("requests");
      const category = $("requests-filter-category").value;
      const status = $("requests-filter-status").value;
      const query = new URLSearchParams({ filter: "all", limit: "50" });
      if (category) query.set("category", category);
      if (status) query.set("status", status);
      try {
        const list = await api("GET", "/requests?" + query.toString());
        box.className = "";
        box.innerHTML = list.length ? "" : '<div class="muted">\u0417\u0430\u044F\u0432\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442</div>';
        list.forEach((r) => {
          const el = document.createElement("div");
          el.className = "request";
          const votes = r.status === "VOTING" ? `<div class="muted">\u041F\u043E\u0434\u043F\u0438\u0441\u0435\u0439: ${r.votesCount} \u0438\u0437 ${r.votesRequired}</div>` : "";
          el.innerHTML = `<div>${r.title}${r.isMine ? ' <span class="muted">(\u043C\u043E\u044F)</span>' : ""}<span class="status">${r.statusLabel}</span></div><div class="muted">${r.author.name}, \u043A\u0432. ${r.author.apartment || "\u2014"}</div>${votes}`;
          if (r.canVote) {
            const b = document.createElement("button");
            b.textContent = "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0430\u0442\u044C";
            b.className = "secondary";
            b.style.marginTop = "6px";
            b.onclick = async () => {
              b.disabled = true;
              try {
                await api("POST", `/requests/${r.id}/vote`);
                loadRequests();
              } catch (e) {
                alert(e.message);
                b.disabled = false;
              }
            };
            el.appendChild(b);
          }
          box.appendChild(el);
        });
      } catch (e) {
        box.className = "error";
        box.textContent = e.message;
      }
    }
    async function loadNews() {
      const box = $("news-list");
      try {
        const list = await api("GET", "/news?limit=20");
        box.className = "";
        box.innerHTML = list.length ? "" : '<div class="muted">\u041D\u043E\u0432\u043E\u0441\u0442\u0435\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442</div>';
        list.forEach((n) => {
          const el = document.createElement("div");
          el.className = "request";
          el.innerHTML = `<div style="font-weight:600">${n.title}${n.isMine ? ' <span class="muted">(\u043C\u043E\u044F)</span>' : ""}</div><div>${n.description}</div><div class="muted">${n.author.name} \xB7 ${new Date(n.createdAt).toLocaleDateString("ru-RU")}</div><div class="muted">\u0421\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F: ${n.contact}</div>`;
          if (n.isMine) {
            const b = document.createElement("button");
            b.textContent = "\u0423\u0434\u0430\u043B\u0438\u0442\u044C";
            b.className = "secondary";
            b.style.marginTop = "6px";
            b.onclick = async () => {
              if (!confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C?")) return;
              try {
                await api("DELETE", `/news/${n.id}`);
                loadNews();
              } catch (e) {
                alert(e.message);
              }
            };
            el.appendChild(b);
          }
          box.appendChild(el);
        });
      } catch (e) {
        box.className = "error";
        box.textContent = e.message;
      }
    }
    async function sendNews() {
      $("news-error").textContent = "";
      $("news-ok").textContent = "";
      const btn = $("news-send");
      btn.disabled = true;
      try {
        await api("POST", "/news", {
          title: $("news-title").value.trim(),
          description: $("news-description").value.trim(),
          contact: $("news-contact").value.trim()
        });
        $("news-title").value = "";
        $("news-description").value = "";
        $("news-contact").value = "";
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
        const houses = await api("GET", "/houses");
        select.innerHTML = '<option value="">\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u043C \u2014</option>' + houses.map((h) => `<option value="${h.id}">${h.address}</option>`).join("");
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
    function loadUkHouse() {
      loadUkResidents();
      loadUkCameras();
    }
    async function sendRequest() {
      $("req-error").textContent = "";
      $("req-ok").textContent = "";
      const btn = $("req-send");
      btn.disabled = true;
      try {
        const r = await api("POST", "/requests", {
          category: $("category").value,
          description: $("description").value.trim(),
          priority: $("emergency").checked ? "EMERGENCY" : "NORMAL"
        });
        $("description").value = "";
        $("emergency").checked = false;
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
      $("requests-filter-category").onchange = loadRequests;
      $("requests-filter-status").onchange = loadRequests;
      $("cameras-open").onclick = showCameras;
      $("cameras-back").onclick = showHome;
      $("uk-house").onchange = loadUkHouse;
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
})();
//# sourceMappingURL=app.js.map
