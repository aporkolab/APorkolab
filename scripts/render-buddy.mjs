/** Dependency-free, deterministic renderer for the GitHub profile companion. */
const C = Object.freeze({ ink: '#172433', bg: '#111724', text: '#F4F3FB', muted: '#A6B2C8', mint: '#A9E8CB', green: '#75B9AB', lilac: '#C7B8EA', coral: '#F29BAA' });
const xml = (value) => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const short = (value, length) => [...String(value ?? '')].slice(0, length).join('');
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function dateLabel(value) {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

function face(mood) {
  if (mood === 'sleepy') return '<path d="M55 72q7 7 14 0m22 0q7 7 14 0" stroke-width="4"/><path d="M76 86h8" stroke-width="4"/>';
  if (mood === 'worried') return '<path d="m55 64 13 5m24 0 13-5" stroke-width="3"/><path d="M62 74v5m36-5v5" stroke-width="6"/><path d="M74 90q6-7 12 0" stroke-width="3"/>';
  if (mood === 'focused') return '<path d="M55 68h14m22 0h14" stroke-width="3"/><path d="M62 72v8m36-8v8" stroke-width="6"/><path d="M75 89h10" stroke-width="3"/>';
  if (mood === 'happy') return '<path d="M55 77q7-12 14 0m22 0q7-12 14 0" stroke-width="4"/><path d="M73 87q7 8 14 0" stroke-width="3"/>';
  return '<g class="eyes"><path d="M61 70v10m38-10v10" stroke-width="7"/></g><path d="M73 86q7 8 14 0" stroke-width="3"/>';
}

function robot(mood, action) {
  const hands = action === 'coffee'
    ? '<path d="m41 103-19 8m97-8 14 11"/>'
    : action === 'debug'
      ? '<path d="m41 103-17 14m94-14 19-8"/>'
      : action === 'nap'
        ? '<path d="m41 103 10 22m67-22-10 22"/>'
        : '<path d="m41 103-15 14m92-14 14-15 4-10"/>';
  return `<g class="buddy" transform="translate(107 48)"><g stroke="${C.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <g fill="${C.green}"><path d="M52 133v18c0 7 22 7 22 0v-18Z"/><path d="M86 133v18c0 7 22 7 22 0v-18Z"/></g>
    <g fill="none" stroke="${C.ink}" stroke-width="14">${hands}</g><g fill="none" stroke="${C.mint}" stroke-width="7">${hands}</g>
    <path d="M47 96h66l5 36c2 11-12 17-38 17s-40-6-38-17Z" fill="${C.mint}"/>
    <path d="M52 122v10" stroke="#DFF7E9" stroke-width="5"/>
    <path d="M80 41V24"/><circle class="beacon" cx="80" cy="17" r="8" fill="${C.coral}"/><circle cx="78" cy="14" r="2" fill="#FFE5EC" stroke="none"/>
    <path d="M30 60h-6c-5 0-8 4-8 10v9c0 6 3 10 8 10h6m100-29h6c5 0 8 4 8 10v9c0 6-3 10-8 10h-6" fill="${C.green}"/>
    <rect x="28" y="38" width="104" height="73" rx="23" fill="${C.mint}"/>
    <path d="M38 56c3-6 7-9 14-9h14" stroke="#DFF7E9" stroke-width="5"/>
    <rect x="40" y="55" width="80" height="43" rx="14" fill="#F0FAF0" stroke-width="3"/>
    ${face(mood)}
    <g fill="${C.coral}" stroke="none"><ellipse cx="51" cy="85" rx="5" ry="3"/><ellipse cx="109" cy="85" rx="5" ry="3"/></g>
    <path d="M80 123c-8-11-19 1 0 12 19-11 8-23 0-12Z" fill="${C.coral}" stroke-width="2.5"/>
    <path d="M107 122v10" stroke="${C.green}" stroke-width="3"/>
  </g></g>`;
}

function accessories(action) {
  const mug = `<g class="mug" transform="translate(${action === 'coffee' ? '110 151' : '54 174'})" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M27 5h6c13 0 12 19-1 19h-4" fill="none" stroke="${C.coral}" stroke-width="5"/><path d="M0 0h29v23c0 13-29 13-29 0Z" fill="${C.coral}"/><path d="M6 5v16" stroke="#FFD0D7" stroke-width="3"/><g class="steam" stroke="#C7B8EA" stroke-width="2" fill="none"><path d="M9-8c-7-7 7-9 0-17m12 16c-7-7 7-9 0-17"/></g></g>`;
  const bug = `<g class="little-bug" transform="translate(278 181)" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"><path d="m4 17-7 4m25-4 7 4M8 5 4-2m13 7 4-7" stroke="${C.coral}"/><ellipse cx="12" cy="16" rx="12" ry="14" fill="${C.coral}"/><path d="M12 5v25"/><circle cx="7" cy="12" r="2.5" fill="#FFF4EF" stroke="none"/><circle cx="17" cy="12" r="2.5" fill="#FFF4EF" stroke="none"/></g>`;
  const lens = action === 'debug' ? `<g class="lens" stroke="${C.lilac}" fill="none" stroke-width="5"><path d="m252 154 23 23"/><circle cx="240" cy="142" r="19" fill="#223446"/><path d="m230 140 5-5" stroke="#F0F2FA" stroke-width="2"/></g>` : '';
  const sleep = action === 'nap' ? `<g class="sleep" fill="${C.lilac}" font-size="20" font-weight="700"><text x="274" y="105">z</text><text x="288" y="79" font-size="26">z</text><text x="307" y="49" font-size="32">z</text></g>` : '';
  return `${action === 'nap' ? '' : mug}${action === 'debug' ? bug : ''}${lens}${sleep}`;
}

const BUILD = Object.freeze({
  success: { text: 'PASSING', color: C.mint, icon: '<path d="m0 5 3 3 6-7"/>' },
  failure: { text: 'FAILING', color: C.coral, icon: '<path d="m1 1 7 7m0-7L1 8"/>' },
  running: { text: 'RUNNING', color: C.lilac, icon: '<circle cx="4.5" cy="4.5" r="4"/><path d="M4.5 2v3h2"/>' },
  unknown: { text: 'NO DATA', color: C.muted, icon: '<path d="M0 4.5h9"/>' },
});

/** Render the public subset of state; extra automation bookkeeping is ignored. */
export function renderBuddy(input = {}) {
  const state = input && typeof input === 'object' ? input : {};
  const mood = ['happy', 'focused', 'sleepy', 'worried', 'idle'].includes(state.mood) ? state.mood : 'idle';
  const action = ['coffee', 'debug', 'nap'].includes(state.action) ? state.action : null;
  const energy = Math.max(0, Math.min(100, Math.round(finite(state.energy, 80))));
  const total = Math.max(0, Math.floor(finite(state.totalInteractions, 0)));
  const totalLabel = total > 999999 ? '999,999+' : total.toLocaleString('en-US');
  const build = state.build && typeof state.build === 'object' ? state.build : {};
  const buildView = BUILD[build.status] && Object.hasOwn(BUILD, build.status) ? BUILD[build.status] : BUILD.unknown;
  const updated = dateLabel(build.updatedAt) ?? 'No build recorded';
  const rawName = short(state.name || 'Bot Buddy', 26);
  const name = xml(rawName);
  const title = action === 'coffee' ? 'Freshly caffeinated.' : action === 'debug' ? 'On bug patrol.' : action === 'nap' ? 'Do not disturb.' : ({ happy: 'A good day to build.', focused: 'One thing at a time.', sleepy: 'A little rest.', worried: 'Something needs a look.', idle: 'Ready when you are.' })[mood];
  const activity = state.lastActivity && typeof state.lastActivity === 'object' ? state.lastActivity : null;
  const activityNames = { coffee: 'coffee', debug: 'debug', nap: 'nap' };
  const knownActivity = activity && Object.hasOwn(activityNames, activity.action);
  const activityLabel = knownActivity ? `${activityNames[activity.action]}${activity.actor ? ` by @${short(activity.actor, 24)}` : ''}${dateLabel(activity.at) ? ` / ${dateLabel(activity.at)}` : ''}` : 'Coffee, debug, or nap? You choose.';
  const energyColor = energy < 25 ? C.coral : C.mint;
  const description = xml(`${short(state.name || 'Bot Buddy', 26)} is ${mood}. Energy ${energy} percent. ${total} interactions. Latest build: ${buildView.text.toLowerCase()}. ${updated}. ${activityLabel}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="280" viewBox="0 0 900 280" role="img" aria-labelledby="buddy-title buddy-description">
  <title id="buddy-title">${name}: ${xml(title)}</title><desc id="buddy-description">${description}</desc>
  <style>
    text{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace}.float{animation:float 4s ease-in-out infinite}.eyes{transform-origin:80px 75px;animation:blink 6s infinite}.beacon{animation:beacon 3s ease-in-out infinite}.steam{animation:steam 3s ease-in-out infinite}.little-bug{animation:bug 1.4s ease-in-out infinite}.sleep{animation:sleep 4s ease-in-out infinite}.lens{animation:lens 3s ease-in-out infinite}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes blink{0%,46%,50%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}@keyframes beacon{0%,100%{opacity:1}50%{opacity:.55}}@keyframes steam{0%,100%{opacity:.4;transform:translateY(0)}50%{opacity:.85;transform:translateY(-4px)}}@keyframes bug{0%,100%{transform:translate(278px,181px) rotate(-4deg)}50%{transform:translate(278px,178px) rotate(4deg)}}@keyframes sleep{0%,100%{opacity:.45;transform:translateY(0)}50%{opacity:1;transform:translateY(-5px)}}@keyframes lens{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}@media(prefers-reduced-motion:reduce){.float,.eyes,.beacon,.steam,.little-bug,.sleep,.lens{animation:none}}
  </style>
  <rect x="1" y="1" width="898" height="278" rx="22" fill="${C.bg}" stroke="#2D3648" stroke-width="2"/>
  <path d="M337 28v224" stroke="#2D3648"/>
  <g fill="none" stroke="#29384B" stroke-width="1.5"><path d="M42 87h28l13-13h33M308 146h-20l-12-12h-14M60 51h33m-17-7v14M293 51v16m-8-8h16"/><circle cx="42" cy="87" r="3"/><circle cx="309" cy="146" r="3"/></g>
  <ellipse cx="181" cy="218" rx="122" ry="10" fill="#0A101B"/>
  <path d="M45 213h272" stroke="#667087" stroke-width="3" stroke-linecap="round"/>
  <g class="${action === 'nap' ? '' : 'float'}">${robot(mood, action)}</g>
  <g transform="translate(122 209)" stroke="#8996B0" stroke-width="1.5" fill="#263248"><path d="M9 0h111l9 12H0Z"/><path d="M18 4h12m6 0h12m6 0h12m6 0h12m6 0h12M12 8h18m6 0h48m6 0h22"/></g>
  ${accessories(action)}
  <g><text x="365" y="43" fill="${C.lilac}" font-size="12" letter-spacing="2.6">${xml(rawName.toUpperCase())}</text><text x="365" y="84" fill="${C.text}" font-size="28" font-weight="700" letter-spacing="-1">${xml(title)}</text></g>
  <g><rect x="365" y="102" width="158" height="29" rx="7" fill="#1C2937"/><g transform="translate(376 112)" stroke="${buildView.color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">${buildView.icon}</g><text x="395" y="121" fill="${buildView.color}" font-size="12" font-weight="700">BUILD ${buildView.text}</text><text x="537" y="121" fill="${C.muted}" font-size="12">${xml(updated)}</text></g>
  <g><text x="365" y="166" fill="${C.muted}" font-size="10.5" letter-spacing="1.7">ENERGY</text><rect x="365" y="184" width="170" height="9" rx="4.5" fill="#293648"/>${energy ? `<rect x="365" y="184" width="${1.7 * energy}" height="9" rx="4.5" fill="${energyColor}"/>` : ''}<text x="550" y="195" fill="${C.text}" font-size="19" font-weight="700">${energy}<tspan fill="${C.muted}" font-size="12">%</tspan></text><path d="M629 155v47" stroke="#2D3648"/><text x="657" y="166" fill="${C.muted}" font-size="10.5" letter-spacing="1.7">INTERACTIONS</text><text x="657" y="197" fill="${C.text}" font-size="25" font-weight="700">${totalLabel}</text></g>
  <path d="M365 219h500" stroke="#2D3648"/><circle cx="369" cy="244" r="3" fill="${C.lilac}"/><text x="383" y="248" fill="${C.muted}" font-size="10.5">${xml(activityLabel)}</text>
</svg>\n`;
}
