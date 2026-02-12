const { Pool } = require('pg');
const WebSocket = require('ws');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL
});

const PIESOCKET_API_KEY = process.env.PIESOCKET_API_KEY;
const PIESOCKET_CLUSTER_ID = process.env.PIESOCKET_CLUSTER_ID;

console.log('🚀 PieSocket Bridge Server Starting (WebSocket Mode)...');
console.log('🔑 PieSocket Cluster:', PIESOCKET_CLUSTER_ID);

// WebSocket ile Mesaj Gönder (HTTP API 405 veriyorsa bu çalışır!)
function sendToPieSocket(roomId, event, data) {
    // 1. WebSocket URL'i oluştur (Flutter tarafı 'room-' prefix'i kullanıyor!)
    const wsUrl = `wss://${PIESOCKET_CLUSTER_ID}.piesocket.com/v3/room-${roomId}?api_key=${PIESOCKET_API_KEY}&notify_self=0`;

    // 2. Bağlan
    const ws = new WebSocket(wsUrl);

    ws.on('open', function open() {
        console.log(`🔌 Connected to [${roomId}]`);

        // 3. Mesajı hazırla (client- prefix'i önemli olabilir)
        const finalEvent = event.startsWith('client-') ? event : `client-${event}`;

        const payload = JSON.stringify({
            event: finalEvent,
            data: data
        });

        // 4. Gönder
        ws.send(payload);
        console.log(`✅ Sent to [${roomId}]: ${finalEvent}`);

        // 5. Biraz bekleyip kapat (mesajın gitmesi için)
        setTimeout(() => {
            ws.close();
            // console.log(`🔌 Disconnected from [${roomId}]`);
        }, 1000); // 1 saniye bekle
    });

    ws.on('error', function error(err) {
        console.error(`❌ WS Error [${roomId}]:`, err.message);
    });
}

