# ALI Video Ads Pro 🎬

أداة توليد الفيديوهات الإعلانية بالذكاء الاصطناعي

## 🚀 النشر على Vercel (5 دقائق)

### الخطوة 1: رفع الكود على GitHub
1. اذهب إلى [github.com](https://github.com) وسجل دخولك
2. اضغط **"New repository"**
3. سمّه `ali-video-ads`
4. اضغط **"Create repository"**
5. ارفع كل ملفات هذا المجلد

### الخطوة 2: النشر على Vercel
1. اذهب إلى [vercel.com](https://vercel.com)
2. سجل دخولك بحساب GitHub
3. اضغط **"New Project"**
4. اختر repo الذي أنشأته `ali-video-ads`
5. اضغط **"Deploy"** — خلاص! ✅

### الخطوة 3: استخدام الأداة
- افتح الرابط الذي أعطاك إياه Vercel
- أدخل مفتاح Gemini
- استمتع بالأداة بدون أي مشاكل CORS 🎉

## 📁 هيكل المشروع

```
ali-video-ads/
├── api/
│   ├── gemini.js          # Proxy لـ Gemini API
│   ├── models.js          # قائمة النماذج المتاحة  
│   └── image-proxy.js     # Proxy للصور (يحل CORS)
├── src/
│   ├── App.jsx            # الأداة الرئيسية
│   ├── main.jsx           # نقطة الدخول
│   └── index.css          # الستايلات
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── vercel.json            # إعدادات Vercel
```

## 🔑 المتطلبات
- مفتاح Gemini من [aistudio.google.com](https://aistudio.google.com)
- حساب Vercel مجاني
- حساب GitHub مجاني

## ✨ المميزات
- توليد سكريبت إعلاني بالذكاء الاصطناعي
- تعليق صوتي بـ 21 لهجة عربية
- صور AI للمشاهد
- تصدير فيديو احترافي
- واجهة TikTok/Reels مدمجة
