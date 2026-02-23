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
    _onTimeSave: null, // 新增：用于保存进度的回调

    play(url, title, artist, cover, startTime = 0) {
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
                    // 如果有历史进度，跳转
                    if (startTime > 0 && Math.abs(this.audio.currentTime - startTime) > 1) {
                        this.audio.currentTime = startTime;
                    }
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
            // 每当播放时间更新，触发保存逻辑
            if (this._onTimeSave) {
                this._onTimeSave(cur, dur);
            }
        };

        this.audio.onplay = () => {
            if (this._onStatusChange) this._onStatusChange(true);
        };
        this.audio.onpause = () => {
            if (this._onStatusChange) this._onStatusChange(false);
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
        }
    },

    onStatusChange(cb) { this._onStatusChange = cb; },
    onTimeUpdate(cb) { this._onTimeUpdate = cb; },
    onTimeSave(cb) { this._onTimeSave = cb; }, // 新增
    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; } 
        else { this.audio.pause(); return false; }
    },
    seek(pct) {
        if (this.audio.duration && Number.isFinite(this.audio.duration)) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
        }
    },
    format(s) {
        if (isNaN(s) || !Number.isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
