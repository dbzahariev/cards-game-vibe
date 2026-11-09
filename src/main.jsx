import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateDeal, summarizeHand, suits } from './bridge.js';
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
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [pointRanges, setPointRanges] = useState(() => players.map(() => ({ minPoints: '0', maxPoints: '37', suits: Object.fromEntries(suits.map((s) => [s.id, { min: '0', max: '13' }])) })));
  function updateRange(index, field, value) {
    setPointRanges((ranges) => ranges.map((range, i) => i === index ? { ...range, [field]: value } : range));
  }
  function updateSuit(index, suit, field, value) {
    setPointRanges((ranges) => ranges.map((range, i) => i === index ? {
      ...range, suits: { ...range.suits, [suit]: { ...range.suits[suit], [field]: value } },
    } : range));
  }
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
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
        <form className="deal-actions" onSubmit={async (event) => {
          event.preventDefault();
          const count = Number(dealCount);
          if (Number.isInteger(count) && count >= 1 && count <= 100) {
            setGenerationError('');
            setGenerating(true);
            try {
              const condition = conditionEnabled ? pointRanges.map((range) => ({
                minPoints: Number(range.minPoints), maxPoints: Number(range.maxPoints),
                suits: Object.fromEntries(suits.map((s) => [s.id, { min: Number(range.suits[s.id].min), max: Number(range.suits[s.id].max) }])),
              })) : null;
              const worker = new Worker(new URL('./generation-worker.js', import.meta.url), { type: 'module' });
              const generated = await new Promise((resolve, reject) => {
                worker.onmessage = ({ data }) => {
                  worker.terminate();
                  data.error ? reject(new Error(data.error)) : resolve(data.deals);
                };
                worker.onerror = () => { worker.terminate(); reject(new Error('Генерирането не успя. Опитай отново.')); };
                worker.postMessage({ count, condition });
              });
              setDeals(generated);
            } catch (error) {
              setGenerationError(error.message);
            } finally {
              setGenerating(false);
            }
          }
        }}>
          <label className="deal-count">Брой раздавания
            <input type="number" min="1" max="100" step="1" required value={dealCount}
              onChange={(event) => setDealCount(event.target.value)} />
          </label>
          <fieldset className="hand-condition">
            <legend>Условия за всички ръце</legend>
            <label className="condition-toggle"><input type="checkbox" checked={conditionEnabled}
              onChange={(event) => setConditionEnabled(event.target.checked)} /> Ограничения по точки и бои</label>
            {conditionEnabled && <div className="condition-fields">
              {[3, 1, 0, 2].map((index) => {
                const player = players[index];
                return (
                <fieldset className="player-condition" key={player.id}>
                  <legend>{player.name}</legend>
                  <label className="deal-count">Минимум HCP
                    <input type="number" min="0" max="37" step="1" required value={pointRanges[index].minPoints}
                      onChange={(event) => updateRange(index, 'minPoints', event.target.value)} />
                  </label>
                  <label className="deal-count">Максимум HCP
                    <input type="number" min="0" max="37" step="1" required value={pointRanges[index].maxPoints}
                      onChange={(event) => updateRange(index, 'maxPoints', event.target.value)} />
                  </label>
                  <div className="suit-conditions">
                    {suits.map((suit) => (
                      <div className="suit-condition" key={suit.id}>
                        <span><SuitSymbol suit={suit} /> {suit.name}</span>
                        <label className="deal-count">От
                          <input aria-label={player.name + ' · ' + suit.name + ' минимум'} type="number" min="0" max="13" step="1" required
                            value={pointRanges[index].suits[suit.id].min} onChange={(e) => updateSuit(index, suit.id, 'min', e.target.value)} />
                        </label>
                        <label className="deal-count">До
                          <input aria-label={player.name + ' · ' + suit.name + ' максимум'} type="number" min="0" max="13" step="1" required
                            value={pointRanges[index].suits[suit.id].max} onChange={(e) => updateSuit(index, suit.id, 'max', e.target.value)} />
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>
                );
              })}
              <small>Границите са включени. Всички условия важат едновременно при следващо генериране. Общо в раздаването има 40 HCP.</small>
            </div>}
          </fieldset>
          <button type="submit" className="generate" disabled={generating}>{generating ? 'Генериране…' : 'Генерирай'}</button>
          <button type="button" className="clear" disabled={exporting} onClick={exportWord}>
            {exporting ? 'Експортиране…' : 'Експорт в Word'}
          </button>
        </form>
        {generationError && <p role="alert">{generationError}</p>}
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
