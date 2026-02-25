# 🌦️ Weather Route Planner

> Planejador de rotas rodoviárias com previsão meteorológica ponto-a-ponto.  
> Analisa clima, chuva e trânsito ao longo do trajeto com mapa interativo estilo Google Maps.

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![MapLibre](https://img.shields.io/badge/MapLibre_GL-396CB2?style=flat&logo=mapbox&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

---

## ✨ Funcionalidades

| Funcionalidade | Detalhe |
|---|---|
| 🗺️ **Roteamento inteligente** | OpenRouteService (ORS) com fallback automático para OSRM gratuito |
| 🌧️ **Clima multi-provedor** | Open-Meteo (gratuito) → OpenWeather → Mock com backoff exponencial |
| 📊 **Timeline de precipitação** | Barras por hora ao longo do trajeto com tooltips detalhados |
| 🚦 **Análise de trânsito** | TomTom Traffic API com fallback heurístico por horário/dia |
| 🏆 **Melhor horário de partida** | Predição baseada em histórico, feriados e padrões de trânsito |
| 🎨 **UI moderna** | MapLibre GL (sem token), Framer Motion, Tailwind CSS, modo claro/escuro |
| ⚡ **Cache inteligente** | Redis com fallback local em memória |
| 💰 **Estimativa de custos** | Combustível e pedágios calculados por parâmetros configuráveis |
| 🔄 **Análise assíncrona** | Background tasks com polling; path para migrar a Celery |
| 📖 **API documentada** | Swagger/OpenAPI automático em `/docs` |
| 🐳 **Docker pronto** | `docker-compose up --build` e já funciona |

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│                        Frontend                          │
│            React 18 + Vite 5 + TypeScript                │
│   MapLibre GL · Tailwind CSS · Framer Motion             │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP (Axios)
┌──────────────────────▼───────────────────────────────────┐
│                        Backend                           │
│               FastAPI + httpx (async)                    │
│                                                          │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │  Routing   │ │   Weather    │ │      Traffic       │  │
│  │ORS / OSRM  │ │Open-Meteo   │ │TomTom + Heurística │  │
│  └────────────┘ │OpenWeather  │ └────────────────────┘  │
│                 └──────────────┘                         │
│  ┌────────────┐ ┌──────────────────────────────────────┐ │
│  │ Geocoding  │ │       Holiday / Best Departure       │ │
│  │ Nominatim  │ │  Feriados BR + padrão histórico      │ │
│  └────────────┘ └──────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │      Redis      │
              │  Cache (TTL)    │
              └─────────────────┘
```

---

## 📂 Estrutura do Projeto

```
weather-route-planner/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py          # Endpoints REST
│   │   ├── clients/
│   │   │   ├── __init__.py        # HTTPClient reutilizável
│   │   │   ├── geocoding_client.py# Nominatim (geocoding)
│   │   │   ├── openroute_client.py# ORS + OSRM fallback
│   │   │   ├── traffic_client.py  # TomTom + heurística
│   │   │   └── weather_client.py  # Open-Meteo + OpenWeather
│   │   ├── core/
│   │   │   ├── background.py      # Background tasks (jobs)
│   │   │   ├── cache.py           # Redis + fallback local
│   │   │   └── config.py          # Settings (pydantic-settings)
│   │   ├── schemas/
│   │   │   └── __init__.py        # Pydantic models (request/response)
│   │   ├── services/
│   │   │   ├── holiday_service.py # Feriados BR + melhor horário
│   │   │   └── route_service.py   # Orquestra rota + clima + trânsito
│   │   └── main.py                # Ponto de entrada FastAPI
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_clients.py
│   │   ├── test_integration.py
│   │   └── test_services.py
│   ├── seed_traffic.py            # Script para gerar dados mock
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BestDeparturePanel.tsx  # Painel de melhor horário
│   │   │   ├── MapLegend.tsx           # Legenda do mapa (overlay)
│   │   │   ├── MapView.tsx             # Mapa MapLibre + camadas GeoJSON
│   │   │   ├── RoutePanel.tsx          # Sidebar de busca e resultados
│   │   │   ├── SearchBox.tsx           # Autocomplete via Nominatim
│   │   │   ├── SettingsModal.tsx       # Modal de configurações
│   │   │   ├── TopBar.tsx              # Barra superior
│   │   │   ├── TrafficBadge.tsx        # Badge de nível de trânsito
│   │   │   └── WeatherTimeline.tsx     # Timeline de precipitação
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx        # Dark/light mode
│   │   ├── services/
│   │   │   └── api.ts                  # Cliente Axios + tipos
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── cypress/
│   │   └── e2e/
│   │       └── route_analysis.cy.ts   # Testes E2E (Cypress)
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
│
├── .env.example                   # Template de variáveis de ambiente
├── .gitignore
├── docker-compose.yml
└── CHANGELOG.md                   # Decisões arquiteturais
```

---

## 🚀 Início Rápido

### Opção 1 — Docker Compose (recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/weather-route-planner.git
cd weather-route-planner

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env e preencha as chaves (veja seção abaixo)

# 3. Suba tudo
docker-compose up --build
```

Acesse:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Swagger Docs**: http://localhost:8000/docs

---

### Opção 2 — Desenvolvimento local

#### Backend

```bash
cd backend

# Crie e ative o ambiente virtual
python3 -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# Instale as dependências
pip install -r requirements.txt

# Configure o ambiente
cp ../.env.example .env
# Edite .env conforme necessário

# Inicie o servidor
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse http://localhost:5173 — o Vite já redireciona `/api` para o backend.

---

## 🔑 Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores:

| Variável | Obrigatório | Descrição |
|---|---|---|
| `ORS_API_KEY` | ⭐ Recomendado | Chave OpenRouteService (rotas precisas). Sem chave usa OSRM gratuito. Obtenha em [openrouteservice.org](https://openrouteservice.org/dev/#/signup) |
| `OPENWEATHER_API_KEY` | ❌ Opcional | Fallback de clima. Padrão é Open-Meteo (gratuito, sem chave). Obtenha em [openweathermap.org](https://openweathermap.org/appid) |
| `TOMTOM_API_KEY` | ❌ Opcional | Trânsito em tempo real. Sem chave usa heurística. Obtenha em [developer.tomtom.com](https://developer.tomtom.com) (gratuito, 2500 req/dia) |
| `REDIS_URL` | ❌ Opcional | `redis://localhost:6379/0`. Sem Redis usa cache em memória |
| `CORS_ORIGINS` | ❌ Opcional | Origens permitidas. Padrão: localhost:5173 e 3000 |
| `DEBUG` | ❌ Opcional | `false` em produção |

> **Segurança**: Nunca commite o arquivo `.env` real. Ele já está no `.gitignore`.

---

## 🗺️ Como Usar

1. **Digite a origem** no campo "Origem" (ex: `Curitiba, PR`)
2. **Digite o destino** no campo "Destino" (ex: `São Paulo, SP`)
3. **Selecione a data/hora de partida** (preenchida automaticamente com o horário atual de Brasília)
4. Clique em **"Analisar Rota"**
5. Aguarde a análise (5–15 segundos dependendo da rota)
6. Veja no mapa:
   - 🔵 **Rota traçada** com marcadores coloridos por risco de chuva
   - 📊 **Timeline de precipitação** na base da tela
   - 🚦 **Badge de trânsito** no painel lateral
   - 💰 **Estimativa de custos** (combustível + pedágios estimados)
7. Clique em **"Melhor Horário de Partida"** para ver a análise de 24h

### Interações no mapa

| Ação | Resultado |
|---|---|
| Passar mouse sobre marcador | Popup com clima, chuva, temperatura e horário |
| Clicar em marcador | Popup persistente com todos os dados |
| Botão 🎯 (direita) | Ajusta o zoom para mostrar a rota completa |
| Botão 🗂️ (direita) | Troca o estilo do mapa (Ruas, Escuro, Satélite...) |
| Botão 📋 (direita) | Lista todos os pontos da rota |

---

## 🧪 Testes

### Backend

```bash
cd backend
source .venv/bin/activate

# Todos os testes
pytest tests/ -v

# Com cobertura
pytest tests/ --cov=app --cov-report=html
```

### Frontend (TypeScript)

```bash
cd frontend
npm run build        # Verifica erros de tipo + build de produção
```

### E2E (Cypress) — opcional

```bash
cd frontend
npx cypress open     # Interface gráfica
npx cypress run      # Headless (CI)
```

---

## 📡 API Reference

Documentação interativa disponível em http://localhost:8000/docs após iniciar o backend.

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/routes` | Inicia análise de rota (async) |
| `GET` | `/routes/{id}` | Consulta status/resultado |
| `GET` | `/best-departure` | Melhor horário de partida |
| `GET` | `/traffic-history` | Histórico de trânsito por hora |
| `GET` | `/holidays` | Próximos feriados brasileiros |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Métricas básicas de uso |

### Exemplo: analisar rota

```bash
# 1. Criar análise
curl -X POST http://localhost:8000/routes \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": -25.4284, "lon": -49.2733},
    "destination": {"lat": -23.5505, "lon": -46.6333},
    "departure_time": "2026-02-24T08:00:00",
    "profile": "driving-car"
  }'
