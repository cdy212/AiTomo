// VoiceManager 모듈 (voiceManager.js)
// Web Speech API를 활용하여 전역에서 마이크 입력을 제어하고 언어 선택을 토글합니다.

window.VoiceManager = (function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let currentLang = localStorage.getItem('aitomo_voice_lang') || 'ko-KR';

    // 전역 커스텀 이벤트를 발생시켜 다른 페이지/컴포넌트도 알 수 있게 함
    function dispatchLangChangeEvent() {
        window.dispatchEvent(new CustomEvent('aitomo_lang_changed', { detail: currentLang }));
    }

    return {
        isSupported: !!SpeechRecognition,
        
        getLang: () => currentLang,
        
        setLang: (lang) => {
            currentLang = lang;
            localStorage.setItem('aitomo_voice_lang', lang);
            dispatchLangChangeEvent();
        },
        
        toggleLang: () => {
            currentLang = (currentLang === 'ko-KR') ? 'ja-JP' : 'ko-KR';
            localStorage.setItem('aitomo_voice_lang', currentLang);
            dispatchLangChangeEvent();
            return currentLang;
        },

        startRecognition: (options) => {
            if (!SpeechRecognition) {
                if (options && options.onError) {
                    options.onError(new Error("음성 인식을 지원하지 않는 브라우저입니다."));
                }
                return null;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = currentLang;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            if (options && options.onStart) {
                recognition.onstart = options.onStart;
            }

            if (options && options.onResult) {
                recognition.onresult = function(event) {
                    const speechResult = event.results[0][0].transcript;
                    options.onResult(speechResult);
                };
            }

            if (options && options.onError) {
                recognition.onerror = function(event) {
                    options.onError(event);
                };
            }

            if (options && options.onEnd) {
                recognition.onend = options.onEnd;
            }

            // 안전장치로 말하기가 끝나면 곧바로 stop() 호출
            recognition.onspeechend = function() {
                recognition.stop();
            };

            try {
                recognition.start();
            } catch (e) {
                if (options && options.onError) options.onError(e);
            }
            return recognition;
        }
    };
})();
