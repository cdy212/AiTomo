// VoiceManager 모듈 (voiceManager.js)
// Web Speech API를 활용하여 전역에서 마이크 입력을 제어하고 언어 선택을 토글합니다.

window.VoiceManager = (function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function getVoiceLang() {
        if (window.TranslateManager) {
            return window.TranslateManager.getLang() === 'ko' ? 'ko-KR' : 'ja-JP';
        }
        const saved = localStorage.getItem('aitomo_lang');
        return saved === 'ko' ? 'ko-KR' : 'ja-JP';
    }

    function dispatchLangChangeEvent() {
        window.dispatchEvent(new CustomEvent('aitomo_voice_lang_changed', { detail: getVoiceLang() }));
    }

    // TranslateManager 변경 시 VoiceManager도 이벤트 발생 (호환성 목적)
    window.addEventListener('aitomo_lang_changed', dispatchLangChangeEvent);

    return {
        isSupported: !!SpeechRecognition,
        getLang: getVoiceLang,
        setLang: (lang) => {
            // 이제 TranslateManager가 기준이 됨
        },
        toggleLang: () => {
            if (window.TranslateManager) {
                window.TranslateManager.toggleLang();
            }
            return getVoiceLang();
        },

        startRecognition: (options) => {
            if (!SpeechRecognition) {
                if (options && options.onError) {
                    options.onError(new Error("음성 인식을 지원하지 않는 브라우저입니다."));
                }
                return null;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = getVoiceLang();
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
