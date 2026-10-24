import { api } from '../api.js';

// Síň slávy: žebříček hráčů podle cti
export default function slava(el) {
  el.innerHTML = '<div class="panel">Kronikář listuje svitky…</div>';

  api('/arena/ladder')
    .then(({ players, total }) => {
      // Mezera v tabulce, když hráč není v první padesátce
      let previousRank = 0;
      const rows = players
        .map((p) => {
          const gap = p.rank > previousRank + 1 ? '<tr class="ladder-gap"><td colspan="5">⋯</td></tr>' : '';
          previousRank = p.rank;
          return `${gap}
            <tr class="${p.isMe ? 'me' : ''}">
              <td class="rank">${p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : `${p.rank}.`}</td>
              <td>${p.avatar} <strong>${p.name}</strong></td>
              <td class="ladder-class">${p.className}</td>
              <td class="num">${p.level}</td>
              <td class="num">${p.honor}</td>
            </tr>`;
        })
        .join('');

      el.innerHTML = `
        <div class="panel ladder">
          <h2>🏆 Síň slávy</h2>
          <p class="intro">Nejctihodnější hrdinové říše. Celkem ${total} hrdinů, ale pamatuje se jen na ty nahoře.</p>
          <table class="ladder-table">
            <thead>
              <tr><th>#</th><th>Hrdina</th><th class="ladder-class">Povolání</th><th class="num">Úroveň</th><th class="num">Čest</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p><a href="#/arena">⚔️ Zpátky do arény</a></p>
        </div>`;
    })
    .catch((err) => {
      el.innerHTML = `<div class="panel"><p class="error">${err.message}</p></div>`;
    });
}
