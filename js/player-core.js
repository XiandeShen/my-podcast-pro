// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.updateSystemSession("playing");
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => {
            this.updateSystemSession();
        };

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 苹果策略：正常播放中，绝不主动调用 setPositionState，让系统自行预测计时
        };

        // 核心修复：监听跳转事件
        // 当跳转发生时，我们需要执行一个“彻底重置”操作
        this.audio.onseeking = () => {
            // 跳转中，先告诉系统我们停了，防止系统计时器继续往前跑导致偏差
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        };

        this.audio.onseeked = () => {
            // 跳转结束，强制重新同步
            // 增加 20ms 延迟是为了确保安卓底层音频驱动已经完成了 buffer 的更新
            setTimeout(() => {
                this.updateSystemSession(this.audio.paused ? "paused" : "playing");
            }, 20);
        };

        this.audio.onplay = () => this.updateSystemSession("playing");
        this.audio.onpause = () => this.updateSystemSession("paused");
    },

    /**
     * 终极同步方案
     * 针对三星系统：每次同步都重新设置完整的状态包，并强制触发系统的 UI 刷新
     */
    updateSystemSession(state = null) {
        if (!('mediaSession' in navigator)) return;

        if (state) {
            navigator.mediaSession.playbackState = state;
        }

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        if (dur && !isNaN(dur) && dur > 0) {
            try {
                // 苹果式精准同步：
                // 1. 确保位置不溢出
                // 2. 必须显式传递 playbackRate，即使它是 1.0
                // 3. 使用 Math.floor 减少浮点数传递，防止系统精度计算导致的归零
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.min(cur, dur - 0.1),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                console.warn("MediaSession update error:", e);
            }
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [
                    { src: cover, sizes: '96x96' },
                    { src: cover, sizes: '128x128' },
                    { src: cover, sizes: '192x192' },
                    { src: cover, sizes: '256x256' },
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 注册系统 Action 控制
            navigator.mediaSession.setActionHandler('play', () => { this.audio.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { this.audio.pause(); });
            
            // 系统组件内的跳转：同样依赖 audio 对象的事件回调进行同步
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
            });
            
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                }
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; }
        else { this.audio.pause(); return false; }
    },

    seek(pct) {
        if (this.audio.duration) {
            // 直接修改 currentTime，触发 onseeking 和 onseeked 逻辑
            this.audio.currentTime = (pct / 100) * this.audio.duration;
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
