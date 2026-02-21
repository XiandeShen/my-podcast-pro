// js/player-core.js

// 关联真实 DOM
const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _syncTimer: null, // 同步去抖定时器

    /**
     * 核心同步：带缓冲的系统组件更新
     * 模仿 Apple Podcasts 逻辑：状态定型后再同步，防止安卓系统 UI 抖动归零
     */
    syncMediaSession() {
        if (!('mediaSession' in navigator)) return;

        // 清除上一次的同步计划
        if (this._syncTimer) clearTimeout(this._syncTimer);

        // 延迟 150ms 同步，避开状态切换瞬间的数值不稳定期
        this._syncTimer = setTimeout(() => {
            const dur = this.audio.duration;
            const cur = this.audio.currentTime;
            const rate = this.audio.playbackRate;

            // 1. 同步播放/暂停状态
            navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

            // 2. 只有在时长合法时才同步进度坐标
            if (Number.isFinite(dur) && dur > 0) {
                try {
                    // 强制校准当前位置，确保不越界
                    const safePos = Math.max(0, Math.min(cur, dur));
                    
                    navigator.mediaSession.setPositionState({
                        duration: dur,
                        playbackPosition: safePos,
                        // 关键：如果暂停了，给系统速率 0，否则给实际速率
                        playbackRate: this.audio.paused ? 0 : (rate || 1.0)
                    });
                } catch (e) {
                    console.warn("MediaSession PositionState Sync Error:", e);
                }
            }
        }, 150);
    },

    play(url) {
        if (!url) return;
        
        const isChangingSource = this.audio.src !== url;
        if (isChangingSource) {
            this.audio.src = url;
            this.audio.load();
        }
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.syncMediaSession();
            }).catch(e => console.error("Playback Error:", e));
        }

        // 内部进度更新（用于网页内 UI 渲染）
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            
            if (this._onTimeUpdate && isFinite(cur)) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 状态转折点：统一触发带去抖的同步
        this.audio.onplay = () => this.syncMediaSession();
        this.audio.onpause = () => this.syncMediaSession();
        this.audio.onratechange = () => this.syncMediaSession();
        this.audio.onseeked = () => this.syncMediaSession();
        this.audio.onloadedmetadata = () => this.syncMediaSession();
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

            // 注册系统指令
            const actions = {
                play: () => this.audio.play(),
                pause: () => this.audio.pause(),
                seekbackward: () => this.seekOffset(-15),
                seekforward: () => this.seekOffset(15),
                seekto: (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                    }
                }
            };

            Object.entries(actions).forEach(([action, handler]) => {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (e) {
                    console.warn(`Action [${action}] not supported`);
                }
            });
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
