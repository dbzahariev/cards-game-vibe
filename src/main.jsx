import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateDeal, summarizeHand } from './bridge.js';
import { downloadDealWord } from './export-word.js';
import './style.css';

const players = [
  { id: 'north', name: 'Север' },
  { id: 'west', name: 'Запад' },
  { id: 'east', name: 'Изток' },
  { id: 'south', name: 'Юг · Ти' },
];

function SuitSymbol({ suit }) {
  return <span className={suit.red ? 'symbol red' : 'symbol'} aria-hidden="true">{suit.symbol}</span>;
}

function PlayerHand({ player, hand, dealIndex }) {
  const { groups, points } = summarizeHand(hand);
  return (
    <section className={`panel player-hand ${player.id}`} aria-labelledby={`deal-${dealIndex}-${player.id}-title`}>
      <div className="section-header">
        <h3 id={`deal-${dealIndex}-${player.id}-title`}>{player.name}</h3>
        <span className="player-points">{points} HCP</span>
      </div>
      <div className="player-suits">
        {groups.map((suit) => (
          <div className="player-suit" key={suit.id}>
            <span className="suit-label" aria-label={suit.name}><SuitSymbol suit={suit} /></span>
            <div className="suit-cards">
              {suit.cards.map((card) => (
                <span key={card.id} className={`card${suit.red ? ' red' : ''}`} aria-label={`${card.rank} · ${suit.name}`}>
                  <span>{card.rank}</span>
                </span>
              ))}
              {suit.cards.length === 0 && <span className="empty-suit">—</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [deals, setDeals] = useState(() => [generateDeal()]);
  const [dealCount, setDealCount] = useState('1');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  async function exportWord() {
    setExporting(true);
    setExportError('');
    try {
      await downloadDealWord(deals);
    } catch {
      setExportError('Експортът не успя. Опитай отново.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <main>
      <header className="page-header">
        <span className="eyebrow"><span aria-hidden="true">♠</span> БРИДЖ</span>
        <h1>Бридж раздавания</h1>
        <p>Четирима играчи · 13 карти на всеки.</p>
        <form className="deal-actions" onSubmit={(event) => {
          event.preventDefault();
          const count = Number(dealCount);
          if (Number.isInteger(count) && count >= 1 && count <= 100) {
            setDeals(Array.from({ length: count }, () => generateDeal()));
          }
        }}>
          <label className="deal-count">Брой раздавания
            <input type="number" min="1" max="100" step="1" required value={dealCount}
              onChange={(event) => setDealCount(event.target.value)} />
          </label>
          <button type="submit" className="generate">Генерирай</button>
          <button type="button" className="clear" disabled={exporting} onClick={exportWord}>
            {exporting ? 'Експортиране…' : 'Експорт в Word'}
          </button>
        </form>
        {exportError && <p role="alert">{exportError}</p>}
      </header>
      <p className="deals-status" role="status">Показани раздавания: {deals.length}</p>
      <div className="deals-list">
        {deals.map((hands, dealIndex) => (
          <section className="deal" key={dealIndex} aria-labelledby={`deal-${dealIndex}-title`}>
            <h2 id={`deal-${dealIndex}-title`} className="deal-title">Раздаване {dealIndex + 1}</h2>
            <div className="bridge-table">
              {players.map((player, index) => <PlayerHand key={player.id} player={player} hand={hands[index]} dealIndex={dealIndex} />)}
            </div>
          </section>
        ))}
      </div>
      <p className="scoring">Точки (HCP): Асо = 4 · Поп = 3 · Дама = 2 · Вале = 1</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
