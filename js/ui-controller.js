// js/ui-controller.js
import { PlayerCore } from './player-core.js';

export const UI = {
    openPlayer(episode, podcastTitle, podcastCover) {
        const overlay = document.getElementById('playerOverlay');
        const finalCover = episode.image || podcastCover;

        document.getElementById('playerTitle').innerText = episode.title;
        document.getElementById('playerAuthor').innerText = podcastTitle;
        document.getElementById('playerCover').src = finalCover;
        overlay.classList.add('is-active');

        PlayerCore.updateMetadata(episode.title, podcastTitle, finalCover);

        // 监听核心层传来的渲染数据
        PlayerCore.onTimeUpdate((pct, currentStr, durationStr) => {
            const progressRange = document.getElementById('progressRange');
            const currentTimeEl = document.getElementById('currentTime');
            const durationTimeEl = document.getElementById('durationTime');

            if (progressRange) progressRange.value = pct;
            if (currentTimeEl) currentTimeEl.innerText = currentStr;
            if (durationTimeEl) durationTimeEl.innerText = durationStr;
        });

        PlayerCore.play(episode.audioUrl);
    }
};
