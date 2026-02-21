// js/player-core.js

const sysAudio = new Audio();
sysAudio.id = "core-audio-player";
sysAudio.style.display = "none";
document.body.appendChild(sysAudio);

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this._updateMediaSessionState();
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => this._updateMediaSessionState();
        
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 传入当前获取到的精确值，避免再次读取 this.audio.currentTime 可能导致的延迟
            this._updateMediaSessionState(dur, cur);
        };

        this.audio.onplay = () => this._updateMediaSessionState();
        this.audio.onpause = () => this._updateMediaSessionState();
        this.audio.onseeked = () => this._updateMediaSessionState();
        this.audio.onratechange = () => this._updateMediaSessionState();
    },

    // 统一的 MediaSession 更新方法，可接收外部传入的 duration 和 currentTime
    _updateMediaSessionState(dur, cur) {
        if (!('mediaSession' in navigator)) return;

        // 如果未传入，则从 audio 元素获取
        const duration = (dur !== undefined) ? dur : this.audio.duration;
        const current = (cur !== undefined) ? cur : this.audio.currentTime;

        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        // 确保 duration 和 current 都是有限数字，且 duration > 0
        if (duration && Number.isFinite(duration) && duration > 0 && Number.isFinite(current)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackPosition: current,
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (error) {
                console.warn("MediaSession API Error:", error);
            }
        }
    },

    // 对外公开的 updateMediaSessionState 方法，内部调用新方法
    updateMediaSessionState() {
        this._updateMediaSessionState();
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [
                    { src: cover, sizes: '96x96' },
                    { src: cover, sizes: '128x128' },
                    { src: cover, sizes: '256x256' },
                    { src: cover, sizes: '512x512' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => { this.audio.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { this.audio.pause(); });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
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
