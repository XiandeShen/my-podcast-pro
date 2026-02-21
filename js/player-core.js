// js/player-core.js

// 核心锁定：必须关联到 index.html 里的真实 DOM
const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _shadowTime: 0, // 关键：在 JS 内存中维护一份真实时间副本

    play(url) {
        if (!url) return;
        
        // 1. 如果换歌了，彻底重置
        if (this.audio.src !== url) {
            this._shadowTime = 0;
            this.audio.src = url;
            this.audio.load(); // 强制重新加载，清空旧状态
        }
        
        const currentRate = this.audio.playbackRate;
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.forceSyncState(); // 播放成功瞬间，强推一次状态给系统
            }).catch(e => console.error("Playback Error:", e));
        }

        // 核心纠偏逻辑：每当系统试图归零，立刻从内存副本中恢复
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            // 如果检测到异常归零（系统归 0，但我们记得已经在放了，且不是在手动拖动进度）
            if (cur === 0 && this._shadowTime > 0.5 && !this.audio.paused) {
                this.audio.currentTime = this._shadowTime;
                return;
            }

            // 只有数值合法才更新影子时间
            if (cur > 0 && isFinite(cur)) {
                this._shadowTime = cur;
            }

            if (this._onTimeUpdate) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 监听倍速/暂停等所有可能触发三星重置的事件
        this.audio.onplay = () => this.forceSyncState();
        this.audio.onpause = () => this.forceSyncState();
        this.audio.onratechange = () => {
            // 三星切换倍速时，有时会丢失 currentTime，强制拉回
            if (this._shadowTime > 0) this.audio.currentTime = this._shadowTime;
            this.forceSyncState();
        };
        this.audio.onseeked = () => {
            this._shadowTime = this.audio.currentTime;
            this.forceSyncState();
        };
    },

    // 强制同步函数：三星适配的关键
    forceSyncState() {
        if (!('mediaSession' in navigator)) return;

        // 设置播放状态：务必保持一致
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        // 三星必须确保这三个值都是 finite（有限的）且 dur > 0
        if (Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.min(cur, dur),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                // 捕获系统组件忙碌时的异常
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

            // 注册系统按钮动作
            const actionHandlers = [
                ['play', () => this.audio.play()],
                ['pause', () => this.audio.pause()],
                ['seekbackward', () => this.seekOffset(-15)],
                ['seekforward', () => this.seekOffset(15)],
                ['seekto', (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                        this._shadowTime = details.seekTime;
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
            this._shadowTime = target;
        }
    },

    seekOffset(s) {
        if (!isFinite(this.audio.duration)) return;
        const target = Math.max(0, Math.min(this.audio.currentTime + s, this.audio.duration));
        this.audio.currentTime = target;
        this._shadowTime = target;
    },

    format(s) {
        if (isNaN(s) || !isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
