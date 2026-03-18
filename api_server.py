from __future__ import annotations

import json
import mimetypes
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / 'data' / 'sample-data.json'
DEFAULT_TOPIC = 'all'
DEFAULT_HOURS = 48


def load_dataset() -> dict:
    with DATA_FILE.open('r', encoding='utf-8') as file:
        return json.load(file)


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def filter_articles(dataset: dict, query: dict[str, list[str]]) -> list[dict]:
    topic = query.get('topic', [DEFAULT_TOPIC])[0]
    keyword = query.get('keyword', [''])[0].strip().lower()
    hours_raw = query.get('hours', [str(DEFAULT_HOURS)])[0]

    try:
        hours = max(1, int(hours_raw))
    except ValueError:
        hours = DEFAULT_HOURS

    now = datetime.now(timezone.utc)
    max_age_seconds = hours * 3600
    articles = dataset.get('articles', [])
    filtered = []

    for article in articles:
        matches_topic = topic == DEFAULT_TOPIC or article.get('topic') == topic
        published_at = parse_timestamp(article['publishedAt'])
        age_seconds = (now - published_at).total_seconds()
        matches_time = age_seconds <= max_age_seconds
        haystack = ' '.join(
            [
                article.get('title', ''),
                article.get('summary', ''),
                *article.get('keywords', []),
                *(location.get('name', '') for location in article.get('locations', [])),
            ]
        ).lower()
        matches_keyword = not keyword or keyword in haystack

        if matches_topic and matches_time and matches_keyword:
            filtered.append(article)

    filtered.sort(key=lambda item: item.get('publishedAt', ''), reverse=True)
    return filtered


class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == '/api/dashboard':
            self.serve_dashboard_api(parsed.query)
            return

        super().do_GET()

    def serve_dashboard_api(self, query_string: str) -> None:
        dataset = load_dataset()
        query = parse_qs(query_string)
        articles = filter_articles(dataset, query)
        body = {
            'meta': {
                **dataset.get('meta', {}),
                'mode': 'api-demo',
                'lastUpdated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'filters': {
                    'topic': query.get('topic', [DEFAULT_TOPIC])[0],
                    'keyword': query.get('keyword', [''])[0],
                    'hours': query.get('hours', [str(DEFAULT_HOURS)])[0],
                },
            },
            'articles': articles,
        }
        payload = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self) -> None:
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def guess_type(self, path: str) -> str:
        content_type = super().guess_type(path)
        if content_type == 'application/octet-stream':
            return mimetypes.guess_type(path)[0] or content_type
        return content_type


if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', 8000), DashboardHandler)
    print('Serving dashboard on http://0.0.0.0:8000')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