# → {"route_id": "abc-123-..."}

# 2. Consultar resultado
curl http://localhost:8000/routes/abc-123-...
# → {"status": "completed", "summary": {...}, "samples": [...]}
```

---

## 🛠️ Stack Técnica

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| Python | 3.12 | Runtime |
| FastAPI | 0.115 | Framework HTTP async |
| Pydantic v2 | 2.9 | Validação e schemas |
| httpx | 0.28 | Cliente HTTP async |
| Redis (aioredis) | 2.x | Cache |
| pydantic-settings | 2.x | Configuração via .env |

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18 | UI |
| TypeScript | 5 | Tipagem |
| Vite | 5 | Build tool |
| MapLibre GL | 4 | Mapa interativo (open-source, **sem token**) |
| Tailwind CSS | 3 | Estilização |
| Framer Motion | 11 | Animações |
| Axios | 1.x | Cliente HTTP |
| react-icons | 5 | Ícones |

### APIs Externas (plano gratuito disponível em todas)
| API | Uso | Chave necessária |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Previsão do tempo | ❌ Não |
| [OSRM](https://project-osrm.org) | Cálculo de rotas (fallback) | ❌ Não |
| [Nominatim/OSM](https://nominatim.org) | Geocoding | ❌ Não |
| [OpenRouteService](https://openrouteservice.org) | Cálculo de rotas | ✅ Gratuita |
| [TomTom Traffic](https://developer.tomtom.com) | Trânsito em tempo real | ✅ Gratuita (2500/dia) |
| [OpenWeather](https://openweathermap.org) | Clima (fallback) | ✅ Gratuita |

---

## 🐳 Deploy com Docker

```bash
# Desenvolvimento
docker-compose up --build

# Apenas backend
docker-compose up --build backend

# Ver logs
docker-compose logs -f backend
```

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit suas mudanças: `git commit -m 'feat: adiciona minha feature'`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

MIT — veja [LICENSE](LICENSE) para detalhes.
