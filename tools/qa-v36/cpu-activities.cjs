// Isolated lifecycle/race tests. Browser integration uses real game timers.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

class Clock {
  now = 0; nextId = 1; timers = new Map();
  set(fn, delay) { const id = this.nextId++; this.timers.set(id, {fn, at: this.now + delay}); return id; }
  clear(id) { this.timers.delete(id); }
  advance(ms) {
    const until = this.now + ms; let count = 0;
    while (true) {
      const entry = [...this.timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      if (++count > 1000) throw new Error('Unexpected timer loop');
      const [id, timer] = entry; this.timers.delete(id); this.now = timer.at; timer.fn();
    }
    this.now = until;
  }
}
class Node {
  open = false; isConnected = false; hidden = false; disabled = false;
  dataset = {}; textContent = ''; events = new Map(); queries = new Map();
  classList = {add() {}, remove() {}};
  setAttribute() {}
  append(node) { node.isConnected = true; node.parent = this; }
  remove() { this.isConnected = false; this.parent = null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { document.activeElement = this; }
  addEventListener(name, callback) { this.events.set(name, callback); }
  removeEventListener(name, callback) { if (this.events.get(name) === callback) this.events.delete(name); }
  querySelector(selector) { return this.queries.get(selector) || null; }
  querySelectorAll(selector) { return selector === 'button' ? this.buttons || [] : []; }
  set innerHTML(value) {
    const selectors = ['h2', '[data-intro]', '.cyber-game-result', '[data-reaction]',
      '.cyber-memory-grid', '[data-start]', '[data-record]', '[data-close]'];
    for (const selector of selectors) this.queries.set(selector, new Node());
    this.queries.get('.cyber-memory-grid').buttons = Array.from({length: 4}, () => new Node());
  }
}

(async () => {
  const clock = new Clock(), keys = new Set(), storage = new Map(), checks = [];
  const globals = new Map(['document', 'localStorage', 'setTimeout', 'clearTimeout', 'performance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const add = (name, extra = {}) => {checks.push({name, pass: true, ...extra}); console.log(JSON.stringify(checks.at(-1)));};
  let activity;
  try {
    globalThis.document = {activeElement: null, createElement: () => new Node(),
      addEventListener(name, fn) { if (name === 'keydown') keys.add(fn); },
      removeEventListener(name, fn) { if (name === 'keydown') keys.delete(fn); }};
    globalThis.localStorage = {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value))};
    globalThis.setTimeout = (fn, delay) => clock.set(fn, delay);
    globalThis.clearTimeout = id => clock.clear(id);
    Object.defineProperty(globalThis, 'performance', {configurable: true, value: {now: () => clock.now}});
    const source = fs.readFileSync(path.join(__dirname, '../../dist/courtyard-activities.js'), 'utf8');
    const {createCourtyardActivities} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    let closes = 0;
    activity = createCourtyardActivities(new Node(), {onClose: () => closes++});
    const click = selector => activity.dialog.querySelector(selector).onclick();
    const press = (code, repeat = false) => {
      const event = {code, repeat, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }};
      for (const key of keys) key(event);
      return event;
    };

    activity.open('reaction');
    const idleSpace = press('Space');
    assert.equal(idleSpace.prevented, false); assert.equal(activity.state.phase, 'idle');
    // Browser's native button activation now runs once, because capture did
    // not swallow Space or invoke begin itself.
    click('[data-start]'); assert.equal(activity.state.phase, 'wait'); assert.equal(clock.timers.size, 1);
    const waitSpace = press('Space');
    assert.equal(waitSpace.prevented, true); assert.equal(waitSpace.stopped, true); assert.equal(activity.state.phase, 'early');
    assert.equal(clock.timers.size, 1); activity.close();
    add('Space permits native Start activation exactly once and still intercepts a reaction false start');

    activity.open('reaction'); click('[data-start]');
    clock.advance([...clock.timers.values()][0].at - clock.now);
    assert.equal(activity.state.phase, 'signal');
    const heldSpace = press('Space', true);
    assert.equal(heldSpace.prevented, true); assert.equal(activity.state.samples.length, 0);
    clock.advance(187); press('Space');
    assert.deepEqual(activity.state.samples, [187]); assert.equal(activity.state.phase, 'feedback');
    press('Space', true); assert.equal(activity.state.samples.length, 1);
    activity.close(); closes = 0;
    add('Held Space cannot record duplicate reaction samples or trigger native button activation during a signal');

    activity.open('reaction'); click('[data-start]');
    assert.equal(activity.state.phase, 'wait'); assert.equal(clock.timers.size, 1);
    activity.close(); activity.close();
    assert.equal(clock.timers.size, 0); assert.equal(closes, 1);
    clock.advance(5000);
    assert.equal(activity.state.phase, 'idle'); assert.equal(activity.enabled, false);
    add('Closing twice cancels the pending reaction and calls exterior continuation once', {closes});

    activity.open('reaction'); click('[data-start]'); assert.equal(clock.timers.size, 1);
    activity.open('table'); assert.equal(clock.timers.size, 0);
    clock.advance(5000);
    assert.equal(activity.state.mode, 'memory'); assert.equal(activity.state.phase, 'idle');
    assert.equal(activity.dialog.dataset.game, 'memory');
    add('Switching games cancels an earlier reaction signal instead of corrupting the new game');

    click('[data-start]'); assert.equal(activity.state.phase, 'show'); assert.equal(clock.timers.size, 1);
    activity.close(); assert.equal(clock.timers.size, 0); clock.advance(5000);
    assert.equal(activity.state.phase, 'idle'); assert.equal(activity.enabled, false);
    activity.open('table'); click('[data-start]');
    clock.advance(2000);
    assert.equal(activity.state.phase, 'input'); assert.equal(activity.state.level, 1);
    assert.equal(activity.state.sequence.length, 1);
    add('Closing a sequence presentation cancels its timer and restarting begins at level one');

    const tileButtons = activity.dialog.querySelector('.cyber-memory-grid').buttons;
    tileButtons[activity.state.sequence[0]].onclick();
    assert.equal(activity.state.phase, 'show'); assert.equal(activity.state.level, 2);
    assert.equal(tileButtons.every(button => button.disabled), true);
    // Direct/programmatic clicks during the 650 ms gap cannot answer the
    // next level before its sequence has been presented.
    tileButtons[activity.state.sequence[0]].onclick();
    tileButtons[activity.state.sequence[1]].onclick();
    assert.equal(activity.state.phase, 'show'); assert.equal(activity.state.level, 2);
    clock.advance(3500); assert.equal(activity.state.phase, 'input');
    assert.equal(activity.state.level, 2); assert.equal(activity.state.sequence.length, 2);
    add('Memory progression immediately disables input until the new sequence has been shown');

    activity.close(); activity.open('reaction'); click('[data-start]');
    assert.equal(keys.size, 1); assert.equal(clock.timers.size, 1);
    activity.dispose();
    assert.equal(keys.size, 0); assert.equal(clock.timers.size, 0); assert.equal(activity.dialog.isConnected, false);
    assert.equal(activity.enabled, false); clock.advance(5000); assert.equal(activity.state.phase, 'idle');
    add('Disposal cancels timers and removes the captured keyboard listener and dialog');
  } catch (error) {
    checks.push({name: 'Lifecycle failure', pass: false, error: error.stack});
    process.exitCode = 1;
  } finally {
    try { activity?.dispose(); } catch {}
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    const out = process.env.RP_QA_OUT || '/tmp/rodina-qa-v36'; fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(path.join(out, 'cpu-activities.json'), JSON.stringify({pass: checks.length === 7 && checks.every(c => c.pass), checks}, null, 2));
  }
})().catch(error => {console.error(error.stack); process.exitCode = 1;});
