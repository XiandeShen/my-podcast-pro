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
                    // 仅注入元数据（封面标题），不设置 setPositionState，保证时间同步
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
