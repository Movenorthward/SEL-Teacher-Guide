import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heart, 
  Send, 
  MessageCircle, 
  RefreshCw, 
  Copy, 
  BookOpen, 
  ShieldCheck, 
  UserCircle2, 
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Users,
  ChevronDown,
  Mic,
  MicOff,
  Globe,
  Waves,
  Layers,
  Key // 新增 Key icon
} from 'lucide-react';

const ROLES = ["老師", "家長", "學生", "行政人員", "校長", "教育局(處)長官", "新聞媒體"];
const SATIR_ROLES = ["學生", "老師", "家長", "行政人員", "校長", "教育局(處)長官"];

const SEL_TIPS = [
  { title: "自我覺察", content: "辨識自己當下的憤怒，承認「我現在很生氣」是處理情緒的第一步。", icon: <UserCircle2 className="w-5 h-5" /> },
  { title: "自我管理", content: "在按下傳送鍵前停頓 10 秒。深呼吸，問自己：這句話能解決問題還是製造問題？", icon: <ShieldCheck className="w-5 h-5" /> },
  { title: "社會覺察", content: "換位思考。家長的憤怒背後可能是焦慮，學生的反抗背後可能是挫折。", icon: <Users className="w-5 h-5" /> },
  { title: "人際技巧", content: "使用「我訊息」而非「你訊息」。例如：「我擔心孩子的進度」優於「你都不管孩子」。", icon: <MessageCircle className="w-5 h-5" /> },
  { title: "負責任的決定", content: "溝通的目標是「建立合作關係」，而非「分出對錯」。", icon: <Lightbulb className="w-5 h-5" /> },
];

