const form = document.getElementById('form');
const raw = document.getElementById('raw');
const nice = document.getElementById('nice');

const proxyForm = document.getElementById('proxy-form');
const proxyRowsContainer = document.getElementById('proxy-rows');
const addProxyRowButton = document.getElementById('add-proxy-row');
const maskProxyCredentialsInput = document.getElementById('mask-proxy-credentials');
const proxySummary = document.getElementById('proxy-summary');
const proxyStatus = document.getElementById('proxy-status');
const envProxyHint = document.getElementById('env-proxy-hint');

const proxyState = {
  proxies: [],
  activeProxies: [],
  envProxy: '',
  envMasked: '',
  controlsEnabled: true,
  usingProxy: false,
};

function maskProxy(url) {
  if (!url) return '';
  const candidate = url.includes('://') ? url : `http://${url}`;
  try {
    const parsed = new URL(candidate);
    const auth = parsed.username || parsed.password ? '***@' : '';
    const hostPort = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return `${parsed.protocol}//${auth}${hostPort}`;
  } catch {
    return url;
  }
}

function renderProxySummary() {
  if (!proxySummary) return;
  if (!proxyState.controlsEnabled) {
    proxySummary.textContent = 'Proxy controls unavailable in this build.';
    return;
  }
  const mask = maskProxyCredentialsInput ? maskProxyCredentialsInput.checked : true;
  const parts = [];
  const configured = proxyState.proxies
    .filter((entry) => (entry.country || '').trim() && (entry.proxyUrl || '').trim())
    .map((entry) => ({
      country: entry.country.trim().toUpperCase(),
      proxyUrl: entry.proxyUrl.trim(),
      allowInvalidCerts: !!entry.allowInvalidCerts,
    }));

  if (configured.length === 0) {
    parts.push('<div><strong>Direct connection:</strong> No country-specific proxies configured.</div>');
  } else {
    configured.forEach((entry) => {
      const display = mask ? maskProxy(entry.proxyUrl) : entry.proxyUrl;
      let line = `<div><strong>${entry.country}</strong> → ${display}`;
      if (entry.allowInvalidCerts) line += ' <span class="warning">(invalid certificates allowed)</span>';
      line += '</div>';
      parts.push(line);
    });
    parts.push('<div>Other countries: direct (bypass proxy)</div>');
  }

  if (proxyState.activeProxies && proxyState.activeProxies.length) {
    proxyState.activeProxies.forEach((entry) => {
      const display = mask ? maskProxy(entry.displayUrl || entry.proxyUrl) : entry.proxyUrl || entry.displayUrl;
      let line = `<div>Runtime: <strong>${entry.country}</strong> → ${display || '(unknown)'}`;
      if (entry.allowInvalidCerts) line += ' <span class="warning">(invalid certificates allowed)</span>';
      line += '</div>';
      parts.push(line);
    });
  } else {
    parts.push('<div>Runtime: direct (no active proxy routes)</div>');
  }

  if (proxyState.envMasked) {
    parts.push(`<div>Environment proxy: ${proxyState.envMasked}</div>`);
  }
  proxySummary.innerHTML = parts.join('');
}

function renderProxyRows() {
  if (!proxyRowsContainer) return;
  if (!Array.isArray(proxyState.proxies)) proxyState.proxies = [];
  if (proxyState.proxies.length === 0) {
    proxyState.proxies.push({ country: '', proxyUrl: '', allowInvalidCerts: false });
  }
  proxyRowsContainer.innerHTML = '';
  proxyState.proxies.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'proxy-row';

    const countryInput = document.createElement('input');
    countryInput.type = 'text';
    countryInput.placeholder = 'US';
    countryInput.value = entry.country || '';
    countryInput.className = 'proxy-row-country';
    countryInput.addEventListener('input', () => {
      proxyState.proxies[index].country = countryInput.value;
      renderProxySummary();
    });

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://user:pass@proxy.example:8443';
    urlInput.value = entry.proxyUrl || '';
    urlInput.className = 'proxy-row-url';
    urlInput.addEventListener('input', () => {
      proxyState.proxies[index].proxyUrl = urlInput.value;
      renderProxySummary();
    });

    const actions = document.createElement('div');
    actions.className = 'proxy-row-actions';

    const allowLabel = document.createElement('label');
    allowLabel.className = 'proxy-row-allow';
    const allowCheckbox = document.createElement('input');
    allowCheckbox.type = 'checkbox';
    allowCheckbox.checked = !!entry.allowInvalidCerts;
    allowCheckbox.addEventListener('change', () => {
      proxyState.proxies[index].allowInvalidCerts = allowCheckbox.checked;
      renderProxySummary();
    });
    const allowText = document.createElement('span');
    allowText.textContent = 'Allow invalid certs';
    allowLabel.appendChild(allowCheckbox);
    allowLabel.appendChild(allowText);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'proxy-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      proxyState.proxies.splice(index, 1);
      renderProxyRows();
      renderProxySummary();
    });

    actions.appendChild(allowLabel);
    actions.appendChild(removeBtn);

    row.appendChild(countryInput);
    row.appendChild(urlInput);
    row.appendChild(actions);

    proxyRowsContainer.appendChild(row);
  });
}

