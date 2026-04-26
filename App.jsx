import React, { useState, useRef, useEffect } from 'react';

import {
  Video,
  Mic,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  AlertTriangle,
  DownloadCloud,
  Settings,
  Camera,
  CheckCircle2,
  PauseCircle,
  Target,
  FileText,
  Layers,
  Upload,
  Zap,
  UserCircle,
  ScanEye,
  Film,
  Play,
  Activity,
  Heart,
  MessageCircle,
  Share2,
  ShoppingBag,
} from 'lucide-react';

// --- دالة تحويل الصوت الخاص بـ Gemini ---
function pcmToWav(base64Pcm, sampleRate = 24000) {
  try {
    let safeBase64 = base64Pcm.replace(/-/g, '+').replace(/_/g, '/');
    while (safeBase64.length % 4) {
      safeBase64 += '=';
    }
    const binaryString = atob(safeBase64);
    const pcmBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++)
      pcmBuffer[i] = binaryString.charCodeAt(i);
    const numChannels = 1,
      bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8),
      blockAlign = numChannels * (bitsPerSample / 8);
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (v, offset, str) => {
      for (let i = 0; i < str.length; i++)
        v.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmBuffer.byteLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, pcmBuffer.byteLength, true);
    const wavBytes = new Uint8Array(44 + pcmBuffer.byteLength);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(new Uint8Array(pcmBuffer), 44);
    return new Blob([wavBytes], { type: 'audio/wav' });
  } catch (e) {
    return null;
  }
}

const downloadFile = async (url, filename) => {
  if (!url || url.startsWith('webspeech:')) return;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    window.open(url, '_blank');
  }
};

// ⚡️ قائمة اللهجات العربية الكاملة
const ARABIC_DIALECTS = [
  { value: 'لهجة خليجية سعودية', label: '🇸🇦 خليجية سعودية' },
  { value: 'لهجة إماراتية خليجية', label: '🇦🇪 إماراتية' },
  { value: 'لهجة كويتية خليجية', label: '🇰🇼 كويتية' },
  { value: 'لهجة قطرية خليجية', label: '🇶🇦 قطرية' },
  { value: 'لهجة بحرينية خليجية', label: '🇧🇭 بحرينية' },
  { value: 'لهجة عُمانية خليجية', label: '🇴🇲 عُمانية' },
  { value: 'لهجة يمنية', label: '🇾🇪 يمنية' },
  { value: 'لهجة مصرية قاهرية', label: '🇪🇬 مصرية (قاهرة)' },
  { value: 'لهجة مصرية صعيدية', label: '🇪🇬 مصرية (صعيد)' },
  { value: 'لهجة شامية سورية دمشقية', label: '🇸🇾 شامية سورية' },
  { value: 'لهجة لبنانية بيروتية', label: '🇱🇧 لبنانية' },
  { value: 'لهجة أردنية عمّانية', label: '🇯🇴 أردنية' },
  { value: 'لهجة فلسطينية', label: '🇵🇸 فلسطينية' },
  { value: 'لهجة عراقية بغدادية', label: '🇮🇶 عراقية (بغداد)' },
  { value: 'لهجة عراقية جنوبية بصرية', label: '🇮🇶 عراقية (بصرة)' },
  { value: 'لهجة مغربية دارجة', label: '🇲🇦 مغربية (دارجة)' },
  { value: 'لهجة جزائرية', label: '🇩🇿 جزائرية' },
  { value: 'لهجة تونسية', label: '🇹🇳 تونسية' },
  { value: 'لهجة ليبية طرابلسية', label: '🇱🇾 ليبية' },
  { value: 'لهجة سودانية خرطومية', label: '🇸🇩 سودانية' },
  { value: 'فصحى حديثة معاصرة', label: '📖 فصحى حديثة' },
];

// ⚡️ نظام الستايلات البصرية الصارم (Faceless Only)
const visualStyles = {
  ugc: {
    pos: ', aesthetic product display, tiktok aesthetic, extreme close up of product, natural lighting, highly detailed, photorealistic',
    neg: 'face, person, human, man, woman, hands, fingers, avatar, 3d, cartoon, illustration, drawing, scary, blurry',
  },
  studio: {
    pos: ', high-end commercial product photography, minimalist background, studio lighting, crisp focus, 8k resolution, elegant',
    neg: 'face, person, human, hands, fingers, 3d, cartoon, amateur, blurry, messy background, illustration',
  },
  cinematic: {
    pos: ', cinematic product shot, dramatic lighting, 35mm lens, moody aesthetic, highly detailed macro shot, luxurious',
    neg: 'face, person, human, hands, fingers, 3d, cartoon, bright studio, amateur, illustration',
  },
};

// ⚡️ مبرمج الأبعاد الخاصة بالمنصات
const getPlatformConfig = (platformCode) => {
  switch (platformCode) {
    case 'facebook':
      return {
        name: 'Facebook/IG Feed (1:1)',
        w: 1024,
        h: 1024,
        dalle: '1024x1024',
        ratio: 1,
        previewH: '360px',
        thumbH: '100px',
        htmlW: '500px',
        htmlH: '500px',
      };
    case 'youtube':
      return {
        name: 'YouTube (16:9)',
        w: 1280,
        h: 720,
        dalle: '1792x1024',
        ratio: 16 / 9,
        previewH: '202px',
        thumbH: '56px',
        htmlW: '800px',
        htmlH: '450px',
      };
    case 'snapchat':
      return {
        name: 'Snapchat (9:16)',
        w: 720,
        h: 1280,
        dalle: '1024x1792',
        ratio: 9 / 16,
        previewH: '640px',
        thumbH: '177px',
        htmlW: '400px',
        htmlH: '711px',
      };
    default:
      return {
        name: 'TikTok/Reels (9:16)',
        w: 720,
        h: 1280,
        dalle: '1024x1792',
        ratio: 9 / 16,
        previewH: '640px',
        thumbH: '177px',
        htmlW: '400px',
        htmlH: '711px',
      };
  }
};

const getVideoTypeName = (typeCode) => {
  switch (typeCode) {
    case 'promo':
      return 'فيديو ترويجي احترافي (Promo)';
    case 'story':
      return 'قصة نجاح وتجربة (Storytelling)';
    case 'howto':
      return 'شرح طريقة الاستخدام (How-to)';
    default:
      return 'محتوى مستخدم عفوي (UGC)';
  }
};

// مجموعة صور بديلة احترافية لضمان عدم وجود أي مساحة فارغة
const fallbackImages = [
  'https://images.unsplash.com/photo-1618220179428-22790b46a0eb?q=80&w=720&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1608248593842-8010b979e2bd?q=80&w=720&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=720&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571781526291-c477eb69ddc3?q=80&w=720&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=720&auto=format&fit=crop',
];

