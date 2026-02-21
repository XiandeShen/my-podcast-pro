// js/player-core.js

const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _shadowTime: 0, 
    _syncTimer: null, // 心跳定时器

    play(url) {
        if (!url) return;
        
        if (this.audio.src !== url) {
            this._shadowTime = 0;
            this.audio.src = url;
            this.audio.load();
        }
        
        const currentRate = this.audio.playbackRate;
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.startSyncLoop(); // 开启强同步
                this.forceSyncState();
            }).catch(e => console.error("Playback Error:", e));
        }

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            // 纠偏逻辑：如果系统异常归零
            if (cur === 0 && this._shadowTime > 0.5 && !this.audio.paused) {
                this.audio.currentTime = this._shadowTime;
                return;
            }

            if (cur > 0 && isFinite(cur)) {
                this._shadowTime = cur;
            }

            if (this._onTimeUpdate) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        this.audio.onplay = () => {
            if (this._shadowTime > 0 && Math.abs(this.audio.currentTime - this._shadowTime) > 1) {
                this.audio.currentTime = this._shadowTime;
            }
            this.startSyncLoop();
            this.forceSyncState();
        };

        this.audio.onpause = () => {
            this.forceSyncState();
            // 暂停后不立即停止心跳，确保最后一刻状态被系统接收
            setTimeout(() => this.stopSyncLoop(), 1000);
        };

        this.audio.onseeked = () => {
            this._shadowTime = this.audio.currentTime;
            this.forceSyncState();
        };
    },

    // 开启高频同步心跳 (每 500ms 强制向系统对齐一次进度)
    startSyncLoop() {
        if (this._syncTimer) clearInterval(this._syncTimer);
        this._syncTimer = setInterval(() => {
            this.forceSyncState();
        }, 500);
    },

    stopSyncLoop() {
        if (this._syncTimer) {
            clearInterval(this._syncTimer);
            this._syncTimer = null;
        }
    },

    forceSyncState() {
        if (!('mediaSession' in navigator)) return;

        // 核心修正：在安卓通知栏，必须显式赋值这个状态，否则进度条会重置
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        // 关键：如果 audio 本身汇报了 0 且我们有缓存，用缓存顶替
        let cur = this.audio.currentTime;
        if ((cur === 0 || isNaN(cur)) && this._shadowTime > 0) {
            cur = this._shadowTime;
        }

        if (Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                // 强制对齐位置状态
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.max(0, Math.min(cur, dur)),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                // 部分版本不支持 setPositionState 会报错，静默处理
            }
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [
                    { src: cover, sizes: '96x96', type: 'image/png' },
                    { src: cover, sizes: '128x128', type: 'image/png' },
                    { src: cover, sizes: '256x256', type: 'image/png' },
                    { src: cover, sizes: '512x512', type: 'image/png' }
                ]
            });

            const actionHandlers = [
                ['play', () => this.audio.play()],
                ['pause', () => this.audio.pause()],
                ['seekbackward', () => this.seekOffset(-15)],
                ['seekforward', () => this.seekOffset(15)],
                ['seekto', (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                        this._shadowTime = details.seekTime;
                        this.forceSyncState();
                    }
                }]
            ];

            for (const [action, handler] of actionHandlers) {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (e) {}
            }
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { 
            this.audio.play(); 
            return true; 
        } else { 
            this.audio.pause(); 
            return false; 
        }
    },

    seek(pct) {
        if (this.audio.duration && isFinite(this.audio.duration)) {
            const target = (pct / 100) * this.audio.duration;
            this.audio.currentTime = target;
            this._shadowTime = target;
            this.forceSyncState();
        }
    },

    seekOffset(s) {
        if (!isFinite(this.audio.duration)) return;
        const target = Math.max(0, Math.min(this.audio.currentTime + s, this.audio.duration));
        this.audio.currentTime = target;
        this._shadowTime = target;
        this.forceSyncState();
    },

    format(s) {
        if (isNaN(s) || !isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