function applyProxyConfig(data) {
  if (!proxyForm) return;
  proxyState.controlsEnabled = data.controlsEnabled !== false;
  proxyState.envProxy = data.envProxy || '';
  proxyState.envMasked = data.envMasked || (proxyState.envProxy ? maskProxy(proxyState.envProxy) : '');
  proxyState.usingProxy = !!data.usingProxy;
  proxyState.proxies = Array.isArray(data.proxies)
    ? data.proxies.map((entry) => ({
        country: entry.country || '',
        proxyUrl: entry.proxyUrl || '',
        allowInvalidCerts: !!entry.allowInvalidCerts,
      }))
    : [];
  proxyState.activeProxies = Array.isArray(data.activeProxies)
    ? data.activeProxies.map((entry) => ({
        country: entry.country || '',
        proxyUrl: entry.proxyUrl || '',
        displayUrl: entry.displayUrl || entry.proxyUrl || '',
        allowInvalidCerts: !!entry.allowInvalidCerts,
      }))
    : [];

  if (!proxyState.controlsEnabled) {
    proxyStatus.textContent = 'Proxy helpers unavailable in this build.';
    proxyStatus.classList.add('error');
    proxyForm.querySelectorAll('input, button').forEach((el) => (el.disabled = true));
  } else {
    proxyForm.querySelectorAll('input, button').forEach((el) => (el.disabled = false));
    proxyStatus.textContent = '';
    proxyStatus.classList.remove('error');
  }

  envProxyHint.textContent = proxyState.envMasked ? `Environment proxy detected: ${proxyState.envMasked}` : 'Environment proxy not set.';

  renderProxyRows();
  renderProxySummary();
}

async function loadProxyConfig() {
  if (!proxyForm) return;
  try {
    const res = await fetch('/api/system/proxy', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    applyProxyConfig(data);
  } catch (err) {
    proxyStatus.textContent = err?.message || 'Failed to load proxy config';
    proxyStatus.classList.add('error');
    if (proxySummary) proxySummary.textContent = 'Unable to load proxy configuration.';
  }
}

async function submitProxyConfig(e) {
  e.preventDefault();
  if (!proxyState.controlsEnabled) return;
  proxyStatus.textContent = 'Saving...';
  proxyStatus.classList.remove('error');
  const payload = {
    proxies: proxyState.proxies.map((entry) => ({
      country: (entry.country || '').trim(),
      proxyUrl: (entry.proxyUrl || '').trim(),
      allowInvalidCerts: !!entry.allowInvalidCerts,
    })),
  };
  try {
    const res = await fetch('/api/system/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    proxyStatus.textContent = 'Proxies updated.';
    applyProxyConfig(data);
  } catch (err) {
    proxyStatus.textContent = err?.message || 'Failed to update proxies';
    proxyStatus.classList.add('error');
  }
}

document.getElementById('reset').addEventListener('click', () => {
  form.reset();
  raw.textContent = '';
  nice.innerHTML = '';
});

if (proxyForm) {
  proxyForm.addEventListener('submit', submitProxyConfig);
  if (addProxyRowButton) {
    addProxyRowButton.addEventListener('click', () => {
      proxyState.proxies.push({ country: '', proxyUrl: '', allowInvalidCerts: false });
      renderProxyRows();
      renderProxySummary();
    });
  }
  if (maskProxyCredentialsInput) maskProxyCredentialsInput.addEventListener('change', renderProxySummary);
  renderProxyRows();
  renderProxySummary();
  loadProxyConfig();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const method = fd.get('method');
  const params = new URLSearchParams();
  for (const [k, v] of fd.entries()) {
    if (!v || k === 'method') continue;
    params.set(k, v);
  }
  const url = `/api/${method}?${params.toString()}`;
  raw.textContent = 'Loading...';
  nice.innerHTML = '';
  try {
    const res = await fetch(url);
    const data = await res.json();
    raw.textContent = JSON.stringify(data, null, 2);
    renderNice(method, data);
  } catch (err) {
    raw.textContent = `Error: ${err?.message || err}`;
  }
});

function renderNice(method, data) {
  if (Array.isArray(data)) {
    if (data.length && data[0] && (data[0].title || data[0].appId)) {
      return renderAppCards(data);
    }
    if (data.length && data[0] && data[0].term) {
      const ul = document.createElement('ul');
      data.forEach((x) => { const li = document.createElement('li'); li.textContent = x.term; ul.appendChild(li); });
      nice.appendChild(ul);
      return;
    }
  }
  if (data && data.title && (data.appId || data.id)) {
    return renderAppCards([data]);
  }
  // fallback
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data, null, 2);
  nice.appendChild(pre);
}

function renderAppCards(apps) {
  const wrap = document.createElement('div');
  wrap.className = 'cards';
  apps.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = a.icon || '';
    img.alt = a.title || a.appId || 'icon';
    const body = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = a.title || a.appId || 'Untitled';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = [
      a.developer ? `<span class="badge">${a.developer}</span>` : '',
      a.primaryGenre ? `<span class="badge">${a.primaryGenre}</span>` : '',
      a.price !== undefined ? `<span class="badge">${a.free ? 'Free' : a.price + ' ' + (a.currency || '')}</span>` : '',
    ].filter(Boolean).join(' ');
    const link = document.createElement('a');
    link.href = a.url || '#';
    link.textContent = 'View in Store';
    link.target = '_blank';
    link.rel = 'noreferrer';
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(link);
    card.appendChild(img);
    card.appendChild(body);
    wrap.appendChild(card);
  });
  nice.appendChild(wrap);
}
