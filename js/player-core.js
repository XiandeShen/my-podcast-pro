// js/player-core.js

const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _shadowTime: 0, 
    _syncTimer: null,

    play(url) {
        if (!url) return;
        
        // 如果是新链接，彻底重置所有状态
        if (this.audio.src !== url) {
            this.stopSyncLoop();
            this._shadowTime = 0;
            this.audio.src = url;
            this.audio.load();
        }
        
        const currentRate = this.audio.playbackRate;
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.startSyncLoop();
                // 确保在播放开始时推一次状态
                this.forceSyncState();
            }).catch(e => console.error("Playback Error:", e));
        }

        // 元数据加载完成后，必须立即同步一次时长，否则系统会一直显示 00:00
        this.audio.onloadedmetadata = () => {
            this.forceSyncState();
        };

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            // 纠偏逻辑：如果系统在播放中突然汇报 0，强行拉回到我们的内存记录点
            if (cur === 0 && this._shadowTime > 0.5 && !this.audio.paused) {
                this.audio.currentTime = this._shadowTime;
                return;
            }

            if (isFinite(cur) && cur > 0) {
                this._shadowTime = cur;
            }

            if (this._onTimeUpdate) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 状态监听
        this.audio.onplay = () => {
            // 恢复播放时，如果发现进度丢失，强制写回
            if (this._shadowTime > 0 && Math.abs(this.audio.currentTime - this._shadowTime) > 2) {
                this.audio.currentTime = this._shadowTime;
            }
            this.startSyncLoop();
            this.forceSyncState();
        };

        this.audio.onpause = () => {
            this.forceSyncState();
            // 暂停后保持 2 秒同步再停止，确保系统接收到最后的 Position
            setTimeout(() => { if(this.audio.paused) this.stopSyncLoop(); }, 2000);
        };

        this.audio.onseeked = () => {
            if (isFinite(this.audio.currentTime)) {
                this._shadowTime = this.audio.currentTime;
            }
            this.forceSyncState();
        };
    },

    startSyncLoop() {
        if (this._syncTimer) clearInterval(this._syncTimer);
        // 缩短心跳间隔到 800ms，平衡性能与准确度
        this._syncTimer = setInterval(() => {
            this.forceSyncState();
        }, 800);
    },

    stopSyncLoop() {
        if (this._syncTimer) {
            clearInterval(this._syncTimer);
            this._syncTimer = null;
        }
    },

    forceSyncState() {
        if (!('mediaSession' in navigator)) return;

        const dur = this.audio.duration;
        // 关键：如果此时正在加载中，dur 可能是 NaN，此时强制跳过，不给系统发送错误数据
        if (!isFinite(dur) || dur <= 0) return;

        // 设置播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        // 读取当前时间，如果 audio 汇报了 0，我们用 _shadowTime 顶替发送给系统
        let cur = this.audio.currentTime;
        if ((!cur || cur === 0) && this._shadowTime > 0) {
            cur = this._shadowTime;
        }

        try {
            // 核心修复：必须确保 playbackPosition 始终是一个有效的数字
            navigator.mediaSession.setPositionState({
                duration: dur,
                playbackPosition: Math.min(Math.max(0, cur), dur),
                playbackRate: this.audio.playbackRate || 1.0
            });
        } catch (e) {
            // 即使报错也不中断逻辑
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [
                    { src: cover, sizes: '512x512', type: 'image/png' }
                ]
            });

            // 注册远程控制
            const actions = {
                play: () => this.audio.play(),
                pause: () => this.audio.pause(),
                seekbackward: () => this.seekOffset(-15),
                seekforward: () => this.seekOffset(15),
                seekto: (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                        this._shadowTime = details.seekTime;
                        this.forceSyncState();
                    }
                }
            };

            Object.entries(actions).forEach(([action, handler]) => {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (e) {}
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
        if (isFinite(this.audio.duration)) {
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
        if (!isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
