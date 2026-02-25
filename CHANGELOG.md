# CHANGELOG — Weather Route Planner

## Decisões Arquiteturais e Tradeoffs

---

### v2.0.0 — Migração Streamlit → FastAPI + React (2026-02-20)

#### Motivação
A versão anterior era um monólito Streamlit que misturava lógica de negócio,
chamadas de API e interface gráfica no mesmo arquivo (`climatempo.py`, 1600+ linhas).
A migração para FastAPI + React separa responsabilidades e permite:
- Frontend moderno com UX tipo Maps
- API reutilizável por outros clientes (mobile, CLI)
- Deploy independente de backend e frontend
- Testes mais fáceis e isolados

#### Decisões

| Decisão | Escolha | Alternativas | Motivo |
|---------|---------|--------------|--------|
| **HTTP Framework** | FastAPI | Flask, Django | Async nativo, tipagem Pydantic, OpenAPI automático |
| **HTTP Client** | httpx | aiohttp, requests | Async + sync, HTTP/2, API familiar |
| **Frontend** | React + Vite | Next.js, Svelte | Ecossistema maduro, Vite rápido para dev |
| **Mapa** | MapLibre GL | Google Maps, Leaflet | Open-source, sem token necessário, fork do Mapbox GL JS |
| **Animações** | Framer Motion | react-spring, CSS | API declarativa, performance |
| **CSS** | Tailwind CSS | styled-components, CSS Modules | Utility-first, dark mode fácil |
| **Cache** | Redis + fallback local | Memcached, SQLite | Pub/sub, TTL nativo, padrão de mercado |
| **Background Tasks** | FastAPI BackgroundTasks | Celery, RQ | Zero infra extra para MVP/dev |
| **Routing Engine** | ORS + OSRM fallback | Google Directions | ORS open-source, OSRM gratuito sem chave |
| **Weather API** | Open-Meteo → OpenWeather → Mock | WeatherAPI, Visual Crossing | Open-Meteo gratuito e sem limite |
| **Testes** | pytest + httpx.AsyncClient | unittest | Async suporte, fixtures, plugins |
| **Lint/Format** | ruff + black + isort | flake8, pylint | ruff ultra-rápido, black opinativo |

#### Tradeoffs Aceitos
1. **BackgroundTasks vs Celery**: Sem worker separado, tudo roda na mesma process.
   OK para demo/portfolio. Em produção, migrar para Celery com broker Redis.

2. **Cache local como fallback**: Perde dados ao reiniciar. Aceitável em dev;
   em produção Redis deve estar sempre disponível.

3. **Polling vs WebSocket**: O frontend faz polling (GET /routes/{id}) em vez de
   WebSocket. Mais simples de implementar e debugar; WebSocket seria melhor para UX
   em produção (real-time progress bar).

4. **Nominatim para Geocoding**: Gratuito mas com rate limit (1 req/s).
   Em produção, considerar Pelias, Photon ou cache agressivo.

5. **Mock weather como último recurso**: Se todas as APIs falharem, dados simulados
   são usados. Claramente identificados no payload (`source: "mock"`).

---

### v1.0.0 — Aplicação Streamlit Original
- Monólito com ~1600 linhas em `climatempo.py`
- OpenRouteService para rotas
- Open-Meteo + OpenWeather com fallback
- Mapa pydeck
- ThreadPoolExecutor para paralelismo (sync)
- Cache via `st.cache_data`
