// api/notify.js — Vercel Serverless OneSignal Engine
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, title, message, data, image, url, apiKey, appId } = req.body;

    // ডিফল্ট বা অ্যাডমিন থেকে পাঠানো ক্রেডেনশিয়াল
    const ONESIGNAL_APP_ID = appId || process.env.ONESIGNAL_APP_ID || "7398e8c1-9373-4680-bc63-27c413779609";
    const ONESIGNAL_REST_KEY = apiKey || process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_REST_KEY) {
      return res.status(400).json({ 
        error: 'OneSignal REST API Key অনুপস্থিত! অনুগ্রহ করে অ্যাডমিন প্যানেল থেকে সেভ করুন।' 
      });
    }

    let payload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title || "New Notification" },
      contents: { en: message || "" },
      data: data || {}
    };

    if (image && String(image).startsWith('http')) {
      payload.big_picture = image;
      payload.chrome_web_image = image;
      payload.adm_big_picture = image;
    }
    if (url && String(url).startsWith('http')) {
      payload.url = url;
    }

    // ১. নতুন অর্ডার এলার্ট (শুধুমাত্র অ্যাডমিনের ডিভাইসে যাবে)
    if (action === 'new_order') {
      payload.filters = [
        { field: "tag", key: "role", relation: "=", value: "admin" }
      ];
      payload.headings = { en: "🛒 নতুন অর্ডার এসেছে!" };
      payload.contents = { 
        en: `অর্ডার: ${data.productName || 'Package'}\nমূল্য: ৳${data.price || 0} | গেম: ${data.gameName || 'Game'}` 
      };
      payload.data = { type: 'admin_order', orderId: data.orderId || '' };
    }

    // ২. নতুন ডিপোজিট রিকোয়েস্ট এলার্ট (শুধুমাত্র অ্যাডমিনের ডিভাইসে যাবে)
    else if (action === 'new_deposit') {
      payload.filters = [
        { field: "tag", key: "role", relation: "=", value: "admin" }
      ];
      payload.headings = { en: "💰 নতুন ডিপোজিট রিকোয়েস্ট!" };
      payload.contents = { 
        en: `পরিমাণ: ৳${data.amount || 0} (${data.method || 'MFS'})\nTrxID: ${data.trxId || 'N/A'}` 
      };
      payload.data = { type: 'admin_deposit', trxId: data.trxId || '' };
    }

    // ৩. কাস্টমার ব্রডকাস্ট (সব সাধারণ ইউজার ডিভাইসে যাবে, অ্যাডমিন ফিল্টার বাদ দিয়ে)
    else if (action === 'broadcast_customer') {
      payload.filters = [
        { field: "tag", key: "role", relation: "!=", value: "admin" }
      ];
    }

    // ৪. অ্যাডমিন টেস্ট নোটিফিকেশন
    else if (action === 'test_admin') {
      payload.filters = [
        { field: "tag", key: "role", relation: "=", value: "admin" }
      ];
      payload.headings = { en: "🔔 অ্যাডমিন এলার্ট টেস্ট" };
      payload.contents = { en: "অভিনন্দন! আপনার অ্যাডমিন ডিভাইস নোটিফিকেশন গ্রহণের জন্য সম্পূর্ণ প্রস্তুত।" };
    }

    // ৫. নির্দিষ্ট সিঙ্গেল ইউজার পুশ
    else if (action === 'single_user' && data?.userId) {
      payload.include_aliases = { external_id: [data.userId] };
      payload.target_channel = "push";
    }

    // OneSignal API কল
    const osResponse = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${ONESIGNAL_REST_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await osResponse.json();

    if (!osResponse.ok || responseData.errors) {
      return res.status(osResponse.status || 400).json({ 
        success: false, 
        error: responseData.errors || 'OneSignal API Error' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      recipients: responseData.recipients || 0,
      id: responseData.id 
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
