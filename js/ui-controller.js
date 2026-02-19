// js/ui-controller.js
import { PlayerCore } from './player-core.js';

export const UI = {
    openPlayer(episode, podcastTitle, podcastCover) {
        const overlay = document.getElementById('playerOverlay');
        const playerCover = document.getElementById('playerCover');
        const finalCover = episode.image || podcastCover;

        // 1. 设置 UI 静态内容
        document.getElementById('playerTitle').innerText = episode.title;
        document.getElementById('playerAuthor').innerText = podcastTitle;
        if (playerCover) playerCover.src = finalCover;

        // 2. 设置进度回调 (注意：PlayerCore 传回的是秒数)
        PlayerCore.onTimeUpdate((current, total) => {
            this.updateProgress(current, total);
        });

        // 3. 将元数据同步给安卓/iOS系统
        PlayerCore.updateMetadata(episode.title, podcastTitle, finalCover);

        // 4. 播放音频
        PlayerCore.play(episode.audioUrl);

        overlay.classList.add('is-active');
    },

    updateProgress(current, total) {
        const progressRange = document.getElementById('progressRange');
        const currentTimeEl = document.getElementById('currentTime');
        const durationTimeEl = document.getElementById('durationTime');

        if (total > 0) {
            const percent = (current / total) * 100;
            if (progressRange) progressRange.value = percent;
            if (currentTimeEl) currentTimeEl.innerText = this.formatTime(current);
            if (durationTimeEl) durationTimeEl.innerText = this.formatTime(total);
        }
    },

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
};
