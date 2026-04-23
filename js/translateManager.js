// js/translateManager.js
window.TranslateManager = (function() {
    // 마지막 언어 불러오기 (기본값 'ja')
    let currentLang = localStorage.getItem('aitomo_lang') || 'ja';

    function initGoogleTranslate() {
        if (document.getElementById('google-translate-script')) return;

        const gtDiv = document.createElement('div');
        gtDiv.id = 'google_translate_element';
        gtDiv.style.display = 'none';
        document.body.appendChild(gtDiv);

        const style = document.createElement('style');
        style.innerHTML = `
            iframe.goog-te-banner-frame,
            .goog-te-banner-frame.skiptranslate,
            .VIpgJd-ZVi9od-ORHb-OEVmcd,
            .VIpgJd-ZVi9od-aZ2wEe-wOHMyf,
            #goog-gt-tt, 
            .goog-te-balloon-frame,
            .goog-tooltip,
            .goog-tooltip:hover { 
                display: none !important; 
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
                opacity: 0 !important;
            }
            html, body { 
                top: 0px !important; 
                position: static !important;
            }
            .goog-text-highlight { background-color: transparent !important; border: none !important; box-shadow: none !important; }
        `;
        document.head.appendChild(style);

        window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement({pageLanguage: 'ko', autoDisplay: false}, 'google_translate_element');
        };

        const script = document.createElement('script');
        script.id = 'google-translate-script';
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.body.appendChild(script);

        // 구글 번역기 로드 후 기본 언어 설정
        setTimeout(() => {
            if (currentLang !== 'ko') {
                doGoogleTranslate(currentLang);
            }
        }, 1000);
    }

    function doGoogleTranslate(langCode) {
        const combo = document.querySelector('.goog-te-combo');
        if (combo) {
            if (combo.value !== langCode) {
                combo.value = langCode;
                combo.dispatchEvent(new Event('change'));
            }
        } else {
            setTimeout(() => doGoogleTranslate(langCode), 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGoogleTranslate);
    } else {
        initGoogleTranslate();
    }

    return {
        getLang: () => currentLang,
        setLang: (langCode) => {
            currentLang = langCode;
            localStorage.setItem('aitomo_lang', langCode);
            doGoogleTranslate(langCode);
            window.dispatchEvent(new CustomEvent('aitomo_lang_changed', { detail: langCode }));
        },
        toggleLang: () => {
            const newLang = currentLang === 'ko' ? 'ja' : 'ko';
            window.TranslateManager.setLang(newLang);
            return newLang;
        }
    };
})();
