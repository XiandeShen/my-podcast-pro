// js/player-core.js

const sysAudio = new Audio();
sysAudio.id = "core-audio-player";
sysAudio.style.display = "none";
sysAudio.preload = "auto";
document.body.appendChild(sysAudio);

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _onStatusChange: null,

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
                    // 注入元数据并建立后台连接
                    this.updateMetadataOnly(title, artist, cover);
                })
                .catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 持续向系统更新播放位置，防止后台进程被杀
            this.updatePositionState();
        };

        this.audio.onplay = () => {
            if (this._onStatusChange) this._onStatusChange(true);
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
        };
        this.audio.onpause = () => {
            if (this._onStatusChange) this._onStatusChange(false);
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        };

        this.audio.oncanplay = () => {
            this.audio.playbackRate = savedRate;
        };
    },

    updateMetadataOnly(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title || "未知剧集",
                artist: artist || "Podcast",
                album: artist || "Podcast",
                artwork: [
                    { src: cover, sizes: '96x96',   type: 'image/png' },
                    { src: cover, sizes: '128x128', type: 'image/png' },
                    { src: cover, sizes: '192x192', type: 'image/png' },
                    { src: cover, sizes: '256x256', type: 'image/png' },
                    { src: cover, sizes: '384x384', type: 'image/png' },
                    { src: cover, sizes: '512x512', type: 'image/png' },
                ]
            });

            // 注册动作句柄是让移动端浏览器维持后台运行的关键
            const actionHandlers = [
                ['play', () => this.audio.play()],
                ['pause', () => this.audio.pause()],
                ['seekbackward', (details) => { this.audio.currentTime -= (details.seekOffset || 15); }],
                ['seekforward', (details) => { this.audio.currentTime += (details.seekOffset || 15); }],
                ['seekto', (details) => { if (details.fastSeek && 'fastSeek' in this.audio) { this.audio.fastSeek(details.seekTime); } else { this.audio.currentTime = details.seekTime; } }]
            ];

            for (const [action, handler] of actionHandlers) {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (error) {
                    console.log(`The media session action "${action}" is not supported.`);
                }
            }
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
