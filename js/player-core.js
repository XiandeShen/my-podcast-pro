// js/player-core.js

// 核心锁定：必须关联到 index.html 里的真实 DOM
const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _syncTimer: null, // 替代旧的影子时间，用作系统同步缓冲防抖

    play(url) {
        if (!url) return;
        
        // 1. 如果换歌了，彻底重置
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load(); // 强制重新加载，清空旧状态
        }
        
        const currentRate = this.audio.playbackRate;
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.forceSyncState(); // 播放成功瞬间，推一次状态
            }).catch(e => console.error("Playback Error:", e));
        }

        // 仅用于网页内 UI 的更新，绝不在这里高频触碰系统组件
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            if (this._onTimeUpdate && isFinite(cur) && isFinite(dur) && dur > 0) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 监听所有可能触发状态改变的事件，全部交由 forceSyncState 统一处理
        this.audio.onplay = () => this.forceSyncState();
        this.audio.onpause = () => this.forceSyncState();
        this.audio.onratechange = () => this.forceSyncState();
        this.audio.onseeked = () => this.forceSyncState();
        this.audio.onloadedmetadata = () => this.forceSyncState();
    },

    // 强制同步函数：安卓系统防崩溃的终极版本
    forceSyncState() {
        if (!('mediaSession' in navigator)) return;

        // 清理上一个缓冲，防抖动
        if (this._syncTimer) clearTimeout(this._syncTimer);

        this._syncTimer = setTimeout(() => {
            const dur = this.audio.duration;
            const cur = this.audio.currentTime;
            let rate = this.audio.playbackRate;

            // 致命修复点：绝不能把 0 传给安卓系统！
            // 安卓靠 playbackState 停表，如果 rate <= 0 系统会抛错导致进度条清零
            if (typeof rate !== 'number' || rate <= 0 || isNaN(rate)) {
                rate = 1.0; 
            }

            // 务必保持状态文字一致
            navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

            // 必须确保这三个值都是有限的（finite），且 dur > 0
            if (Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: dur,
                        playbackPosition: cur,
                        playbackRate: rate
                    });
                } catch (e) {
                    console.warn("MediaSession API Error:", e);
                }
            }
        }, 200); // 200ms 防抖，躲过安卓底层线程不稳定的瞬间
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

            // 注册系统按钮动作
            const actionHandlers = [
                ['play', () => this.audio.play()],
                ['pause', () => this.audio.pause()],
                ['seekbackward', () => this.seekOffset(-15)],
                ['seekforward', () => this.seekOffset(15)],
                ['seekto', (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                        // 注意：这里不需要调 forceSyncState，因为 onseeked 会自动接管
                    }
                }]
            ];

            for (const [action, handler] of actionHandlers) {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (e) {
                    console.warn(`MediaSession action [${action}] not supported`);
                }
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
        }
    },

    seekOffset(s) {
        if (!isFinite(this.audio.duration)) return;
        const target = Math.max(0, Math.min(this.audio.currentTime + s, this.audio.duration));
        this.audio.currentTime = target;
    },

    format(s) {
        if (isNaN(s) || !isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
