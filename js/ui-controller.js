// js/ui-controller.js
import { PlayerCore } from './player-core.js';

export const UI = {
    openPlayer(episode, podcastTitle, podcastCover) {
        const overlay = document.getElementById('playerOverlay');
        const playerCover = document.getElementById('playerCover');
        const finalCover = episode.image || podcastCover;

        // 1. 更新网页 UI 文本和封面
        if (document.getElementById('playerTitle')) {
            document.getElementById('playerTitle').innerText = episode.title;
        }
        if (document.getElementById('playerAuthor')) {
            document.getElementById('playerAuthor').innerText = podcastTitle;
        }
        if (playerCover) playerCover.src = finalCover;
        
        overlay.classList.add('is-active');

        // 2. 启动播放并传入进度回调
        PlayerCore.play(episode.audioUrl, (current, total) => {
            this.updateProgress(current, total);
        });
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
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
};
