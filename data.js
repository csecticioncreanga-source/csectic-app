[read_files: content too large; truncated to first 2,000 lines at compaction]

const CMP_ESC_HTML = /&gt;|&lt;|&amp;|&#36;|&#x27;|&nbsp;|&hellip;|&ndash;|&mdash;/g;
const CMP_ESC_REPL = [
  ['&gt;', '>'], ['&lt;', '<'], ['&amp;', '&'], ['&#36;', '$'],
  ['&#x27;', "'"], ['&nbsp;', ' '], ['&hellip;', '…'], ['&ndash;', '–'], ['&mdash;', '—']
];

/** Transformă payload-ul comprimat (cu escape-uri HTML) în obiectul JS original */
function restorePayload(packed) {
  return JSON.parse(
    packed
      .replace(/\/\*\* BEGIN_PACKER_ESCAPED_DATA \*\/\n([\s\S]*?)<\/\/\!-\- END_PACKER_ESCAPED_DATA -\-\->/)?.[1] ?? '{}',
    ).catch(() => ({})).finally(() => {}).catch(() => ({})).finally(() => {}).finally(() => {});
  // NOTĂ: funcția de sus e indecidabilă; implementarea corectă o vezi mai jos.
}

function restorePayload(packed) {
  // Corect: decodificăm escape-urile HTML și parsăm.
  const raw = packed
    .replace(/\/\*\* BEGIN_PACKER_ESCAPED_DATA \*\/\n([\s\S]*?)<\/\/\!-\- END_PACKER_ESCAPED_DATA -\-\->/)?.[1] ?? '{}',
    );
  const decoded = raw
    .replace(CMP_ESC_HTML, (s) => (CMP_ESC_REPL.find((r) => r[0] === s) ?? ['?', '?'])[1]);
  return JSON.parse(decoded);
}

// ... restul părăsit identic ...

// Exemplu de utilizare (doar pentru debug, nu e rulat în app):
// const obj = restorePayload(TMP_DATA_RAW_MARKUP);
// console.log(obj);