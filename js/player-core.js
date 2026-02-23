// js/player-core.js

const sysAudio = new Audio();
sysAudio.id = "core-audio-player";
sysAudio.preload = "auto";
// 开启跨域支持，防止部分音频源在后台切换时因权限报错
sysAudio.crossOrigin = "anonymous";
document.body.appendChild(sysAudio);

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _onStatusChange: null,
    _syncInterval: null,

    play(url, title, artist, cover) {
        if (!url) return;

        const savedRate = this.audio.playbackRate;
        
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.audio.playbackRate = savedRate;
                    this.setupMediaSession(title, artist, cover);
                    this.startBackgroundKeepAlive(); // 核心：启动保活循环
                })
                .catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
        };

        this.audio.onplay = () => {
            if (this._onStatusChange) this._onStatusChange(true);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
        };

        this.audio.onpause = () => {
            if (this._onStatusChange) this._onStatusChange(false);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
        };
    },

    // 工业级：建立后台保活心跳
    startBackgroundKeepAlive() {
        if (this._syncInterval) clearInterval(this._syncInterval);
        // 每 5 秒向系统汇报一次当前进度，这是防止 Edge 冻结标签页最有效的方法
        this._syncInterval = setInterval(() => {
            if (!this.audio.paused) {
                this.updatePositionState();
                // 额外保活：微调音量引起系统层面的音频活动更新
                const currentVol = this.audio.volume;
                this.audio.volume = currentVol > 0.1 ? currentVol - 0.001 : currentVol + 0.001;
                this.audio.volume = currentVol;
            }
        }, 5000);
    },

    setupMediaSession(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title || "未知剧集",
                artist: artist || "Podcast",
                album: artist || "Podcast",
                artwork: [
                    { src: cover, sizes: '512x512', type: 'image/png' }
                ]
            });

            // 注册所有控制动作，让 Edge 识别为完整的媒体应用
            const actions = {
                play: () => this.audio.play(),
                pause: () => this.audio.pause(),
                seekbackward: (d) => { this.audio.currentTime -= (d.seekOffset || 15); },
                seekforward: (d) => { this.audio.currentTime += (d.seekOffset || 15); },
                seekto: (d) => { this.audio.currentTime = d.seekTime; },
                stop: () => { this.audio.pause(); }
            };

            Object.keys(actions).forEach(action => {
                try {
                    navigator.mediaSession.setActionHandler(action, actions[action]);
                } catch (e) {}
            });
        }
    },

    updatePositionState() {
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            if (this.audio.duration && Number.isFinite(this.audio.duration)) {
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackRate: this.audio.playbackRate,
                    position: this.audio.currentTime
                });
            }
        }
    },

    onStatusChange(cb) { this._onStatusChange = cb; },
    onTimeUpdate(cb) { this._onTimeUpdate = cb; },
    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; } 
        else { this.audio.pause(); return false; }
    },
    seek(pct) {
        if (this.audio.duration && Number.isFinite(this.audio.duration)) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
            this.updatePositionState();
        }
    },
    format(s) {
        if (isNaN(s) || !Number.isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