// PostgreSQL LISTEN
pool.connect((err, client) => {
    if (err) {
        console.error('❌ PostgreSQL connection error:', err);
        process.exit(1);
    }

    console.log('✅ Connected to PostgreSQL');

    const channels = [
        'rooms',
        'room_participants',
        'post_likes',
        'post_comments',
        'user_levels',
        'user_coins', // En önemlisi bu!
        'profiles',
        'notifications', // YENİ: Bildirimler
        'announcements',  // YENİ: Duyurular
        'new_chat_message', // YENİ: Özel Mesajlar (DM)
        'clans',
        'clan_members',
        'clan_join_requests'
    ];

    channels.forEach(channel => {
        client.query(`LISTEN ${channel}`);
        console.log(`🎧 Listening to ${channel}`);
    });

    client.on('notification', (msg) => {
        try {
            const rawData = JSON.parse(msg.payload);
            console.log(`📢 ${msg.channel}:`, JSON.stringify(rawData).substring(0, 100));

            // Support both V1 (row) and V2 ({event_type, data}) formats
            const data = rawData.data || rawData;

            switch (msg.channel) {
                case 'clans':
                    // Clan update or create
                    sendToPieSocket('clan-global', rawData.type === 'INSERT' ? 'clan-created' : 'clan-info-updated', {
                        clanId: data.id,
                        data: data
                    });
                    if (data.id) {
                        sendToPieSocket(`clan-${data.id}`, 'clan-updated', { data });
                    }
                    break;

                case 'clan_members':
                    // Member added/removed/updated
                    if (data.clan_id) {
                        let event = 'clan-member-updated'; // Default
                        if (rawData.type === 'INSERT') event = 'clan-member-added';
                        else if (rawData.type === 'DELETE') event = 'clan-member-removed';
                        else if (rawData.type === 'UPDATE') event = 'clan-role-changed'; // Usually role update

                        sendToPieSocket(`clan-${data.clan_id}`, event, {
                            data: data,
                            userId: data.user_id,
                            newRole: data.role
                        });
                    }
                    break;

                case 'clan_join_requests':
                    if (data.clan_id) {
                        let event = 'clan-join-request-updated';
                        if (rawData.type === 'INSERT') event = 'clan-join-request';

                        sendToPieSocket(`clan-${data.clan_id}`, event, {
                            data: data
                        });
                    }
                    break;

                case 'rooms':
                    // Broadcast to global rooms channel
                    sendToPieSocket('global-rooms', 'room-updated', rawData);
                    break;

                case 'room_participants':
                    // Broadcast to global rooms channel
                    sendToPieSocket('global-rooms', 'participant-updated', rawData);
                    break;

                case 'post_likes':
                    // Broadcast to global posts channel
                    sendToPieSocket('global-posts', 'post-like-updated', rawData);
                    break;

                case 'post_comments':
                    // Broadcast to global posts channel
                    sendToPieSocket('global-posts', 'post-comment-updated', rawData);
                    break;

                case 'user_levels':
                    // Send to user-specific channel
                    const levelUserId = data.user_id;
                    if (levelUserId) {
                        sendToPieSocket(`user-${levelUserId}`, 'level-updated', rawData);
                    }
                    break;

                case 'user_coins':
                    // Send to user-specific channel
                    const coinUserId = data.user_id;
                    if (coinUserId) {
                        sendToPieSocket(`user-${coinUserId}`, 'coin-updated', rawData);
                    }
                    break;

                case 'profiles':
                    // Send to user-specific channel
                    const profileUserId = data.id || data.user_id;
                    if (profileUserId) {
                        sendToPieSocket(`user-${profileUserId}`, 'profile-updated', rawData);

                        // Also broadcast to global rooms (public avatar update)
                        sendToPieSocket('global-rooms', 'profile_update', {
                            user_id: profileUserId,
                            avatar_url: data.avatar_url,
                            full_name: data.full_name,
                            bio: data.bio
                        });
                    }

                    // NEW: Broadcast to global-rooms if this is a NEW USER (INSERT)
                    if (rawData.type === 'INSERT') {
                        console.log('👶 NEW USER REGISTRATION DETECTED:', profileUserId);
                        sendToPieSocket('global-rooms', 'new-user-joined', data);
                    }
                    break;

                case 'notifications':
                    // Send to user-specific channel (Personal Notification)
                    const notifUserId = data.user_id;
                    if (notifUserId) {
                        sendToPieSocket(`user-${notifUserId}`, 'new_notification', data);
                    }
                    break;

                case 'announcements':
                    // Broadcast to GLOBAL ANNOUNCEMENTS channel
                    sendToPieSocket('global-announcements', 'new_announcement', data);
                    break;

                case 'new_chat_message':
                    // ✨ DM Mesajı: Alıcıya gönder (Sohbet ekranında görünsün)
                    // Kanal: user-{receiver_id}
                    if (data.receiver_id) {
                        sendToPieSocket(`user-${data.receiver_id}`, 'chat_message', data);
                    }
                    // Gönderene de yolla (Senkronizasyon/Garantili Teslimat İçin)
                    if (data.sender_id) {
                        sendToPieSocket(`user-${data.sender_id}`, 'chat_message_sent', data);
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ Notification parse error:', error);
        }
    });

    client.on('error', (err) => {
        console.error('❌ PostgreSQL client error:', err);
    });
});

// Health check endpoint + API (Express ile)
const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// CORS for Flutter
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health Check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Apex Realtime Bridge'
    });
});

// =====================================================
// CLAN EVENT HANDLER
// =====================================================
app.post('/api/clan-event', (req, res) => {
    try {
        const { eventType, clanId, data } = req.body;

        if (!eventType || !data) {
            return res.status(400).json({
                success: false,
                error: 'Missing eventType or data'
            });
        }

        console.log(`🏰 Clan Event: ${eventType} for clan: ${clanId}`);

        // Global clan channel'a gönder (tüm kullanıcılar için)
        sendToPieSocket('clan-global', eventType, {
            type: eventType,
            clanId,
            data,
            timestamp: Date.now()
        });

        // Spesifik clan channel'a gönder (o aile üyeleri için)
        if (clanId) {
            sendToPieSocket(`clan-${clanId}`, eventType, {
                type: eventType,
                data,
                timestamp: Date.now()
            });
        }

        res.json({ success: true, eventType, clanId });
    } catch (error) {
        console.error('❌ Clan event error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// START SERVER
// =====================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🏥 HTTP Server running on port ${PORT}`);
    console.log(`📡 Clan events: POST /api/clan-event`);
});
