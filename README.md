# APEX PieSocket Bridge

PostgreSQL trigger'larını dinler ve PieSocket'e yayınlar.

## 🚀 Kurulum

```bash
npm install
```

## ⚙️ Yapılandırma

`.env.example` dosyasını `.env` olarak kopyalayın:

```bash
cp .env.example .env
```

### PieSocket Credentials

`lib/config/room_config.dart` dosyasından PieSocket bilgilerini kopyalayın:

```dart
// room_config.dart
static const String pieSocketApiKey = 'YOUR_KEY';
static const String pieSocketClusterId = 'YOUR_CLUSTER';
static const String pieSocketSecret = 'YOUR_SECRET';
```

Bu değerleri `.env` dosyasına yapıştırın.

## 🏃 Çalıştırma

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## 📊 Health Check

```
http://localhost:3002/health
```

## 📡 PieSocket Channels

### Global Channels
- `global-rooms`: Oda listesi güncellemeleri
- `global-posts`: Post beğeni/yorum

### User Channels
- `user-{userId}`: Kullanıcıya özel eventler
  - Level UP
  - Coin değişimi
  - Profil güncellemeleri

## 🔥 Events

**Rooms:**
- `room-updated`: Oda bilgisi değişti
- `participant-updated`: Katılımcı girdi/çıktı

**Posts:**
- `post-like-updated`: Beğeni eklendi/silindi
- `post-comment-updated`: Yorum eklendi

**User:**
- `level-updated`: Level değişti
- `coin-updated`: Coin değişti
- `profile-updated`: Profil değişti
