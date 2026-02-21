// js/player-core.js

// 依然保持 DOM 挂载，这是根基
const getAudioElement = () => {
    let el = document.getElementById('main-audio-player');
    if (!el) {
        el = document.createElement('audio');
        el.id = 'main-audio-player';
        el.style.display = 'none';
        document.body.appendChild(el);
    }
    return el;
};

const sysAudio = getAudioElement();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    // 【新增】影子时间：用来对抗三星系统的恶意归零
    _shadowTime: 0, 

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        
        // 如果是切换新音频，重置影子时间
        if (this.audio.src !== url) {
            this._shadowTime = 0;
            this.audio.src = url;
        }
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.updateMediaSessionState();
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => this.updateMediaSessionState();
        
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            // 【核心补丁】三星纠偏逻辑
            // 如果系统给出的 cur 是 0，但我们的影子时间已经跑出去了（比如超过 1 秒）
            // 说明这是一次异常的归零，我们强行给它拉回到影子时间
            if (cur === 0 && this._shadowTime > 0.5 && !this.audio.paused) {
                console.log("检测到系统异常归零，正在强制纠正...");
                this.audio.currentTime = this._shadowTime;
                return;
            }

            // 只有当时间是正常增加时，才更新影子时间
            if (cur > 0) {
                this._shadowTime = cur;
            }

            if (this._onTimeUpdate) {
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 监听所有可能导致归零的操作，并在操作完成后强制同步影子时间
        this.audio.onplay = () => this.syncAndReport();
        this.audio.onpause = () => this.syncAndReport();
        this.audio.onseeked = () => {
            this._shadowTime = this.audio.currentTime;
            this.syncAndReport();
        };
        this.audio.onratechange = () => {
            // 倍速切换瞬间，强行稳住当前时间
            this.audio.currentTime = this._shadowTime;
            this.syncAndReport();
        };
    },

    syncAndReport() {
        this.updateMediaSessionState();
    },

    updateMediaSessionState() {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        if (dur && Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                // 三星手机有时候无法接受过于频繁的 position 更新
                // 我们加一个微小的尝试捕获
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: cur,
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (error) {
                // 如果系统报错，说明系统媒体通道正忙，我们忽略这次上报
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
                    { src: cover, sizes: '256x256' },
                    { src: cover, sizes: '512x512' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => { this.audio.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { this.audio.pause(); });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                this.seekOffset(-15);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                this.seekOffset(15);
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
                    this.audio.currentTime = details.seekTime;
                    this._shadowTime = details.seekTime;
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
        if (this.audio.duration && Number.isFinite(this.audio.duration)) {
            const target = (pct / 100) * this.audio.duration;
            this.audio.currentTime = target;
            this._shadowTime = target;
        }
    },

    seekOffset(s) {
        const target = Math.max(0, Math.min(this.audio.currentTime + s, this.audio.duration));
        this.audio.currentTime = target;
        this._shadowTime = target;
    },

    format(s) {
        if (isNaN(s) || !Number.isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
