// js/ui-controller.js
import { PlayerCore } from './player-core.js';

export const UI = {
    openPlayer(episode, podcastTitle, podcastCover) {
        const overlay = document.getElementById('playerOverlay');
        const playerCover = document.getElementById('playerCover');
        const finalCover = episode.image || podcastCover;

        document.getElementById('playerTitle').innerText = episode.title;
        document.getElementById('playerAuthor').innerText = podcastTitle;
        if (playerCover) playerCover.src = finalCover;
        if (overlay) overlay.classList.add('is-active');

        PlayerCore.updateMetadata(episode.title, podcastTitle, finalCover);

        // 直接接收计算好的：进度百分比、当前时间文字、总时长文字
        PlayerCore.onTimeUpdate((pct, currentStr, durationStr) => {
            this.updateProgress(pct, currentStr, durationStr);
        });

        PlayerCore.play(episode.audioUrl);
    },

    updateProgress(pct, currentStr, durationStr) {
        const progressRange = document.getElementById('progressRange');
        const currentTimeEl = document.getElementById('currentTime');
        const durationTimeEl = document.getElementById('durationTime');

        if (progressRange) progressRange.value = pct;
        if (currentTimeEl) currentTimeEl.innerText = currentStr;
        if (durationTimeEl) durationTimeEl.innerText = durationStr;
    }
};
