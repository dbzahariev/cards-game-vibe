import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useRef } from 'react';
import { generateDeal, summarizeHand, suits } from './bridge.js';
import { downloadDealWord } from './export-word.js';
import { downloadDdsWord } from './export-dds-word.js';
import { analyzeDeals } from './dds.js';
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
            <span className="suit-label" aria-label={`${suit.name}: ${suit.cards.length} карти`}>
              <SuitSymbol suit={suit} />
              <span className="suit-count" aria-hidden="true">{suit.cards.length}</span>
            </span>
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
  const [fixedEnabled, setFixedEnabled] = useState(false);
  const [fixedPlayer, setFixedPlayer] = useState(3);
  const [fixedHands, setFixedHands] = useState(() => players.map(() => []));
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
  const [ddsExporting, setDdsExporting] = useState(false);
  const [ddsProgress, setDdsProgress] = useState({ completed: 0, total: 0 });
  const [ddsMessage, setDdsMessage] = useState('');
  const ddsAbort = useRef(null);
  const ddsCache = useRef(null);
  useEffect(() => () => ddsAbort.current?.abort(), []);
  const countRequest = JSON.stringify({
    condition: conditionEnabled ? pointRanges.map((range) => ({
      minPoints: range.minPoints === '' ? null : Number(range.minPoints),
      maxPoints: range.maxPoints === '' ? null : Number(range.maxPoints),
      suits: Object.fromEntries(suits.map((s) => [s.id, {
        min: range.suits[s.id].min === '' ? null : Number(range.suits[s.id].min),
        max: range.suits[s.id].max === '' ? null : Number(range.suits[s.id].max),
      }])),
    })) : null,
    fixedHands: fixedEnabled ? fixedHands : undefined,
  });
  const [combinationCount, setCombinationCount] = useState(null);
  useEffect(() => {
    let worker;
    let active = true;
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL('./count-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          if (active) setCombinationCount({ key: countRequest, ...data });
          worker.terminate();
        };
        worker.onerror = () => {
          if (active) setCombinationCount({ key: countRequest, error: 'Броенето не успя. Промени условията, за да опиташ отново.' });
          worker.terminate();
        };
        worker.postMessage(JSON.parse(countRequest));
      } catch {
        if (active) setCombinationCount({ key: countRequest, error: 'Броенето не успя.' });
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); worker?.terminate(); };
  }, [countRequest]);
  const currentCount = combinationCount?.key === countRequest ? combinationCount : null;
  const formatEstimate = (value) => new Intl.NumberFormat('bg-BG', { notation: 'scientific', maximumSignificantDigits: 4 }).format(value);
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
  async function exportDds() {
    if (generating || exporting || ddsExporting || deals.length === 0) return;
    const controller = new AbortController();
    const exportedDeals = deals;
    ddsAbort.current = controller;
    setDdsExporting(true);
    setDdsProgress({ completed: 0, total: exportedDeals.length });
    setDdsMessage('');
    setExportError('');
    try {
      let analyses;
      if (ddsCache.current?.deals === exportedDeals) {
        analyses = ddsCache.current.analyses;
        setDdsProgress({ completed: exportedDeals.length, total: exportedDeals.length });
      } else {
        analyses = await analyzeDeals(exportedDeals, {
          signal: controller.signal,
          onProgress: setDdsProgress,
        });
        ddsCache.current = { deals: exportedDeals, analyses };
      }
      if (controller.signal.aborted) return;
      await downloadDdsWord(exportedDeals, analyses);
      setDdsMessage('Word файлът с DDS анализа е готов.');
    } catch (error) {
      if (error.name === 'AbortError') {
        setDdsMessage('DDS анализът е прекратен.');
      } else {
        setExportError('DDS експортът не успя. Опитай отново.');
      }
    } finally {
      ddsAbort.current = null;
      setDdsExporting(false);
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
          if (generating || exporting || ddsExporting) return;
          const count = Number(dealCount);
          if (Number.isInteger(count) && count >= 1 && count <= 100) {
            setGenerationError('');
            setDdsMessage('');
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
                worker.postMessage({ count, condition, fixedHands: fixedEnabled ? fixedHands : undefined });
              });
              setDeals(generated);
              ddsCache.current = null;
            } catch (error) {
              setDeals([]);
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
            <legend>Зададени карти</legend>
            <label className="condition-toggle"><input type="checkbox" checked={fixedEnabled}
              onChange={(event) => setFixedEnabled(event.target.checked)} /> Запази конкретни карти по посоки</label>
            {fixedEnabled && <div className="fixed-cards">
              <label>Посока <select value={fixedPlayer} onChange={(event) => setFixedPlayer(Number(event.target.value))}>
                {players.map((player, index) => <option key={player.id} value={index}>{player.name} · {fixedHands[index].length}/13</option>)}
              </select></label>
              <p role="status">{players[fixedPlayer].name}: {fixedHands[fixedPlayer].length}/13 зададени карти · {summarizeHand(fixedHands[fixedPlayer]).points} HCP</p>
              {suits.map((suit) => <div className="fixed-suit" key={suit.id}>
                <span aria-label={suit.name}><SuitSymbol suit={suit} /></span>
                <div className="fixed-card-buttons">{suit.cards.map((card) => {
                  const selected = fixedHands[fixedPlayer].includes(card.id);
                  const owner = fixedHands.findIndex((hand) => hand.includes(card.id));
                  const unavailable = owner !== -1 && owner !== fixedPlayer;
                  return <button type="button" key={card.id} aria-pressed={selected}
                    aria-label={`${card.rank} · ${suit.name}${unavailable ? ' · ' + players[owner].name : ''}`}
                    className={`fixed-card${suit.red ? ' red' : ''}${selected ? ' selected' : ''}`}
                    disabled={generating || unavailable || (!selected && fixedHands[fixedPlayer].length >= 13)}
                    title={unavailable ? `Зададена за ${players[owner].name}` : `${card.rank} · ${suit.name}`}
                    onClick={() => setFixedHands((hands) => hands.map((hand, index) => index === fixedPlayer
                      ? selected ? hand.filter((id) => id !== card.id) : [...hand, card.id] : hand))}>{card.rank}</button>;
                })}</div>
              </div>)}
              <button type="button" className="clear" disabled={generating} onClick={() => setFixedHands((hands) => hands.map((hand, index) => index === fixedPlayer ? [] : hand))}>Изчисти картите за {players[fixedPlayer].name}</button>
              <p><small>Избери до 13 карти за една или повече посоки. Останалите се допълват автоматично според включените условия. Зададените карти важат за всяко генерирано раздаване.</small></p>
            </div>}
          </fieldset>
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
          <button type="submit" className="generate" disabled={generating || exporting || ddsExporting}>{generating ? 'Генериране…' : 'Генерирай'}</button>
          <button type="button" className="clear" disabled={exporting || generating || ddsExporting || deals.length === 0} onClick={exportWord}>
            {exporting ? 'Експортиране…' : 'Експорт в Word'}
          </button>
          <button type="button" className="clear" disabled={exporting || generating || ddsExporting || deals.length === 0}
            onClick={exportDds} title="Word с DDS анализ · 6 раздавания на страница">
            {ddsExporting ? 'DDS анализ…' : 'Експорт на DDS анализ'}
          </button>
          {ddsExporting && ddsProgress.completed < ddsProgress.total &&
            <button type="button" className="clear" onClick={() => ddsAbort.current?.abort()}>Прекрати анализа</button>}
        </form>
        <p className="dds-status" role="status" aria-live="polite">
          {ddsExporting
            ? ddsProgress.completed < ddsProgress.total
              ? `DDS анализ: ${ddsProgress.completed} от ${ddsProgress.total} раздавания`
              : 'Подготвяне на Word файла…'
            : ddsMessage}
        </p>

        <section className="combination-count" aria-label="Брой възможни раздавания" aria-live="polite" aria-busy={!currentCount}>
          <strong>Възможни раздавания по текущите условия</strong>
          {!currentCount ? <p>Изчисляване…</p> : currentCount.error ? <p>{currentCount.error}</p> :
            currentCount.result.exact ? <>
              <p className="combination-value">{BigInt(currentCount.result.value).toLocaleString('bg-BG')}</p>
              <small>Точен брой. Редът на картите в ръката няма значение.</small>
            </> : <>
              <p className="combination-value">{currentCount.result.hits === 0 ? 'Недостатъчно данни за оценка' : `≈ ${formatEstimate(currentCount.result.value)}`}</p>
              <small>{currentCount.result.hits === 0
                ? `Няма съвпадения в ${currentCount.result.samples.toLocaleString('bg-BG')} случайни раздавания. Това не означава, че няма решение.`
                : `Приблизителна оценка от ${currentCount.result.samples.toLocaleString('bg-BG')} случайни раздавания.`}
                {' '}95% доверителен интервал: {currentCount.result.hits === 0 ? '0' : formatEstimate(currentCount.result.lower)} – {formatEstimate(currentCount.result.upper)}.</small>
            </>}
        </section>
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
