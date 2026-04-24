// --- Constants & Config ---
const DICT_PATH = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';

// --- State ---
let tokenizer = null;
let rawText = '';
let isEngineReady = false;

// --- DOM Elements ---
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file-btn');
const readerContainer = document.getElementById('reader-container');
const readerContent = document.getElementById('reader-content');
const loadingOverlay = document.getElementById('loading-overlay');
const statusMessage = document.getElementById('status-message');

// Settings
const toggleRuby = document.getElementById('toggle-ruby');
const toggleSerif = document.getElementById('toggle-serif');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');

// --- Initialization ---
const init = async () => {
    // Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Initialize Kuromoji
    statusMessage.textContent = 'エンジン初期化中...';
    try {
        window.kuromoji.builder({ dicPath: DICT_PATH }).build((err, _tokenizer) => {
            if (err) {
                console.error('Kuromoji initialization failed:', err);
                statusMessage.textContent = '初期化失敗';
                return;
            }
            tokenizer = _tokenizer;
            isEngineReady = true;
            statusMessage.textContent = 'Engine Ready';
            console.log('Kuromoji initialized successfully');
        });
    } catch (e) {
        console.error('Kuromoji error:', e);
        statusMessage.textContent = 'Error';
    }
};

// --- Helper Functions ---
const showLoading = (text = '解析中...') => {
    document.getElementById('loading-text').textContent = text;
    loadingOverlay.classList.remove('hidden');
};

const hideLoading = () => {
    loadingOverlay.classList.add('hidden');
};

const katakanaToHiragana = (src) => {
    return src.replace(/[\u30a1-\u30f6]/g, function(match) {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
};

const isKanji = (ch) => {
    return /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(ch);
};

const hasKanji = (text) => {
    return /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(text);
};

/**
 * Parses custom ruby syntax: ｜漢字《かんじ》
 */
const parseCustomRuby = (text) => {
    // Pattern: ｜(word)《(reading)》 or (kanji)《(reading)》
    // Simplified regex for the common ｜word《reading》 format
    return text.replace(/｜([^｜《》\n]+)《([^《》\n]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
};

/**
 * Automatically adds ruby to Kanji using Kuromoji
 */
const autoRuby = (text) => {
    if (!tokenizer) return text;

    const tokens = tokenizer.tokenize(text);
    let html = '';

    for (const token of tokens) {
        const word = token.surface_form;
        
        // Skip if word is already a ruby tag (though tokenizer won't see it as one)
        // Check if token has kanji and a reading
        if (hasKanji(word) && token.reading && token.reading !== '*') {
            const reading = katakanaToHiragana(token.reading);
            // Don't add ruby if reading is identical to surface form (rare for kanji but possible)
            if (word !== reading) {
                html += `<ruby>${word}<rt>${reading}</rt></ruby>`;
            } else {
                html += word;
            }
        } else {
            html += word;
        }
    }
    return html;
};

const processText = async (text) => {
    showLoading();
    
    // First, preserve custom ruby by temporarily hiding them? 
    // Actually, we can just process line by line.
    const lines = text.split('\n');
    let finalHtml = '';

    for (const line of lines) {
        if (!line.trim()) {
            finalHtml += '<p>&nbsp;</p>';
            continue;
        }

        // 1. Handle manual ruby tags first to avoid kuromoji splitting them
        // For simplicity, we split by manual ruby markers and process the rest
        const segments = line.split(/(｜[^｜《》\n]+《[^《》\n]+》)/g);
        let lineHtml = '';

        for (const segment of segments) {
            if (segment.startsWith('｜') && segment.includes('《')) {
                // This is a manual ruby segment
                lineHtml += parseCustomRuby(segment);
            } else {
                // This is plain text, apply auto ruby
                lineHtml += autoRuby(segment);
            }
        }

        finalHtml += `<p>${lineHtml}</p>`;
    }

    hideLoading();
    return finalHtml;
};

// --- Core Functionality ---
const handleFile = async (file) => {
    if (!file) return;

    if (!isEngineReady) {
        alert('解析エンジンの準備中です。少々お待ちください。');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        rawText = e.target.result;
        const html = await processText(rawText);
        
        readerContent.innerHTML = html;
        uploadZone.classList.add('hidden');
        readerContainer.classList.remove('hidden');
    };
    
    // Auto-detect encoding (simple check for UTF-8)
    reader.readAsText(file, 'UTF-8');
};

// --- Event Listeners ---

// Sidebar Toggle
openSidebarBtn.onclick = () => sidebar.classList.add('open');
closeSidebarBtn.onclick = () => sidebar.classList.remove('open');

// File Upload
selectFileBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFile(e.target.files[0]);

uploadZone.ondragover = (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
};
uploadZone.ondragleave = () => uploadZone.classList.remove('drag-over');
uploadZone.ondrop = (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
};
uploadZone.onclick = () => fileInput.click();

// Settings
toggleRuby.onchange = () => {
    if (toggleRuby.checked) {
        readerContent.classList.remove('ruby-hidden');
    } else {
        readerContent.classList.add('ruby-hidden');
    }
};

toggleSerif.onchange = () => {
    if (toggleSerif.checked) {
        readerContent.classList.add('serif-mode');
    } else {
        readerContent.classList.remove('serif-mode');
    }
};

fontSizeSlider.oninput = () => {
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = `${size}px`;
    readerContent.style.fontSize = `${size}px`;
};

// SSML Export
const generateSSML = () => {
    if (!rawText || !tokenizer) return null;

    let ssml = '<speak>\n';
    const lines = rawText.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        let lineSsml = '';
        const segments = line.split(/(｜[^｜《》\n]+《[^《》\n]+》)/g);

        for (const segment of segments) {
            if (segment.startsWith('｜') && segment.includes('《')) {
                // Manual ruby: ｜漢字《かんじ》 -> <sub alias="かんじ">漢字</sub>
                const match = segment.match(/｜([^｜《》\n]+)《([^《》\n]+)》/);
                if (match) {
                    lineSsml += `<sub alias="${match[2]}">${match[1]}</sub>`;
                }
            } else {
                // Auto ruby using tokenizer
                const tokens = tokenizer.tokenize(segment);
                for (const token of tokens) {
                    const word = token.surface_form;
                    if (hasKanji(word) && token.reading && token.reading !== '*') {
                        const reading = katakanaToHiragana(token.reading);
                        if (word !== reading) {
                            lineSsml += `<sub alias="${reading}">${word}</sub>`;
                        } else {
                            lineSsml += word;
                        }
                    } else {
                        lineSsml += word;
                    }
                }
            }
        }
        ssml += `  ${lineSsml}\n`;
    }

    ssml += '</speak>';
    return ssml;
};

const exportSsmlBtn = document.getElementById('export-ssml-btn');
exportSsmlBtn.onclick = async () => {
    const ssml = generateSSML();
    if (!ssml) {
        alert('テキストを読み込んでから実行してください。');
        return;
    }

    try {
        await navigator.clipboard.writeText(ssml);
        const originalText = exportSsmlBtn.innerHTML;
        exportSsmlBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
        if (window.lucide) window.lucide.createIcons();
        
        setTimeout(() => {
            exportSsmlBtn.innerHTML = originalText;
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    } catch (err) {
        console.error('Failed to copy SSML:', err);
        alert('クリップボードへのコピーに失敗しました。');
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', init);
