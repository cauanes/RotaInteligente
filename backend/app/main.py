"""
Weather Route Planner — FastAPI Application.

Ponto de entrada da aplicação. Configura middleware, lifecycle hooks
e registra os routers.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.cache import cache_service
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle: conecta cache no startup, desconecta no shutdown."""
    print("🚀 Iniciando Weather Route Planner API...")
    await cache_service.connect()
    yield
    print("👋 Encerrando...")
    await cache_service.close()


app = FastAPI(
    title=settings.APP_NAME,
    description="""
## Weather Route Planner API

Analisa rotas rodoviárias e fornece previsão meteorológica ponto-a-ponto
ao longo do trajeto.

### Funcionalidades
- 🗺️ Cálculo de rotas (OpenRouteService / OSRM fallback)
- 🌦️ Previsão meteorológica multi-provedor (Open-Meteo → OpenWeather → Mock)
- 📊 Timeline de chuva ao longo do trajeto
- ⚡ Cache inteligente (Redis + fallback local)
- 🔄 Background tasks para análises pesadas

### Fluxo típico
1. `POST /routes` com origem/destino → recebe `route_id`
2. Poll `GET /routes/{route_id}` até status = `completed`
3. Renderizar rota + timeline no frontend
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — permite frontend acessar a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra todas as rotas
app.include_router(router)


@app.get("/", tags=["root"], include_in_schema=False)
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
