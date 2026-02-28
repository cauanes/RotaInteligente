# Rota Inteligente — Mobile App

Aplicativo mobile React Native (Expo) para o **Rota Inteligente**.

## Pré-requisitos

- Node.js ≥ 18
- Expo CLI: `npm install -g expo-cli`
- Backend rodando em `http://<LAN_IP>:8000`

## Setup

```bash
cd mobile
npm install

# Edite src/services/api.ts e coloque o IP local do backend:
# const API_URL = 'http://192.168.x.x:8000'

npx expo start
```

## Funcionalidades

- 🗺️ Mapa nativo com `react-native-maps`
- 🎨 Rota colorida por congestionamento (verde/amarelo/vermelho)
- 🌧️ Amostras meteorológicas ao longo do trajeto
- 💰 Pontos de pedágio
- ⚠️ Acidentes em tempo real
- 🚦 Semáforos com ciclo simulado
- 📍 Navegação GPS com `expo-location`
- 🌫️ Alertas de neblina

## Estrutura

```
mobile/
├── App.tsx                    # Componente raiz
├── app.json                   # Config Expo
├── package.json
├── tsconfig.json
├── babel.config.js
├── tailwind.config.js
└── src/
    ├── services/
    │   └── api.ts             # Cliente API (mesmo contrato do backend)
    └── components/
        ├── SearchPanel.tsx     # Busca de origem/destino
        ├── RouteResults.tsx    # Cards de resultado
        └── RouteTimeline.tsx   # Timeline horizontal de clima
```

## Testando no dispositivo

1. Instale o **Expo Go** no celular (App Store / Play Store)
2. Execute `npx expo start`
3. Escaneie o QR code com Expo Go
4. Certifique-se de que celular e PC estão na mesma rede Wi-Fi
