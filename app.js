const topicLabels = {
  all: '全部主题',
  'us-israel': '美国 / 以色列',
  'israel-iran': '以色列 / 伊朗',
  regional: '地区联动',
};

const contractExample = {
  meta: {
    mode: 'live',
    lastUpdated: '2026-03-18T13:00:00Z',
  },
  articles: [
    {
      id: 101,
      title: 'string',
      summary: 'string',
      source: 'string',
      url: 'https://...',
      publishedAt: '2026-03-18T11:20:00Z',
      topic: 'us-israel',
      locations: [{ name: 'Tehran', lat: 35.6892, lng: 51.389 }],
      keywords: ['Iran', 'missile', 'ceasefire'],
    },
  ],
};

const state = {
  topic: 'all',
  keyword: '',
  hours: 48,
  articles: [],
  meta: null,
};

const newsList = document.getElementById('newsList');
const wordCloud = document.getElementById('wordCloud');
const insightList = document.getElementById('insightList');
const articleCount = document.getElementById('articleCount');
const locationCount = document.getElementById('locationCount');
const keywordCount = document.getElementById('keywordCount');
const updatedAt = document.getElementById('updatedAt');
const mapLegend = document.getElementById('mapLegend');
const statusPill = document.getElementById('statusPill');
const architectureTitle = document.getElementById('architectureTitle');
const architectureSummary = document.getElementById('architectureSummary');
const architectureOptions = document.getElementById('architectureOptions');
const contractPanel = document.getElementById('contractExample');

const map = L.map('map', { zoomControl: false }).setView([32.1, 44.2], 4);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let lastRequestUrl = '/api/dashboard';
contractPanel.textContent = JSON.stringify(contractExample, null, 2);

function setStatus(text, mode = 'online') {
  statusPill.textContent = text;
  statusPill.className = `status-pill ${mode}`;
}

async function fetchDashboardData() {
  setStatus('加载数据中');

  const params = new URLSearchParams({
    topic: state.topic,
    keyword: state.keyword,
    hours: String(state.hours),
  });
  lastRequestUrl = `/api/dashboard?${params.toString()}`;

  const response = await fetch(lastRequestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`数据加载失败：HTTP ${response.status}`);
  }

  return response.json();
}

function applyDataset(dataset) {
  state.articles = Array.isArray(dataset.articles) ? dataset.articles : [];
  state.meta = dataset.meta || {};

  const modeLabel = state.meta.mode === 'live' ? '实时数据' : 'API 演示数据';
  setStatus(`${modeLabel}已加载`);

  renderArchitecture(state.meta.recommendedArchitecture);
  render();
}

function filterArticles() {
  const now = Date.now();
  const maxAge = state.hours * 60 * 60 * 1000;

  return state.articles.filter((article) => {
    const matchesTopic = state.topic === 'all' || article.topic === state.topic;
    const matchesTime = now - new Date(article.publishedAt).getTime() <= maxAge;
    const haystack = [article.title, article.summary, ...(article.keywords || []), ...(article.locations || []).map((loc) => loc.name)]
      .join(' ')
      .toLowerCase();
    const matchesKeyword = !state.keyword || haystack.includes(state.keyword);
    return matchesTopic && matchesTime && matchesKeyword;
  });
}

