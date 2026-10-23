[read_files: content too large; truncated to first 2,000 lines at compaction]

// =============================================================================
// DECOMPRESIUNE DATA (după încărcarea data.js)
// =============================================================================

/** factory ca să nu polueze namespace-ul global atunci când window.old_… există */
async function _decompress() {
  const src = typeof window !== 'undefined' && window.TMP_DATA &&
              window.TMP_DATA.rawData &&
              window.TMP_DATA.rawData.__esm ? window.TMP_DATA.rawData.__esm : '';
  const blob = src.match(/\/\*\* BEGIN_PACKER_ESCAPED_DATA \*\/\n([\s\S]*?)<\/\/\!-\- END_PACKER_ESCAPED_DATA -\-\->/);
  if (!blob || !blob[1]) {
    throw new Error('data.js incompatibil: nu am găsit payload-ul comprimat. Verifică că data.js este versiunea corectă (cu blocul BEGIN_PACKER_ESCAPED_DATA).');
  }
  const packed = blob[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&#36;/g, '$').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/\r\n/g, '\n');
  try {
    const obj = JSON.parse(packed);
    decompressAndAttach(obj);
    return obj;
  } catch (e) {
    throw new Error('JSON.parse(payload comprimat) a eșuat: ' + e.message + '\n\nPosibilă cauză: data.js modificat manual, fără ca equivariantele HTML să fie restaurate înainte de parsare.\nPayload-ul packed receput arată așa:\n' + packed.slice(0, 400));
  }
}

function decompressAndAttach(obj) {
  // ... restul functionă identic ...
  attachRealData(obj);
}

// Patch global pentru compatibilitate: orice script extern care citește window.TMP_DATA raw
const _originalGetRawData = win && win.old_getRawData;
if (!_originalGetRawData) {
  win && (win.old_getRawData = _decompress);
}