const App = () => {
  // Global States
  const [activeTab, setActiveTab] = useState('transform');
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [userApiKey, setUserApiKey] = useState(""); // 新增 API Key 狀態
  
  // Voice Recognition States
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const activeTabRef = useRef(activeTab);

  // SEL Transform States
  const [input, setInput] = useState("");
  const [sender, setSender] = useState("老師");
  const [target, setTarget] = useState("家長");
  const [output, setOutput] = useState("");
  const [translatedOutput, setTranslatedOutput] = useState({ text: "", lang: null });
  const [translatingLang, setTranslatingLang] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Satir Transform States
  const [satirInput, setSatirInput] = useState("");
  const [satirSender, setSatirSender] = useState("老師");
  const [satirOutput, setSatirOutput] = useState(null); // Will hold JSON object
  const [satirLoading, setSatirLoading] = useState(false);
  const [satirError, setSatirError] = useState(null);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-TW';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        if (activeTabRef.current === 'transform') {
          setInput(prev => prev + transcript);
        } else if (activeTabRef.current === 'satir') {
          setSatirInput(prev => prev + transcript);
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("您的瀏覽器不支援語音輸入功能，建議使用 Chrome 瀏覽器。");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  // --- Core API Function ---
  const fetchGeminiApi = async (systemPrompt, userQuery, schema = null) => {
    if (!userApiKey.trim()) {
      throw new Error("請先在頁面上方輸入您的 Gemini API Key 才能使用 AI 功能喔！");
    }

    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      try {
        const payload = {
          contents: [{ role: "user", parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        };

        if (schema) {
          payload.generationConfig = {
            responseMimeType: "application/json",
            responseSchema: schema
          };
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${userApiKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 400) {
            throw new Error('API Key 格式錯誤或無效，請檢查後重新輸入。');
          }
          throw new Error(`API 請求失敗 (狀態碼: ${response.status})`);
        }
        
        const data = await response.json();

        // 1. 檢查輸入階段是否被核心安全機制直接阻擋
        if (data.promptFeedback?.blockReason) {
          throw new Error(`輸入文字被 AI 底層安全機制攔截 (原因: ${data.promptFeedback.blockReason})。請稍作修飾後重試。`);
        }
        
        const candidate = data.candidates?.[0];
        
        // 2. 檢查生成階段是否被中斷
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
          throw new Error(`生成過程被安全機制中斷 (原因: ${candidate.finishReason})。`);
        }

        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('系統暫時無法解析這段文字，請稍後再試一次。');
        }
        return text;
      } catch (err) {
        if (retries > 0 && !err.message.includes('400') && !err.message.includes('安全機制') && !err.message.includes('API Key')) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(retries - 1, delay * 2);
        }
        throw err;
      }
    };
    return await fetchWithRetry();
  };

  // --- SEL Transform Action ---
  const handleTransform = async () => {
    if (!input.trim()) return;
    if (isListening) recognitionRef.current.stop();
    setLoading(true); setError(null); setTranslatedOutput({ text: "", lang: null });

    const systemPrompt = `你是一位資深的教育心理顧問與公共關係專家，精通 SEL（社會情緒學習）原則。
任務：將【${sender}】在情緒化或面臨突發狀況時想對【${target}】說的話，轉化為「溫暖、專業、具有同理心且符合雙方身分」的溝通文字。
重點：
1. 依據雙方身分與權力關係調整語氣。
2. 若對象為【新聞媒體】，請產出適合公眾發布、安定人心、客觀的官方聲明。
3. 去除情緒化與責備詞彙，加入同理心，聚焦於「解決問題」。
4. 直接輸出轉換後的文字，不包含前言。`;

    try {
      const result = await fetchGeminiApi(systemPrompt, `發話者是 [${sender}]，對象是 [${target}]，請轉化這段話：\n\n"${input}"`);
      setOutput(result.trim());
    } catch (err) {
      setError(err.message || "轉化失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  // --- Translation Action ---
  const handleTranslate = async (lang) => {
    if (!output || translatingLang) return;
    setTranslatingLang(lang); setError(null);
    const langName = lang === 'en' ? '簡單易懂的英文 (Simple English)' : '日文 (Japanese)';
    const systemPrompt = `你是一個專業的翻譯顧問。請將教育溝通文字翻譯成【${langName}】。
要求：語氣維持溫暖專業。英文使用簡單字彙，日文使用合適的敬語。直接輸出翻譯結果。`;

    try {
      const result = await fetchGeminiApi(systemPrompt, `請翻譯以下文字：\n\n"${output}"`);
      setTranslatedOutput({ text: result.trim(), lang });
    } catch (err) {
      setError(err.message || "翻譯失敗，請稍後再試。");
    } finally {
      setTranslatingLang(null);
    }
  };

  // --- Satir Transform Action ---
  const handleSatirTransform = async () => {
    if (!satirInput.trim()) return;
    if (isListening) recognitionRef.current.stop();
    setSatirLoading(true); setSatirError(null); setSatirOutput(null);

    const satirSchema = {
      type: "OBJECT",
      properties: {
        behavior: { type: "STRING", description: "行為層（水面上）：簡述這句話表現出的行為或外顯態度" },
        feeling: { type: "STRING", description: "感受層：這句話背後隱藏的真實情緒感受" },
        belief: { type: "STRING", description: "觀點層：發話者對事情的解讀與信念" },
        expectation: { type: "STRING", description: "期待層：對自己或他人的期望" },
        yearning: { type: "STRING", description: "渴望層：最深的需求（愛、接納、價值感等）" },
        satir_response: { type: "STRING", description: "薩提爾式回應：充滿好奇、接納與同理的一致型溝通回應" }
      },
      required: ["behavior", "feeling", "belief", "expectation", "yearning", "satir_response"]
    };

    const systemPrompt = `你是一位精通薩提爾（Satir）模式的心理專家。任務是剖析【${satirSender}】想說的話，深入冰山理論的各個層次，最後給予一段溫暖接納的「薩提爾式回應」。請依照 JSON 格式輸出結構化分析。`;

    try {
      let resultStr = await fetchGeminiApi(systemPrompt, `發話身份：[${satirSender}]。請分析並回應這段話：\n\n"${satirInput}"`, satirSchema);
      
      resultStr = resultStr.trim();
      if (resultStr.startsWith('```')) {
        resultStr = resultStr.replace(/^`{3}(?:json)?\n?/, '').replace(/\n?`{3}$/, '');
      }

      setSatirOutput(JSON.parse(resultStr));
    } catch (err) {
      setSatirError(err.message || "探索失敗，請稍後再試。");
    } finally {
      setSatirLoading(false);
    }
  };

  // UI Components
  const RoleSelector = ({ label, value, onChange, icon: Icon, options, colorTheme = "rose" }) => (
    <div>
      <label className="flex items-center gap-1.5 text-[0.77rem] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        <Icon className="w-4 h-4" /> {label}
      </label>
      <div className="relative">
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold focus:outline-none transition-all cursor-pointer ${colorTheme === 'indigo' ? 'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' : 'focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'}`}
        >
          {options.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-slate-800 p-4 md:p-8" style={{
      backgroundColor: '#fdf8f3',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(201,64,64,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(201,122,42,0.04) 0%, transparent 60%)'
    }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 shadow-md">
            <Sparkles className="w-3.5 h-3.5" /> SEL 教育工具
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 font-serif">導師暖心教戰手則</h1>
          <p className="text-slate-500 text-sm md:text-base">用愛與技術，轉化每一個溝通瞬間</p>
        </header>

        {/* API Key Input Section (開源版專用) */}
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-4 rounded-2xl mb-6 shadow-sm flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm whitespace-nowrap">
            <Key className="w-4 h-4 text-rose-500" /> API 設定
          </div>
          <input
            type="password"
            placeholder="請貼上您的 Google Gemini API Key (不會儲存，僅供本次網頁執行使用)"
            value={userApiKey}
            onChange={(e) => setUserApiKey(e.target.value)}
            className="flex-1 w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 transition-all text-sm font-mono placeholder:font-sans"
          />
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noreferrer" 
            className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap font-medium flex items-center gap-1"
          >
            取得免費 API Key <Globe className="w-3 h-3"/>
          </a>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row bg-white/80 backdrop-blur-md border border-slate-200/60 p-1.5 rounded-2xl mb-8 shadow-sm gap-1">
          <button 
            onClick={() => setActiveTab('transform')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'transform' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 情緒轉化器
          </button>
          <button 
            onClick={() => setActiveTab('satir')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'satir' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
          >
            <Layers className="w-4 h-4" /> 薩提爾對話
          </button>
          <button 
            onClick={() => setActiveTab('tips')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'tips' ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' : 'text-slate-500 hover:bg-teal-50 hover:text-teal-600'}`}
          >
            <BookOpen className="w-4 h-4" /> SEL 教戰錦囊
          </button>
        </div>

        {/* --- Tab: SEL Transform --- */}
        {activeTab === 'transform' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Input Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-5">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" /> 原始情緒文字
              </div>
              <div className="grid grid-cols-2 gap-4">
                <RoleSelector label="你的角色" value={sender} onChange={setSender} icon={UserCircle2} options={ROLES} />
                <RoleSelector label="對話對象" value={target} onChange={setTarget} icon={Users} options={ROLES} />
              </div>
              <div className="flex flex-col flex-grow">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-[0.77rem] font-bold text-slate-500 uppercase tracking-wider">
                    <MessageCircle className="w-4 h-4" /> 輸入內容
                  </span>
                  <button onClick={toggleListening} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${isListening ? 'bg-rose-600 text-white border-rose-600 animate-pulse' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300 hover:text-rose-500'}`}>
                    {isListening ? <><Mic className="w-3.5 h-3.5" /> 聆聽中...</> : <><MicOff className="w-3.5 h-3.5" /> 語音輸入</>}
                  </button>
                </div>
                <textarea
                  className="w-full flex-grow min-h-[160px] p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 transition-all resize-none text-slate-700 leading-relaxed"
                  placeholder={`作為${sender}，想對${target}說什麼？可以直接寫下情緒話...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <button onClick={handleTransform} disabled={loading || !input.trim()} className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-rose-600/20 disabled:shadow-none">
                {loading ? <><RefreshCw className="w-5 h-5 animate-spin" /> AI 轉化中...</> : <><Send className="w-5 h-5" /> 轉化暖心回應</>}
              </button>
            </div>

            {/* Output Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-teal-600 font-bold text-sm uppercase tracking-wider mb-1">
                <Heart className="w-4 h-4 fill-current" /> SEL 暖心建議回應
              </div>
              <div className={`flex-grow bg-teal-50/50 border-2 border-teal-100/60 rounded-2xl p-5 transition-all ${loading ? 'opacity-50 blur-[2px]' : 'opacity-100'}`}>
                {error ? (
                  <div className="text-rose-500 flex items-center gap-2 text-sm font-medium"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>
                ) : output ? (
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{output}</p>
                ) : (
                  <p className="text-slate-400 italic text-sm">在上方貼上 API Key，輸入文字並選好角色後點擊按鈕開始轉化...</p>
                )}
              </div>

              {output && (
                <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-300">
                  <button onClick={() => copyToClipboard(output)} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    <Copy className="w-4 h-4" /> 複製建議文字
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => handleTranslate('en')} disabled={!!translatingLang} className="flex-1 py-2.5 bg-blue-50 text-blue-700 border-2 border-blue-100 hover:bg-blue-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm">
                      {translatingLang === 'en' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} 英文翻譯
                    </button>
                    <button onClick={() => handleTranslate('ja')} disabled={!!translatingLang} className="flex-1 py-2.5 bg-rose-50 text-rose-700 border-2 border-rose-100 hover:bg-rose-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm">
                      {translatingLang === 'ja' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} 日文翻譯
                    </button>
                  </div>
                </div>
              )}

              {/* Translation Result Box */}
              {translatedOutput.text && (
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 mt-1 animate-in slide-in-from-top-4 fade-in duration-300 relative group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{translatedOutput.lang === 'en' ? 'English' : '日本語'}</span>
                    <button onClick={() => copyToClipboard(translatedOutput.text)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 bg-white rounded-md shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">{translatedOutput.text}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Tab: Satir Transform --- */}
        {activeTab === 'satir' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Input Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-5">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                  <Waves className="w-4 h-4" /> 說出你心裡的話
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <RoleSelector label="你的身份" value={satirSender} onChange={setSatirSender} icon={UserCircle2} options={SATIR_ROLES} colorTheme="indigo" />
                </div>
                <div className="flex flex-col flex-grow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[0.77rem] font-bold text-slate-500 uppercase tracking-wider">
                      <MessageCircle className="w-4 h-4" /> 輸入一句話
                    </span>
                    <button onClick={toggleListening} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${isListening ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-500'}`}>
                      {isListening ? <><Mic className="w-3.5 h-3.5" /> 聆聽中...</> : <><MicOff className="w-3.5 h-3.5" /> 語音輸入</>}
                    </button>
                  </div>
                  <textarea
                    className="w-full flex-grow min-h-[120px] p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none text-slate-700 leading-relaxed"
                    placeholder={`以 ${satirSender} 的身份，說出你現在最想說的一句話...\n例如：「我真的不想管了」`}
                    value={satirInput}
                    onChange={(e) => setSatirInput(e.target.value)}
                  />
                </div>
                <button onClick={handleSatirTransform} disabled={satirLoading || !satirInput.trim()} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 disabled:shadow-none">
                  {satirLoading ? <><RefreshCw className="w-5 h-5 animate-spin" /> 冰山探索中...</> : <><Layers className="w-5 h-5" /> 探索我的冰山</>}
                </button>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs leading-relaxed font-medium">
                  <span className="font-bold">💡 使用提示：</span>直接說出你此刻「最想說的話」，不需要修飾。AI 將引導你看見話語背後更深的自己。
                </div>
              </div>

              {/* Output Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider mb-1">
                  <Heart className="w-4 h-4 fill-current" /> 冰山探索結果
                </div>
                
                <div className={`flex-grow bg-indigo-50/40 border-2 border-indigo-100/60 rounded-2xl p-5 overflow-y-auto max-h-[500px] transition-all ${satirLoading ? 'opacity-50 blur-[2px]' : 'opacity-100'}`}>
                  {satirError ? (
                    <div className="text-rose-500 flex items-center gap-2 text-sm font-medium"><AlertCircle className="w-4 h-4 shrink-0" /> {satirError}</div>
                  ) : satirOutput ? (
                    <div className="flex flex-col gap-3">
                      {/* Response Layer */}
                      <div className="bg-indigo-100 border border-indigo-200 rounded-xl p-3.5 animate-in slide-in-from-right-4 fade-in">
                        <div className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1.5 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> 薩提爾式回應</div>
                        <div className="text-sm leading-relaxed text-indigo-950 font-medium">{satirOutput.satir_response}</div>
                      </div>
                      {/* Iceberg Layers */}
                      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 animate-in slide-in-from-right-4 fade-in" style={{animationDelay: '100ms'}}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-1">🌊 行為層（水面上）</div>
                        <div className="text-sm text-sky-900">{satirOutput.behavior}</div>
                      </div>
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 animate-in slide-in-from-right-4 fade-in" style={{animationDelay: '150ms'}}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700 mb-1">💜 感受層</div>
                        <div className="text-sm text-violet-900">{satirOutput.feeling}</div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 animate-in slide-in-from-right-4 fade-in" style={{animationDelay: '200ms'}}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">🌟 觀點層</div>
                        <div className="text-sm text-amber-900">{satirOutput.belief}</div>
                      </div>
                      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 animate-in slide-in-from-right-4 fade-in" style={{animationDelay: '250ms'}}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-pink-700 mb-1">💗 期待層</div>
                        <div className="text-sm text-pink-900">{satirOutput.expectation}</div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 animate-in slide-in-from-right-4 fade-in" style={{animationDelay: '300ms'}}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">🌱 渴望層</div>
                        <div className="text-sm text-emerald-900">{satirOutput.yearning}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-sm text-center mt-10">貼上 API Key、輸入你的話，AI 將帶你探索冰山下的自己...</p>
                  )}
                </div>

                {satirOutput && (
                  <button onClick={() => copyToClipboard(satirOutput.satir_response)} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2">
                    <Copy className="w-4 h-4" /> 複製薩提爾回應
                  </button>
                )}
              </div>
            </div>

            {/* Iceberg Explanation Reference */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider mb-2">
                  <Layers className="w-4 h-4" /> 薩提爾冰山理論
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">薩提爾認為，我們說出來的話只是「冰山一角」。真正重要的是水面下層層堆疊的感受、觀點、期待與渴望。透過好奇心與一致型溝通，我們能融化冰山、建立深度連結。</p>
              </div>
              <div className="flex-1 w-full grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="bg-sky-50 text-sky-800 border border-sky-200 p-2 rounded-lg flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div> 行為 (水面)</div>
                <div className="bg-violet-50 text-violet-800 border border-violet-200 p-2 rounded-lg flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div> 感受</div>
                <div className="bg-amber-50 text-amber-800 border border-amber-200 p-2 rounded-lg flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 觀點</div>
                <div className="bg-pink-50 text-pink-800 border border-pink-200 p-2 rounded-lg flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div> 期待</div>
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded-lg flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> 渴望</div>
                <div className="bg-slate-800 text-slate-200 border border-slate-700 p-2 rounded-lg flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> 自我 (最深)</div>
              </div>
            </div>
          </div>
        )}

        {/* --- Tab: Tips --- */}
        {activeTab === 'tips' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {SEL_TIPS.map((tip, index) => (
              <div key={index} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-teal-200 hover:-translate-y-1 transition-all group">
                <div className="bg-teal-50 text-teal-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                  {tip.icon}
                </div>
                <h3 className="font-bold text-lg mb-2 text-slate-800 font-serif">{tip.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{tip.content}</p>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3 bg-slate-900 text-white p-8 rounded-[2rem] mt-2 relative overflow-hidden shadow-xl">
              <div className="relative z-10 max-w-2xl">
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2 font-serif">
                  <Heart className="text-rose-500 fill-rose-500" /> 老師，別忘了照顧自己
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  語音輸入可以幫助您在情緒最飽滿的當下先抒發出來，再交給 AI 幫您轉化為專業的回應。這也是一種「自我管理」的練習。所有的情緒都是真實且值得被接納的。
                </p>
              </div>
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {showCopySuccess && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-full flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 已複製到剪貼簿
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-slate-400 text-xs font-medium tracking-wide">
          <p>開源版本 | 需自備 Google Gemini API Key 運行</p>
          <p className="mt-1">© 2026 國中創新方案大觀國中第三組</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