function buildKeywordStats(articles) {
  const counts = new Map();

  articles.forEach((article) => {
    (article.keywords || []).forEach((keyword) => {
      counts.set(keyword, (counts.get(keyword) || 0) + 1);
    });

    (article.locations || []).forEach((location) => {
      counts.set(location.name, (counts.get(location.name) || 0) + 2);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([label, value]) => ({ label, value }));
}

function buildInsights(articles, keywords) {
  if (!articles.length) {
    return ['当前筛选条件下暂无新闻，请调整主题、关键词或时间范围。'];
  }

  const locationSet = new Set();
  articles.forEach((article) => (article.locations || []).forEach((location) => locationSet.add(location.name)));
  const newest = articles[0];
  const hottest = keywords[0]?.label || '暂无';

  return [
    `当前聚焦主题：${topicLabels[state.topic]}，共筛出 ${articles.length} 条新闻，覆盖 ${locationSet.size} 个主要地点。`,
    `最新一条新闻来自 ${newest.source}，发布时间为 ${formatDate(newest.publishedAt)}。`,
    `高频词第一名为 “${hottest}”，说明其在近期标题和摘要中被反复提及。`,
    '如果后端继续补充事件级标签、情绪判断和去重 ID，这个看板可以直接升级成实时研判台。',
  ];
}

function renderArchitecture(architecture) {
  if (!architecture) {
    architectureTitle.textContent = '推荐接入方式';
    architectureSummary.textContent = '建议采用后端聚合 API，让前端只负责展示。';
    architectureOptions.innerHTML = '';
    return;
  }

  architectureTitle.textContent = architecture.title;
  architectureSummary.textContent = architecture.summary;
  architectureOptions.innerHTML = (architecture.options || [])
    .map((option, index) => {
      const recommended = index === 1;
      return `
        <article class="architecture-option ${recommended ? 'recommended' : ''}">
          ${recommended ? '<span class="option-badge">推荐</span>' : ''}
          <h3>${option.name}</h3>
          <div class="option-columns">
            <div>
              <strong>优点</strong>
              <ul>${(option.pros || []).map((item) => `<li>${item}</li>`).join('')}</ul>
            </div>
            <div>
              <strong>注意点</strong>
              <ul>${(option.cons || []).map((item) => `<li>${item}</li>`).join('')}</ul>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderNews(articles) {
  if (!articles.length) {
    newsList.innerHTML = '<div class="empty-state">没有匹配的新闻条目。</div>';
    return;
  }

  newsList.innerHTML = articles
    .map(
      (article) => `
        <article class="news-item">
          <div class="news-meta">
            <span>${article.source}</span>
            <span>${formatDate(article.publishedAt)}</span>
            <span>${topicLabels[article.topic] || article.topic}</span>
          </div>
          <h3>${article.title}</h3>
          <p>${article.summary}</p>
          <div class="tag-row">
            ${(article.locations || []).map((location) => `<span class="tag">📍 ${location.name}</span>`).join('')}
            ${(article.keywords || []).slice(0, 3).map((keyword) => `<span class="tag"># ${keyword}</span>`).join('')}
          </div>
          ${article.url ? `<a class="news-link" href="${article.url}" target="_blank" rel="noreferrer">查看原文 →</a>` : ''}
        </article>
      `,
    )
    .join('');
}

function renderWordCloud(keywords) {
  if (!keywords.length) {
    wordCloud.innerHTML = '<div class="empty-state">暂无词云数据。</div>';
    return;
  }

  const max = keywords[0].value;
  wordCloud.innerHTML = keywords
    .map((keyword) => {
      const size = 14 + Math.round((keyword.value / max) * 18);
      return `
        <span class="word-chip" style="font-size:${size}px">
          <span>${keyword.label}</span>
          <span class="word-weight">${keyword.value}</span>
        </span>
      `;
    })
    .join('');
}

function renderInsights(insights) {
  insightList.innerHTML = insights.map((item) => `<li>${item}</li>`).join('');
}

function renderMap(articles) {
  markerLayer.clearLayers();
  const bounds = [];
  const locationTotals = new Map();

  articles.forEach((article) => {
    (article.locations || []).forEach((location) => {
      const key = `${location.name}:${location.lat}:${location.lng}`;
      locationTotals.set(key, (locationTotals.get(key) || 0) + 1);

      const marker = L.circleMarker([location.lat, location.lng], {
        radius: 7,
        color: '#9dc1ff',
        weight: 1,
        fillColor: '#4c88ff',
        fillOpacity: 0.85,
      }).bindPopup(`
        <strong>${location.name}</strong><br/>
        关联新闻：${article.title}
      `);

      marker.addTo(markerLayer);
      bounds.push([location.lat, location.lng]);
    });
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([32.1, 44.2], 4);
  }

  const legendItems = [...locationTotals.entries()]
    .map(([key, total]) => {
      const [name] = key.split(':');
      return `${name}（${total}）`;
    })
    .join('、');

  mapLegend.textContent = legendItems
    ? `当前地图已标记：${legendItems}`
    : '当前筛选条件下暂无地点可标记。';
}

function updateMetrics(articles, keywords) {
  const locations = new Set();
  articles.forEach((article) => (article.locations || []).forEach((location) => locations.add(location.name)));
  articleCount.textContent = articles.length;
  locationCount.textContent = locations.size;
  keywordCount.textContent = keywords.length;

  const timestamp = state.meta?.lastUpdated || new Date().toISOString();
  updatedAt.textContent = formatDate(timestamp);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function render() {
  const articles = filterArticles().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const keywords = buildKeywordStats(articles);
  const insights = buildInsights(articles, keywords);

  renderNews(articles);
  renderWordCloud(keywords);
  renderInsights(insights);
  renderMap(articles);
  updateMetrics(articles, keywords);
}

async function initialize() {
  try {
    const dataset = await fetchDashboardData();
    applyDataset(dataset);
  } catch (error) {
    setStatus('数据加载失败', 'offline');
    architectureTitle.textContent = '推荐接入方式';
    architectureSummary.textContent = error.message;
    newsList.innerHTML = `<div class="empty-state">${error.message}</div>`;
    wordCloud.innerHTML = '<div class="empty-state">暂无词云数据。</div>';
    insightList.innerHTML = `<li>请先确认后端 API 可访问：<code>${lastRequestUrl}</code></li>`;
    mapLegend.textContent = '暂无地点数据';
  }
}

document.getElementById('topicFilter').addEventListener('change', async (event) => {
  state.topic = event.target.value;
  await initialize();
});

document.getElementById('keywordFilter').addEventListener('input', async (event) => {
  state.keyword = event.target.value.trim().toLowerCase();
  await initialize();
});

document.getElementById('timeFilter').addEventListener('change', async (event) => {
  state.hours = Number(event.target.value);
  await initialize();
});

document.getElementById('refreshButton').addEventListener('click', initialize);

initialize();
