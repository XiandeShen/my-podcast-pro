// js/player-core.js

// 核心锁定：必须关联到 index.html 里的真实 DOM
const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _lastSyncTime: 0,

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
                // 播放成功后初始化 MediaSession
                this.syncMediaSession();
            }).catch(e => console.error("Playback Error:", e));
        }

        // 基础监听
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            
            // 内部 UI 更新（每 250ms 左右触发一次，用于网页内的进度条平滑）
            if (this._onTimeUpdate && isFinite(cur)) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 状态变更监听：这是安卓同步的关键
        this.audio.onplay = () => this.syncMediaSession();
        this.audio.onpause = () => this.syncMediaSession();
        this.audio.onratechange = () => this.syncMediaSession();
        // 当拖动进度结束时，必须通知系统新起点，否则系统进度条会弹回旧位置
        this.audio.onseeked = () => this.syncMediaSession();
    },

    /**
     * 核心同步逻辑：仿 Apple Podcasts 机制
     * 不要实时同步，只在“状态转折点”同步起点和速率
     */
    syncMediaSession() {
        if (!('mediaSession' in navigator)) return;

        // 1. 同步播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        // 2. 同步时间坐标轴
        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        if (Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                // 告诉系统：我在这个时间点，以这个倍速运行。系统会自动接管后续的数值累加。
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.min(cur, dur),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                console.warn("PositionState Sync Failed", e);
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

            // 注册系统控制指令
            const actions = {
                play: () => this.audio.play(),
                pause: () => this.audio.pause(),
                seekbackward: () => this.seekOffset(-15),
                seekforward: () => this.seekOffset(15),
                seekto: (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                        // seekto 是用户操作，完成后 onseeked 会触发 syncMediaSession
                    }
                },
                stop: () => {
                    this.audio.pause();
                    this.audio.currentTime = 0;
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