// ✅ إصلاح #1: دالة محسّنة لتوليد الصور مع preload حقيقي
const getFreeImageUrl = (
  prompt,
  styleKey,
  width = 720,
  height = 1280,
  sceneIndex = 0
) => {
  let safePrompt = String(prompt || '')
    .replace(/[^a-zA-Z0-9\s,]/g, '')
    .trim();
  safePrompt = safePrompt
    .replace(
      /\b(person|man|woman|girl|boy|face|hand|hands|fingers|people|human|avatar)\b/gi,
      ''
    )
    .trim();
  if (safePrompt.length < 3)
    safePrompt = 'aesthetic commercial product display';
  const seed = Math.floor(Math.random() * 10000000) + sceneIndex;
  const style = visualStyles[styleKey] || visualStyles.studio;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    safePrompt + style.pos
  )}?width=${width}&height=${height}&nologo=true&seed=${seed}&negative=${encodeURIComponent(
    style.neg
  )}`;
};

// ✅ إصلاح #1: دالة preload الصورة مع fallback تلقائي
const preloadImage = (url, fallbackUrl) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(fallbackUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => {
      resolve(fallbackUrl);
    }, 15000); // 15 ثانية timeout
    img.onload = () => {
      clearTimeout(timeout);
      resolve(url);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(fallbackUrl);
    };
    img.src = url;
  });
};

export default function VideoAdGenerator() {
  const [isReady, setIsReady] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [inputs, setInputs] = useState({
    productName: '',
    targetAudience: '',
    mainBenefit: '',
    dialect: 'لهجة خليجية سعودية',
    voiceType: 'Male',
    useDalle: false,
    customScript: '',
    visualStyle: 'studio',
    generateImages: true,
    targetPlatform: 'tiktok',
    videoType: 'ugc',
  });
  const [loading, setLoading] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [videoScenes, setVideoScenes] = useState([]);
  const [productImage, setProductImage] = useState(null);
  const [avatarImage, setAvatarImage] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIdx, setCurrentSceneIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  // ⚡️ متغيرات شاشة نجاح التحميل الآمنة
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [videoExtension, setVideoExtension] = useState('mp4');
  const [liveTextChunk, setLiveTextChunk] = useState('');
  // ✅ إصلاح #1: state لتتبع حالة تحميل الصور
  const [imageLoadStates, setImageLoadStates] = useState({});
  const audioRef = useRef(null);
  const bgMusicRef = useRef(null);

  useEffect(() => {
    const loadAssets = () => {
      if (!document.getElementById('cairo-font')) {
        const link = document.createElement('link');
        link.id = 'cairo-font';
        link.href =
          'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      if (!document.getElementById('tailwind-script')) {
        const script = document.createElement('script');
        script.id = 'tailwind-script';
        script.src = 'https://cdn.tailwindcss.com';
        script.onload = () => {
          if (window.tailwind) {
            window.tailwind.config = {
              theme: {
                extend: { fontFamily: { sans: ['Cairo', 'sans-serif'] } },
              },
            };
          }
          setIsReady(true);
        };
        document.head.appendChild(script);
      } else {
        setIsReady(true);
      }
      document.body.style.backgroundColor = '#0f172a';
      document.body.style.margin = '0';
    };
    loadAssets();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const processImageFile = (file, setter) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024)
      return alert('حجم الصورة يجب أن يكون أقل من 5 ميجابايت.');
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      const mimeType = base64String.split(';')[0].split(':')[1];
      const data = base64String.split(',')[1];
      setter({ dataUrl: base64String, mimeType, data });
    };
    reader.readAsDataURL(file);
  };

  // ✅ دالة مساعدة تستدعي الـ proxy بدل Gemini مباشرة
  const geminiProxy = async (endpoint, body) => {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, apiKey: geminiKey.trim(), body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `خطأ ${res.status} من الخادم`);
    }
    return res.json();
  };

  const getAvailableModel = async () => {
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey.trim() }),
      });
      if (!res.ok) throw new Error('مفتاح Gemini غير صالح.');
      const data = await res.json();
      const validModels = (data.models || []).filter((m) =>
        m.supportedGenerationMethods?.includes('generateContent')
      );
      const selected =
        validModels.find((m) => m.name.includes('gemini-2.5-flash')) ||
        validModels.find((m) => m.name.includes('gemini-1.5-flash'));
      if (!selected)
        throw new Error('لم يتم العثور على موديلات متوافقة في حسابك.');
      return selected.name;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const analyzeProductImage = async () => {
    if (!productImage || !geminiKey)
      return setError('الرجاء رفع صورة المنتج وإدخال مفتاح Gemini أولاً.');
    setAnalyzingImage(true);
    setError('');
    try {
      const workingModelName = await getAvailableModel();
      const prompt = `استخرج اسماً تسويقياً جذاباً، الجمهور المستهدف الدقيق، والفائدة الكبرى لهذا المنتج. رد بـ JSON: {"productName": "","targetAudience": "","mainBenefit": ""}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: productImage.mimeType,
                  data: productImage.data,
                },
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      };
      const data = await geminiProxy(`${workingModelName}:generateContent`, payload);
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('استجابة السيرفر كانت فارغة.');
      rawText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsedData = JSON.parse(rawText);
      setInputs((prev) => ({
        ...prev,
        productName:
          typeof parsedData.productName === 'string'
            ? parsedData.productName
            : prev.productName,
        targetAudience:
          typeof parsedData.targetAudience === 'string'
            ? parsedData.targetAudience
            : prev.targetAudience,
        mainBenefit:
          typeof parsedData.mainBenefit === 'string'
            ? parsedData.mainBenefit
            : prev.mainBenefit,
      }));
    } catch (err) {
      setError('خطأ في التحليل: ' + err.message);
    }
    setAnalyzingImage(false);
  };

  const generateAdVideo = async () => {
    if (!geminiKey.trim())
      return setError(
        '⚠️ مفتاح Gemini مطلوب لتأليف السكريبت وتوليد الصوت الخرافي.'
      );
    if (!inputs.customScript && (!inputs.productName || !inputs.mainBenefit))
      return setError('⚠️ أدخل اسم المنتج والفائدة، أو قم بلصق سكريبت خاص بك.');
    setLoading(true);
    setError('');
    setVideoScenes([]);
    setImageLoadStates({});
    setIsPlaying(false);
    setCurrentSceneIndex(0);
    setProgress(0);

    const platformConfig = getPlatformConfig(inputs.targetPlatform);
    const videoTypeName = getVideoTypeName(inputs.videoType);

    try {
      setLoadingText('1. فحص الخوادم المتاحة...');
      const workingModelName = await getAvailableModel();
      setLoadingText(
        `2. جاري هندسة السكريبت الإعلاني (${platformConfig.name})...`
      );
      let promptText = '';
      if (inputs.customScript.trim()) {
        promptText = `أنت مخرج إعلانات. قسم هذا السكريبت إلى 4 مشاهد بالضبط: """${inputs.customScript}"""
            المطلوب: 1. قسمه لـ 4 مشاهد. 2. لا تغير الصوت. 
            3. لكل مشهد استنتج وصف بصري باللغة الإنجليزية (English ONLY) خالي من الرموز.
            🚨 قاعدة صارمة جداً: ممنوع منعاً باتاً ذكر أشخاص أو وجوه أو أيدي (NO PEOPLE, NO FACES, NO HANDS). ركز الوصف البصري على: المنتج بحد ذاته (Product shot) أو بيئة الاستخدام فقط.`;
      } else {
        promptText = `أنت مخرج إعلانات محترف لمنصة ${platformConfig.name}. اكتب سكريبت إعلاني بنمط "${videoTypeName}" من 4 مشاهد بالضبط لمنتج: "${inputs.productName}". الجمهور: ${inputs.targetAudience}. الفائدة: ${inputs.mainBenefit}.
            🗣️ مهم جداً: اكتب النص بـ${inputs.dialect} بشكل طبيعي وعفوي كما يتكلم الناس في الشارع — استخدم كلمات بسيطة ومألوفة لهذه اللهجة فقط. تجنب الفصحى تماماً.
            - المشهد 1: Hook يخطف الانتباه.
            - باقي المشاهد: عرض المشكلة والحل، ثم دعوة للعمل.
            - visual_prompt: توجيه باللغة الإنجليزية (English ONLY).
            🚨 قاعدة صارمة جداً لتجنب التشوهات البصرية: ممنوع ذكر أي بشر أو وجوه (NO PEOPLE, NO FACES). اجعل الوصف يركز حصراً على المنتج بتصوير مقرب (Macro product shot) أو في بيئة جذابة.`;
      }

      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              scenes: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    visual_prompt: { type: 'STRING' },
                    audio_text: { type: 'STRING' },
                  },
                },
              },
            },
          },
        },
      };

      const scriptData = await geminiProxy(`${workingModelName}:generateContent`, payload);
      let rawText = scriptData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText)
        throw new Error(
          'تم رفض الطلب من قبل الذكاء الاصطناعي بسبب سياسات الحماية أو الكلمات المستخدمة.'
        );
      rawText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      let parsedScript = [];
      try {
        const parsed = JSON.parse(rawText);
        parsedScript = Array.isArray(parsed.scenes)
          ? parsed.scenes
          : Array.isArray(parsed)
          ? parsed
          : [];
      } catch (e) {
        throw new Error('فشل في قراءة هيكل السكريبت من الذكاء الاصطناعي.');
      }
      if (parsedScript.length === 0)
        throw new Error('السكريبت المولد لا يحتوي على مشاهد صالحة.');

      setLoadingText(
        '3. جاري تسجيل التعليق الصوتي وتطبيق الذكاء البصري الصافي...'
      );

      const generatedScenes = await Promise.all(
        parsedScript.map(async (scene, index) => {
          const safeVisualPrompt = String(scene?.visual_prompt || '');
          const safeAudioText = String(scene?.audio_text || '');
          let audioUrl = '';
          let imageUrl = '';
          let userMediaUrl = null;
          let userMediaType = null;

          if (index === 0 && avatarImage) {
            userMediaUrl = avatarImage.dataUrl;
            userMediaType = 'image';
          } else if (index === parsedScript.length - 1 && productImage) {
            userMediaUrl = productImage.dataUrl;
            userMediaType = 'image';
          } else if (inputs.generateImages) {
            if (inputs.useDalle && openaiKey) {
              try {
                const realismPrompt = `Format suitable for ${
                  platformConfig.name
                }. High quality product photography. NO FACES, NO PEOPLE, NO HANDS. Subject: ${safeVisualPrompt.replace(
                  /[^a-zA-Z0-9\s,]/g,
                  ''
                )}`;
                const imgRes = await fetch(
                  'https://api.openai.com/v1/images/generations',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${openaiKey.trim()}`,
                    },
                    body: JSON.stringify({
                      model: 'dall-e-3',
                      prompt: realismPrompt.substring(0, 950),
                      n: 1,
                      size: platformConfig.dalle,
                      quality: 'standard',
                    }),
                  }
                );
                const imgData = await imgRes.json();
                if (imgRes.ok && imgData.data) imageUrl = imgData.data[0].url;
              } catch (e) {}
            }

            // ✅ الصور عبر proxy لحل CORS
            if (!imageUrl) {
              const rawUrl = getFreeImageUrl(
                safeVisualPrompt,
                inputs.visualStyle,
                platformConfig.w,
                platformConfig.h,
                index
              );
              // نمرر الرابط عبر image-proxy ديالنا
              const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
              imageUrl = await preloadImage(
                proxiedUrl,
                fallbackImages[index % fallbackImages.length]
              );
            }
          }

          // ✅ TTS: أولاً OpenAI، ثم Gemini، ثم Web Speech
          try {
            if (safeAudioText.trim() !== '') {
              let ttsSuccess = false;

              // 1️⃣ OpenAI TTS عبر proxy — أفضل جودة للعربية
              if (openaiKey && openaiKey.trim()) {
                try {
                  const openaiVoice = inputs.voiceType === 'Female' ? 'nova' : 'onyx';
                  const ttsRes = await fetch('/api/openai-tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      apiKey: openaiKey.trim(),
                      text: safeAudioText,
                      voice: openaiVoice,
                      speed: 0.9,
                    }),
                  });
                  if (ttsRes.ok) {
                    const audioArrayBuffer = await ttsRes.arrayBuffer();
                    const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
                    audioUrl = URL.createObjectURL(audioBlob);
                    ttsSuccess = true;
                  }
                } catch (e1) {
                  console.warn('OpenAI TTS فشل:', e1);
                }
              }

              // 2️⃣ Gemini TTS كـ fallback
              if (!ttsSuccess) {
                try {
                  const voiceName = inputs.voiceType === 'Female' ? 'Aoede' : 'Charon';
                  const ttsBody = {
                    system_instruction: {
                      parts: [{ text: `تحدث بـ${inputs.dialect}. اجعل الأسلوب حيوياً ومقنعاً.` }],
                    },
                    contents: [{ parts: [{ text: safeAudioText }] }],
                    generationConfig: {
                      responseModalities: ['AUDIO'],
                      speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                      },
                    },
                    model: 'gemini-2.5-flash-preview-tts',
                  };
                  const ttsData = await geminiProxy(
                    'models/gemini-2.5-flash-preview-tts:generateContent',
                    ttsBody
                  );
                  const pcmBase64 =
                    ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                  if (pcmBase64) {
                    const wavBlob = pcmToWav(pcmBase64, 24000);
                    if (wavBlob) {
                      audioUrl = URL.createObjectURL(wavBlob);
                      ttsSuccess = true;
                    }
                  }
                } catch (e2) {
                  console.warn('Gemini TTS فشل أيضاً');
                }
              }

              // 3️⃣ Web Speech كـ آخر خيار
              if (!ttsSuccess) {
                audioUrl = 'webspeech:' + safeAudioText;
              }
            }
          } catch (e) {
            console.error('Audio err', e);
          }

          return {
            visual_prompt: safeVisualPrompt,
            audio_text: safeAudioText,
            imageUrl: imageUrl,
            userMediaUrl: userMediaUrl,
            userMediaType: userMediaType,
            audioUrl: audioUrl,
            duration: 4000,
          };
        })
      );

      setVideoScenes(generatedScenes);
      setLoadingText('✨ اكتمل الاستوديو!');
      setTimeout(() => setLoading(false), 1000);
    } catch (err) {
      setError(err.message || 'حدث خطأ غير متوقع.');
      setLoading(false);
    }
  };

  const handleSceneMediaUpload = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const mediaUrl = URL.createObjectURL(file);
    const newScenes = [...videoScenes];
    newScenes[index].userMediaUrl = mediaUrl;
    newScenes[index].userMediaType = isVideo ? 'video' : 'image';
    setVideoScenes(newScenes);
  };

  // ⚡️ مشغل الفيديو المدمج والكلمات الحركية (Kinetic Text) للمعاينة
  useEffect(() => {
    let interval;
    if (
      isPlaying &&
      videoScenes.length > 0 &&
      currentSceneIdx < videoScenes.length
    ) {
      const currentScene = videoScenes[currentSceneIdx];
      // BGM disabled (external URL blocked)
      const words = String(currentScene.audio_text || '').split(' ');
      if (currentScene && currentScene.audioUrl && audioRef.current) {
        // تحقق إذا كان Web Speech
        if (currentScene.audioUrl.startsWith('webspeech:')) {
          const text = currentScene.audioUrl.replace('webspeech:', '');
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'ar-SA';
            utt.rate = 0.85;
            utt.volume = 1;
            const voices = window.speechSynthesis.getVoices();
            const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
            if (arabicVoice) utt.voice = arabicVoice;
            utt.onend = () => handleNextScene();
            window.speechSynthesis.speak(utt);
          }
          // لا نضع src في audioRef لأن webspeech ليس رابط حقيقي
        } else {
          audioRef.current.src = currentScene.audioUrl;
          audioRef.current
            .play()
            .catch((e) => console.log('Audio play blocked', e));
        }
        interval = setInterval(() => {
          if (audioRef.current && audioRef.current.duration) {
            const currentTime = audioRef.current.currentTime;
            const duration = audioRef.current.duration;
            const percent = (currentTime / duration) * 100;
            const baseProgress = (currentSceneIdx / videoScenes.length) * 100;
            const currentProgress =
              (percent / 100) * (100 / videoScenes.length);
            setProgress(baseProgress + currentProgress);
            // تحديث الكلمات الحركية (كلمتين كل فترة)
            const wordDuration = duration / words.length;
            let wordIdx = Math.floor(currentTime / wordDuration);
            if (wordIdx >= words.length) wordIdx = words.length - 1;
            let startIdx = Math.floor(wordIdx / 2) * 2;
            setLiveTextChunk(words.slice(startIdx, startIdx + 2).join(' '));
          }
        }, 50);
      } else {
        let elapsed = 0;
        const duration = currentScene?.duration || 4000;
        interval = setInterval(() => {
          elapsed += 50;
          const percent = (elapsed / duration) * 100;
          const baseProgress = (currentSceneIdx / videoScenes.length) * 100;
          const currentProgress = (percent / 100) * (100 / videoScenes.length);
          setProgress(baseProgress + currentProgress);
          // تحديث الكلمات الحركية
          const wordDuration = duration / words.length;
          let wordIdx = Math.floor(elapsed / wordDuration);
          if (wordIdx >= words.length) wordIdx = words.length - 1;
          let startIdx = Math.floor(wordIdx / 2) * 2;
          setLiveTextChunk(words.slice(startIdx, startIdx + 2).join(' '));
          if (elapsed >= duration) {
            clearInterval(interval);
            handleNextScene();
          }
        }, 50);
      }
    } else if (!isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      if (bgMusicRef.current) bgMusicRef.current.pause();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentSceneIdx, videoScenes]);

  const handleNextScene = () => {
    if (currentSceneIdx < videoScenes.length - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
    } else {
      setProgress(100);
      setCurrentSceneIndex(videoScenes.length);
    }
  };

  const togglePlay = () => {
    const hasAnyMedia = videoScenes.some(
      (s) => s.userMediaUrl !== null || s.imageUrl !== ''
    );
    if (!hasAnyMedia && videoScenes.length > 0) {
      alert('الرجاء رفع مقطع فيديو أو صورة واحدة على الأقل قبل التشغيل!');
      return;
    }
    if (currentSceneIdx >= videoScenes.length) {
      setCurrentSceneIndex(0);
      setProgress(0);
    }
    setIsPlaying(!isPlaying);
  };

  // ⚡️ محرك التصدير الصاروخي والآمن
  const downloadVideo = async () => {
    if (videoScenes.length === 0) return;
    setFinalVideoUrl(null); // تنظيف الرابط السابق
    setIsRecording(true);
    setRecordingProgress(0);

    const platformConfig = getPlatformConfig(inputs.targetPlatform);
    const canvas = document.createElement('canvas');
    canvas.width = platformConfig.w;
    canvas.height = platformConfig.h;
    const ctx = canvas.getContext('2d');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    // BGM disabled
    let bgmSource = null;

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getTracks(), ...dest.stream.getTracks()];
    const stream = new MediaStream(tracks);
    let mimeType = 'video/mp4';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm; codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    }
    // ⚡️ تعيين نوع الامتداد للزر
    setVideoExtension(mimeType.includes('mp4') ? 'mp4' : 'webm');

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      // ⚡️ حفظ الرابط في الـ State للزر الآمن بدلاً من النقر المباشر المرفوض
      setFinalVideoUrl(url);
      setIsRecording(false);
      // bgmSource disabled
    };
    recorder.start();

    let currentDrawScene = 0;
    let isDrawing = true;
    let scaleAnim = 1.05;
    let lastDrawScene = -1;
    let sceneStartTime = Date.now();
    let sceneDurationForCanvas = 4000;

    // حلقة الرسم المستمرة للـ Canvas
    const drawLoop = () => {
      if (!isDrawing) return;
      if (currentDrawScene !== lastDrawScene) {
        lastDrawScene = currentDrawScene;
        sceneStartTime = Date.now();
      }
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (currentDrawScene === -1) {
        // CTA Screen
        ctx.fillStyle = 'rgba(0,0,0,0.95)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.floor(canvas.width * 0.08)}px Cairo`;
        ctx.textAlign = 'center';
        ctx.fillText(
          'احصل عليه الآن!',
          canvas.width / 2,
          canvas.height / 2 - 50
        );
        ctx.fillStyle = '#34d399';
        ctx.font = `bold ${Math.floor(canvas.width * 0.05)}px Cairo`;
        ctx.fillText(
          '✅ الدفع عند الاستلام متاح',
          canvas.width / 2,
          canvas.height / 2 + 20
        );
        ctx.fillStyle = '#f43f5e';
        const btnW = canvas.width * 0.6;
        const btnH = canvas.height * 0.08;
        const btnX = (canvas.width - btnW) / 2;
        const btnY = canvas.height / 2 + 80;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(btnX, btnY, btnW, btnH, 30);
          ctx.fill();
        } else {
          ctx.fillRect(btnX, btnY, btnW, btnH);
        }
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.floor(canvas.width * 0.05)}px Cairo`;
        ctx.textBaseline = 'middle';
        ctx.fillText('اطلب الآن', canvas.width / 2, btnY + btnH / 2 + 5);
      } else {
        const scene = videoScenes[currentDrawScene];
        if (scene) {
          const mediaElement = document.getElementById(
            `hidden-media-${currentDrawScene}`
          );
          if (mediaElement) {
            scaleAnim += 0.0005; // زووم سينمائي ناعم
            let sw =
              mediaElement.videoWidth ||
              mediaElement.naturalWidth ||
              canvas.width;
            let sh =
              mediaElement.videoHeight ||
              mediaElement.naturalHeight ||
              canvas.height;
            const scale = Math.max(canvas.width / sw, canvas.height / sh);
            const newW = sw * scale * scaleAnim;
            const newH = sh * scale * scaleAnim;
            const newX = (canvas.width - newW) / 2;
            const newY = (canvas.height - newH) / 2;
            try {
              ctx.drawImage(mediaElement, newX, newY, newW, newH);
            } catch (e) {}
          }

          // ⚡️ انتقال فلاش أبيض خفيف بين المشاهد لشد الانتباه
          const elapsedSinceCut = Date.now() - sceneStartTime;
          if (elapsedSinceCut < 150 && currentDrawScene > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${1 - elapsedSinceCut / 150})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          // ⚡️ تظليل خفيف جداً لبروز النصوص
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // ⚡️ رسم واجهة تيك توك / ريلز (Social UI Overlays)
          const isVertical = canvas.width < canvas.height;
          if (isVertical) {
            // Top Ad Tag
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(20, 40, 120, 35, 8);
              ctx.fill();
            } else {
              ctx.fillRect(20, 40, 120, 35);
            }
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Cairo';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('إعلان ممول', 80, 58);
            // Right Icons
            const iconX = canvas.width - 40;
            ctx.textAlign = 'center';
            ctx.font = '35px Arial';
            ctx.fillText('🤍', iconX, canvas.height * 0.5);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Cairo';
            ctx.fillText('12K', iconX, canvas.height * 0.5 + 25);
            ctx.font = '35px Arial';
            ctx.fillText('💬', iconX, canvas.height * 0.5 + 75);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Cairo';
            ctx.fillText('342', iconX, canvas.height * 0.5 + 100);
            ctx.font = '35px Arial';
            ctx.fillText('↗️', iconX, canvas.height * 0.5 + 150);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Cairo';
            ctx.fillText('1.2K', iconX, canvas.height * 0.5 + 175);
            // Bottom Shop Now Bar
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, canvas.height - 90, canvas.width, 90);
            ctx.fillStyle = '#fe2c55'; // TikTok Pink
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(20, canvas.height - 70, canvas.width - 100, 50, 10);
              ctx.fill();
            } else {
              ctx.fillRect(20, canvas.height - 70, canvas.width - 100, 50);
            }
            ctx.fillStyle = 'white';
            ctx.font = '900 22px Cairo';
            ctx.fillText(
              '🛒 تسوق الآن',
              (canvas.width - 100) / 2 + 20,
              canvas.height - 45
            );
          }

          // ⚡️ النصوص الحركية في المنتصف (Kinetic Typography)
          if (scene.audio_text) {
            const words = String(scene.audio_text).split(' ');
            const wordDuration = sceneDurationForCanvas / words.length;
            let currentWordIdx = Math.floor(elapsedSinceCut / wordDuration);
            if (currentWordIdx >= words.length)
              currentWordIdx = words.length - 1;
            // عرض كلمتين بكلمتين
            let startIdx = Math.floor(currentWordIdx / 2) * 2;
            let chunk = words.slice(startIdx, startIdx + 2).join(' ');
            if (chunk) {
              const fontSize = Math.floor(canvas.width * 0.09); // نص ضخم
              ctx.font = `900 ${fontSize}px Cairo, sans-serif`;
              const tm = ctx.measureText(chunk);
              const paddingX = 40;
              const paddingY = 20;
              const textX = canvas.width / 2;
              const textY = canvas.height * 0.45; // في المنتصف
              ctx.save();
              ctx.translate(textX, textY);
              // إمالة خفيفة تتغير مع كل كلمة لتشد الانتباه
              const angle = startIdx % 4 === 0 ? -0.05 : 0.05;
              ctx.rotate(angle);
              // خلفية صفراء فاقعة (Hormozi Style)
              ctx.fillStyle = '#ffde00';
              if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(
                  -tm.width / 2 - paddingX,
                  -fontSize / 2 - paddingY,
                  tm.width + paddingX * 2,
                  fontSize + paddingY * 2,
                  15
                );
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 5;
                ctx.stroke(); // إطار أسود
              } else {
                ctx.fillRect(
                  -tm.width / 2 - paddingX,
                  -fontSize / 2 - paddingY,
                  tm.width + paddingX * 2,
                  fontSize + paddingY * 2
                );
              }
              // النص الأسود
              ctx.fillStyle = '#000';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(chunk, 0, 5);
              ctx.restore();
            }
          }
        }
      }
      requestAnimationFrame(drawLoop);
    };
    drawLoop();

    // تشغيل المشاهد ومزامنتها
    for (let i = 0; i < videoScenes.length; i++) {
      currentDrawScene = i;
      scaleAnim = 1.05;
      const scene = videoScenes[i];
      let duration = 4000;
      const mediaElement = document.getElementById(`hidden-media-${i}`);
      if (mediaElement && mediaElement.tagName === 'VIDEO') {
        mediaElement.currentTime = 0;
        mediaElement.play().catch((e) => console.log(e));
      }
      if (scene.audioUrl && !scene.audioUrl.startsWith('webspeech:')) {
        try {
          const response = await fetch(scene.audioUrl);
          if (!response.ok) throw new Error('fetch failed');
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(dest);
          source.start(audioCtx.currentTime);
          duration = audioBuffer.duration * 1000;
          sceneDurationForCanvas = duration;
          setRecordingProgress(Math.floor((i / videoScenes.length) * 100));
          await new Promise((resolve) => setTimeout(resolve, duration + 200));
        } catch (e) {
          console.error('Audio recording error', e);
          await new Promise((resolve) => setTimeout(resolve, duration));
        }
      } else {
        sceneDurationForCanvas = duration;
        setRecordingProgress(Math.floor((i / videoScenes.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, duration));
      }
    }
    currentDrawScene = -1; // CTA
    setRecordingProgress(100);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    isDrawing = false;
    recorder.stop();
  };

  const activePlatformConfig = getPlatformConfig(inputs.targetPlatform);

  if (!isReady) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-900 text-indigo-500 font-sans">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-white">
          جاري تحميل مصنع الإعلانات الفيروسية...
        </h2>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 relative"
    >
      {/* ⚡️ شاشة نجاح / تحميل الفيديو الآمنة */}
      {(isRecording || finalVideoUrl) && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          {isRecording ? (
            <>
              <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mb-6" />
              <h3 className="text-3xl font-black text-white mb-3">
                جاري تصدير إعلانك كفيديو احترافي...
              </h3>
              <p className="text-emerald-400 font-bold mb-8 text-lg">
                الرجاء عدم إغلاق هذه الصفحة. ({recordingProgress}%)
              </p>
              <div className="w-full max-w-md bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full transition-all duration-300"
                  style={{ width: `${recordingProgress}%` }}
                ></div>
              </div>
              <p className="text-slate-500 mt-6 font-bold text-sm">
                يقوم المحرك الآن بدمج واجهة المنصة، النصوص الحركية، والصوت في
                فيديو واحد.
              </p>
            </>
          ) : (
            <div className="animate-in zoom-in duration-300 flex flex-col items-center">
              <div className="bg-emerald-500/20 p-4 rounded-full mb-6">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-black text-white mb-3">
                ✅ اكتمل تجهيز الفيديو بنجاح!
              </h3>
              <p className="text-slate-400 mb-8 text-lg">
                الفيديو جاهز الآن للتحميل والمشاركة على منصات الإعلانات.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = finalVideoUrl;
                    a.download = `ALI_Viral_Ad_${Date.now()}.${videoExtension}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 text-lg"
                >
                  <DownloadCloud className="w-6 h-6" /> تحميل الفيديو لجهازك
                </button>
                <button
                  onClick={() => setFinalVideoUrl(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-8 py-4 rounded-xl font-black transition-all text-lg"
                >
                  إغلاق الشاشة
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ⚡️ عناصر ميديا مخفية لالتقاطها في الـ Canvas (تعقيم الروابط لمنع CORS) */}
      <div className="hidden">
        {videoScenes.map((s, idx) => {
          const src =
            s.userMediaUrl ||
            s.imageUrl ||
            fallbackImages[idx % fallbackImages.length];
          const isLocalBlob = src.startsWith('blob:') || src.startsWith('data:');
          if (s.userMediaType === 'video') {
            return (
              <video
                key={idx}
                id={`hidden-media-${idx}`}
                src={src}
                crossOrigin={isLocalBlob ? undefined : 'anonymous'}
                loop
                muted
                playsInline
              />
            );
          } else {
            return (
              <img
                key={idx}
                id={`hidden-media-${idx}`}
                src={src}
                crossOrigin={isLocalBlob ? undefined : 'anonymous'}
                alt="hidden"
              />
            );
          }
        })}
      </div>

      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border-b border-indigo-900/50 p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-xs mb-4 relative z-10">
          <Zap className="w-4 h-4" /> Kinetic Typography & Safe Export 🎬
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-3 flex justify-center items-center gap-3 relative z-10">
          <PlayCircle className="w-10 h-10 text-indigo-400" />
          <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
            ALI Video Ads Pro
          </span>
        </h1>
        <p className="text-slate-400 text-lg font-bold relative z-10">
          وداعاً لعرض الشرائح الممل. تم تفعيل نظام النصوص الحركية في المنتصف مع
          واجهة (تيك توك) المدمجة!
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-10 flex flex-col xl:flex-row gap-8">
        {/* اللوحة الجانبية: المدخلات */}
        <div className="w-full xl:w-1/3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" /> 1. مفاتيح الأبواب
              السحرية
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-indigo-400 mb-1">
                  مفتاح Gemini (إلزامي للسكريبت)
                </label>
                <input
                  type="password"
                  name="geminiKey"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm focus:border-indigo-500 font-mono"
                  placeholder="AIzaSy..."
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-emerald-400 mb-1">
                  مفتاح OpenAI (للتعليق الصوتي عالي الجودة) 🎙️
                </label>
                <input
                  type="password"
                  name="openaiKey"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-emerald-800 rounded-xl py-3 px-4 text-white text-sm focus:border-emerald-500 font-mono"
                  placeholder="sk-..."
                />
              </div>
            </div>
          </div>

          {/* ⚡️ قسم أصول الإعلان (Assets) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl border-t-4 border-t-indigo-500">
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-400" /> 2. أصول الإعلان
              (Assets)
            </h2>
            <p className="text-[11px] text-slate-400 font-bold mb-4 leading-relaxed">
              ارفع فيديوهاتك الحقيقية. المخرج سيدمجها ويضيف النصوص العملاقة في
              منتصف الشاشة (Kinetic Typography) لتصميم إعلان مباشر
              (Direct-Response).
            </p>
            <div className="space-y-4">
              {/* رفع صورة الأفاتار */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl relative">
                <label className="block text-xs font-black text-indigo-300 mb-2 flex items-center gap-2">
                  <UserCircle className="w-4 h-4" /> فيديو الممثل / الأفاتار
                  (للمشهد 1)
                </label>
                {!avatarImage ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-950 hover:border-indigo-500 transition-colors">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                      <Upload className="w-4 h-4" /> ارفع فيديو (MP4) أو صورة
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4, video/quicktime, image/jpeg, image/png"
                      onChange={(e) =>
                        processImageFile(e.target.files[0], setAvatarImage)
                      }
                    />
                  </label>
                ) : (
                  <div className="relative h-20 rounded-lg overflow-hidden group border border-indigo-500/50 flex items-center justify-center bg-black">
                    {avatarImage.type === 'video' ? (
                      <video
                        src={avatarImage.dataUrl}
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <img
                        src={avatarImage.dataUrl}
                        className="w-full h-full object-cover opacity-80"
                      />
                    )}
                    <button
                      onClick={() => setAvatarImage(null)}
                      className="absolute inset-0 bg-red-500/80 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      إزالة
                    </button>
                  </div>
                )}
              </div>

              {/* رفع صورة المنتج */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl relative">
                <label className="block text-xs font-black text-emerald-300 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" /> فيديو أو صورة المنتج (للمشهد
                  الأخير)
                </label>
                {!productImage ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-950 hover:border-emerald-500 transition-colors">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                      <Upload className="w-4 h-4" /> ارفع مقطع المنتج
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4, video/quicktime, image/jpeg, image/png"
                      onChange={(e) =>
                        processImageFile(e.target.files[0], setProductImage)
                      }
                    />
                  </label>
                ) : (
                  <div className="relative h-20 rounded-lg overflow-hidden group border border-emerald-500/50 flex items-center justify-center bg-black">
                    {productImage.type === 'video' ? (
                      <video
                        src={productImage.dataUrl}
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <img
                        src={productImage.dataUrl}
                        className="w-full h-full object-cover opacity-80"
                      />
                    )}
                    <button
                      onClick={() => setProductImage(null)}
                      className="absolute inset-0 bg-red-500/80 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      إزالة
                    </button>
                  </div>
                )}
                {productImage && (
                  <button
                    onClick={analyzeProductImage}
                    disabled={analyzingImage}
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-colors"
                  >
                    {analyzingImage ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ScanEye className="w-3 h-3" />
                    )}{' '}
                    استخراج البيانات التسويقية آلياً
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" /> 3. التوجيهات
              التسويقية
            </h2>
            <div className="space-y-4">
              <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-2xl">
                <label className="block text-xs font-black text-indigo-400 mb-2">
                  السكريبت المخصص (اختياري)
                </label>
                <textarea
                  name="customScript"
                  value={inputs.customScript}
                  onChange={handleInputChange}
                  className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:border-indigo-500 resize-none text-xs"
                  placeholder="إذا كان لديك سكريبت جاهز، الصقه هنا..."
                />
              </div>

              {!inputs.customScript && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      name="productName"
                      value={inputs.productName}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm focus:border-indigo-500"
                      placeholder="مثال: كريم الجبروت"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      الجمهور المستهدف
                    </label>
                    <input
                      type="text"
                      name="targetAudience"
                      value={inputs.targetAudience}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm focus:border-indigo-500"
                      placeholder="مثال: الرجال المهتمون بالثقة"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      الفائدة الكبرى
                    </label>
                    <input
                      type="text"
                      name="mainBenefit"
                      value={inputs.mainBenefit}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm focus:border-indigo-500"
                      placeholder="مثال: أداء ممتاز وثقة عالية"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    المنصة المستهدفة
                  </label>
                  <select
                    name="targetPlatform"
                    value={inputs.targetPlatform}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm outline-none"
                  >
                    <option value="tiktok">TikTok / Reels (9:16)</option>
                    <option value="snapchat">Snapchat (9:16)</option>
                    <option value="facebook">Facebook / IG Feed (1:1)</option>
                    <option value="youtube">YouTube (16:9)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    نوع الفيديو
                  </label>
                  <select
                    name="videoType"
                    value={inputs.videoType}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm outline-none"
                  >
                    <option value="ugc">عفوي (UGC)</option>
                    <option value="promo">ترويجي (Promo)</option>
                    <option value="story">قصة تجربة (Storytelling)</option>
                    <option value="howto">شرح الاستخدام (How-to)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    نبرة المعلق الصوتي
                  </label>
                  <select
                    name="voiceType"
                    value={inputs.voiceType}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm outline-none"
                  >
                    <option value="Male">ذكر فخم (Charon)</option>
                    <option value="Female">أنثى ناعم (Aoede)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    ستايل الصور الافتراضي
                  </label>
                  <select
                    name="visualStyle"
                    value={inputs.visualStyle}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white text-sm outline-none"
                  >
                    <option value="ugc">محتوى عفوي (UGC)</option>
                    <option value="studio">تصوير استوديو نقي</option>
                    <option value="cinematic">سينمائي درامي</option>
                  </select>
                </div>
              </div>

              {/* ✅ إصلاح #2: قائمة اختيار اللهجة الكاملة */}
              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl">
                <label className="block text-xs font-black text-amber-400 mb-2 flex items-center gap-2">
                  <Mic className="w-4 h-4" /> لهجة التعليق الصوتي 🎙️
                </label>
                <select
                  name="dialect"
                  value={inputs.dialect}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-amber-500/30 rounded-xl py-2.5 px-3 text-white text-sm outline-none focus:border-amber-400"
                >
                  {ARABIC_DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-2 font-bold">
                  اللهجة المختارة: <span className="text-amber-400">{inputs.dialect}</span>
                </p>
              </div>

              <label className="flex items-center gap-3 p-3 border border-slate-800 rounded-xl bg-slate-950 cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  name="generateImages"
                  checked={inputs.generateImages}
                  onChange={handleInputChange}
                  className="w-4 h-4 accent-indigo-500"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">
                    توليد صور للمنتج فقط (Faceless AI)
                  </p>
                  <p className="text-[9px] text-slate-500">
                    لن يتم رسم أي شخص في المشاهد لتجنب التشوهات.
                  </p>
                </div>
              </label>
            </div>

            <button
              onClick={generateAdVideo}
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> {loadingText}
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5" /> إنتاج إعلان فيروسي
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-bold flex items-start gap-2 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>
        </div>

        {/* اللوحة الرئيسية: مشغل الفيديو + التايم لاين */}
        <div className="w-full xl:w-2/3 space-y-6">
          {!loading && videoScenes.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-12 min-h-[400px] h-full shadow-2xl flex flex-col items-center justify-center text-center">
              <div className="bg-slate-800 p-6 rounded-full mb-6 inline-block">
                <Video className="w-12 h-12 text-slate-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-200 mb-3">
                استوديو الإعلانات الفيروسية (Kinetic & UI)
              </h3>
              <p className="text-slate-400 max-w-md mx-auto text-sm font-bold leading-relaxed">
                تمت إزالة الاهتزازات الكرتونية. الآن سيتم دمج مقاطعك الحقيقية مع
                واجهة مستخدم (تيك توك) ونصوص عملاقة في منتصف الشاشة لإنشاء إعلان
                يبيع.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] h-full shadow-2xl">
              <div className="relative mb-6 inline-block">
                <div className="w-24 h-24 border-4 border-slate-800 rounded-full"></div>
                <div className="absolute top-0 left-0 w-24 h-24 border-4 rounded-full border-t-transparent animate-spin border-indigo-500"></div>
                <Mic className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 animate-pulse text-indigo-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                {loadingText}
              </h3>
            </div>
          )}

          {!loading && videoScenes.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-6 animate-in zoom-in duration-500">
              {/* 🎬 مشغل المعاينة الحي */}
              <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-4">
                <div
                  className={`relative mx-auto bg-black rounded-[2.5rem] border-[8px] border-slate-950 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden group ${activePlatformConfig.aspect}`}
                  style={{
                    width: '100%',
                    maxWidth: '360px',
                    height: activePlatformConfig.previewH,
                  }}
                >
                  {/* ⚡️ شريط التقدم في المعاينة */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-white/20 z-50">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  {/* ⚡️ فلاش بين المشاهد في المعاينة الحية */}
                  <div
                    key={`flash-${currentSceneIdx}`}
                    className="absolute inset-0 bg-white z-40 animate-out fade-out duration-300 pointer-events-none"
                  ></div>

                  {/* طبقة الميديا */}
                  {currentSceneIdx < videoScenes.length ? (
                    videoScenes.map((scene, idx) => (
                      <div
                        key={idx}
                        className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
                          idx === currentSceneIdx
                            ? 'opacity-100 z-10'
                            : 'opacity-0 z-0'
                        }`}
                      >
                        {scene.userMediaUrl ? (
                          scene.userMediaType === 'video' ? (
                            <video
                              src={scene.userMediaUrl}
                              autoPlay={idx === currentSceneIdx && isPlaying}
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={scene.userMediaUrl}
                              alt={`User Scene ${idx}`}
                              className={`w-full h-full object-cover ${
                                idx === currentSceneIdx && isPlaying
                                  ? 'scale-105 transition-transform duration-[8s] ease-linear'
                                  : 'scale-100'
                              }`}
                            />
                          )
                        ) : scene.imageUrl ? (
                          // ✅ إصلاح #1: عرض الصورة مع spinner أثناء التحميل
                          <div className="relative w-full h-full">
                            <img
                              src={scene.imageUrl}
                              alt={`AI Scene ${idx}`}
                              onError={(e) => {
                                if (!e.target.dataset.err) {
                                  e.target.dataset.err = 'true';
                                  e.target.src =
                                    fallbackImages[idx % fallbackImages.length];
                                }
                              }}
                              className={`w-full h-full object-cover ${
                                idx === currentSceneIdx && isPlaying
                                  ? 'scale-105 transition-transform duration-[8s] ease-linear'
                                  : 'scale-100'
                              }`}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-slate-700 p-6 text-center">
                            <Loader2 className="w-8 h-8 text-slate-600 mb-2 animate-spin" />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    /* ⚡️ شاشة النهاية في المعاينة */
                    <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center">
                      <h2 className="text-white text-2xl font-black mb-2">
                        احصل عليه الآن!
                      </h2>
                      <p className="text-emerald-400 font-bold mb-6">
                        ✅ الدفع عند الاستلام متاح
                      </p>
                      <div className="bg-[#fe2c55] text-white font-black px-8 py-3 rounded-full animate-pulse shadow-lg shadow-rose-500/50">
                        اطلب الآن
                      </div>
                    </div>
                  )}

                  {/* تظليل خلفية للنصوص */}
                  {currentSceneIdx < videoScenes.length && (
                    <div className="absolute inset-0 bg-black/30 z-20 pointer-events-none"></div>
                  )}

                  {/* ⚡️ واجهة تيك توك / ريلز (UI Overlays) */}
                  {currentSceneIdx < videoScenes.length && (
                    <>
                      {/* Top Tag */}
                      <div className="absolute top-4 right-4 bg-black/50 text-white text-xs font-bold px-3 py-1 rounded-md z-30">
                        إعلان ممول
                      </div>
                      {/* Right Icons */}
                      <div className="absolute top-1/3 right-2 flex flex-col gap-5 items-center z-30">
                        <div className="flex flex-col items-center">
                          <Heart className="w-8 h-8 text-white fill-transparent" />
                          <span className="text-white text-[10px] font-bold mt-1">
                            12K
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <MessageCircle className="w-8 h-8 text-white fill-transparent" />
                          <span className="text-white text-[10px] font-bold mt-1">
                            342
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <Share2 className="w-8 h-8 text-white" />
                          <span className="text-white text-[10px] font-bold mt-1">
                            1.2K
                          </span>
                        </div>
                      </div>
                      {/* Bottom Shop Button */}
                      <div className="absolute bottom-4 left-4 right-4 z-30">
                        <div className="bg-[#fe2c55] text-white py-3 rounded-lg flex items-center justify-center gap-2 font-black shadow-lg">
                          <ShoppingBag className="w-5 h-5" /> تسوق الآن
                        </div>
                      </div>
                    </>
                  )}

                  {/* ⚡️ النصوص الحركية في المنتصف (Kinetic Typography) */}
                  {currentSceneIdx < videoScenes.length && (
                    <div className="absolute top-[45%] -translate-y-1/2 left-0 right-0 px-6 text-center z-30">
                      <p
                        className="inline-block bg-[#ffde00] text-black font-black text-2xl md:text-3xl px-5 py-3 rounded-xl border-[3px] border-black shadow-[4px_4px_0px_#000] leading-tight animate-in zoom-in duration-200"
                        style={{
                          transform: `rotate(${
                            Math.random() > 0.5 ? '-2deg' : '2deg'
                          })`,
                        }}
                      >
                        {liveTextChunk ||
                          String(videoScenes[currentSceneIdx]?.audio_text || '')
                            .split(' ')
                            .slice(0, 2)
                            .join(' ')}
                      </p>
                    </div>
                  )}

                  {/* أزرار التشغيل داخل الشاشة */}
                  <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={togglePlay}
                      className="bg-indigo-600/90 text-white p-4 rounded-full backdrop-blur-md shadow-2xl transform hover:scale-110 transition-transform"
                    >
                      {isPlaying ? (
                        <PauseCircle className="w-10 h-10" />
                      ) : (
                        <PlayCircle className="w-10 h-10 ml-1" />
                      )}
                    </button>
                  </div>

                  {/* مؤشر المشاهد */}
                  <div className="absolute top-4 right-4 bg-black/60 text-white text-xs font-black px-3 py-1 rounded-full z-30 backdrop-blur-sm border border-white/10">
                    مشهد {currentSceneIdx + 1} / {videoScenes.length}
                  </div>

                  <audio
                    ref={audioRef}
                    onEnded={handleNextScene}
                    className="hidden"
                  />
                  {/* BGM disabled */}
                </div>

                <button
                  onClick={togglePlay}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-colors shadow-lg border border-indigo-500"
                >
                  {isPlaying ? (
                    <>
                      <PauseCircle className="w-5 h-5" /> إيقاف العرض
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5" /> تشغيل المعاينة المبدئية
                    </>
                  )}
                </button>
              </div>

              {/* 🎛️ شريط المونتاج (Timeline & Upload) */}
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-hidden flex flex-col h-full lg:max-h-[800px]">
                <div className="border-b border-slate-800 pb-4 mb-4 shrink-0 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      <Film className="w-5 h-5 text-indigo-400" /> شريط المونتاج
                      لـ {activePlatformConfig.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">
                      اضغط على أي صورة لتغييرها ورفع فيديو أو صورة خاصة بك.
                    </p>
                  </div>
                </div>

                <div className="overflow-y-auto pr-2 space-y-4 flex-1 custom-scrollbar">
                  {videoScenes.map((scene, idx) => (
                    <div
                      key={idx}
                      className={`bg-slate-950 border ${
                        currentSceneIdx === idx
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                          : 'border-slate-800'
                      } rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center transition-all`}
                    >
                      {/* ⚡️ مربع المعاينة والرفع مع أبعاد ثابتة */}
                      <div
                        className={`relative shrink-0 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 group cursor-pointer`}
                        style={{
                          width: '100px',
                          height: activePlatformConfig.thumbH,
                        }}
                      >
                        {scene.userMediaUrl ? (
                          scene.userMediaType === 'video' ? (
                            <video
                              src={scene.userMediaUrl}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={scene.userMediaUrl}
                              className="w-full h-full object-cover"
                              alt="User Media"
                            />
                          )
                        ) : scene.imageUrl ? (
                          // ✅ إصلاح #1: thumbnail مع loading state
                          <div className="relative w-full h-full">
                            <img
                              src={scene.imageUrl}
                              onError={(e) => {
                                if (!e.target.dataset.err) {
                                  e.target.dataset.err = 'true';
                                  e.target.src =
                                    fallbackImages[idx % fallbackImages.length];
                                }
                              }}
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-50 transition-opacity"
                              alt="AI Generated"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity backdrop-blur-sm">
                          <Upload className="w-5 h-5 mb-1 text-emerald-400" />
                          <span className="text-[9px] font-bold text-center">
                            تغيير
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="video/mp4, video/quicktime, image/jpeg, image/png"
                          onChange={(e) => handleSceneMediaUpload(idx, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="absolute top-1 left-1 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded font-bold z-20">
                          M {idx + 1}
                        </div>
                      </div>

                      {/* تفاصيل المشهد مع زر الرفع الصريح */}
                      <div className="flex-1 w-full text-right flex flex-col">
                        <p className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <Camera className="w-3 h-3" /> التوجيه البصري
                          (Faceless):
                        </p>
                        <p className="text-indigo-300 text-xs font-mono leading-relaxed mb-2 bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                          {String(scene.visual_prompt)}
                        </p>
                        <p className="text-slate-200 text-sm font-bold leading-relaxed mb-3">
                          "{String(scene.audio_text)}"
                        </p>
                        <div className="mt-auto flex flex-wrap gap-2">
                          <label className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 py-1.5 px-3 rounded-lg text-[11px] font-black flex items-center justify-center gap-2 cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5" />{' '}
                            {scene.userMediaUrl
                              ? 'تغيير المقطع'
                              : 'رفع مقطعك (MP4)'}
                            <input
                              type="file"
                              accept="video/mp4, video/quicktime, image/jpeg, image/png"
                              onChange={(e) => handleSceneMediaUpload(idx, e)}
                              className="hidden"
                            />
                          </label>
                          {scene.audioUrl && !scene.audioUrl.startsWith('webspeech:') && (
                            <button
                              onClick={() =>
                                downloadFile(
                                  scene.audioUrl,
                                  `Scene_${idx + 1}_Voiceover.wav`
                                )
                              }
                              className="flex-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 py-1.5 px-3 rounded-lg text-[11px] font-black flex items-center justify-center gap-2 transition-colors"
                            >
                              <DownloadCloud className="w-3.5 h-3.5" /> تحميل
                              الصوت
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800">
                  {/* ⚡️ الزر الجديد لتحميل الفيديو الحقيقي */}
                  <button
                    onClick={downloadVideo}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-colors border border-emerald-500 shadow-lg shadow-emerald-500/20"
                  >
                    <DownloadCloud className="w-5 h-5" /> تصدير الإعلان النهائي
                    كفيديو (.mp4)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
