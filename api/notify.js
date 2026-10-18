export default async function handler(req, res) {
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

    const ONESIGNAL_APP_ID = appId || "f02ea885-f5f3-4c5e-9baa-d91066b14653";
    const ONESIGNAL_REST_KEY = apiKey;

    if (!ONESIGNAL_REST_KEY) {
      return res.status(400).json({ 
        error: 'REST API Key পাওয়া যায়নি! অ্যাডমিন প্যানেল থেকে REST API Key দিন।' 
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

    // ১. কাস্টমার ব্রডকাস্ট (সকল ইউজারদের কাছে পাঠানো)
    if (action === 'broadcast_customer') {
      payload.included_segments = ["Total Subscriptions"];
    }

    // ২. নির্দিষ্ট সিঙ্গেল ইউজার
    else if (action === 'single_user' && data?.userId) {
      payload.include_aliases = { external_id: [data.userId] };
      payload.target_channel = "push";
    }

    // ৩. নতুন অর্ডার এলার্ট (শুধুমাত্র অ্যাডমিন ফোনে যাবে)
    else if (action === 'new_order') {
      payload.filters = [{ field: "tag", key: "role", relation: "=", value: "admin" }];
      payload.headings = { en: "🛒 নতুন অর্ডার এসেছে!" };
      payload.contents = { 
        en: `প্যাকেজ: ${data.productName || 'Package'}\nমূল্য: ৳${data.price || 0} | গেম: ${data.gameName || 'Game'}` 
      };
      payload.data = { type: 'admin_order', orderId: data.orderId || '' };
    }

    // ৪. ডিপোজিট এলার্ট (শুধুমাত্র অ্যাডমিন ফোনে যাবে)
    else if (action === 'new_deposit') {
      payload.filters = [{ field: "tag", key: "role", relation: "=", value: "admin" }];
      payload.headings = { en: "💰 নতুন ডিপোজিট রিকোয়েস্ট!" };
      payload.contents = { 
        en: `পরিমাণ: ৳${data.amount || 0} (${data.method || 'MFS'})\nTrxID: ${data.trxId || 'N/A'}` 
      };
      payload.data = { type: 'admin_deposit', trxId: data.trxId || '' };
    }

    // ৫. অ্যাডমিন টেস্ট নোটিফিকেশন
    else if (action === 'test_admin') {
      payload.filters = [{ field: "tag", key: "role", relation: "=", value: "admin" }];
      payload.headings = { en: "🔔 অ্যাডমিন এলার্ট টেস্ট" };
      payload.contents = { en: "আপনার অ্যাডমিন ডিভাইস নোটিফিকেশন পাওয়ার জন্য সম্পূর্ণ প্রস্তুত!" };
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

    // সঠিক এরর মেসেজ হ্যান্ডলিং
    if (responseData.errors && Array.isArray(responseData.errors)) {
      if (responseData.errors.some(err => err.includes("not subscribed") || err.includes("All included players are not subscribed"))) {
        if (action === 'broadcast_customer') {
          return res.status(400).json({
            success: false,
            error: "আপনার সাইটে এখনও কোনো কাস্টমার নোটিফিকেশন চালু (Allow) করেনি! কোনো ইউজার সাইটে ঢুকে Allow করলেই এই ব্রডকাস্ট সবার ফোনে যাবে।"
          });
        } else {
          return res.status(400).json({
            success: false,
            error: "অ্যাডমিন ডিভাইসের ট্যাগ সিঙ্ক হতে কয়েক সেকেন্ড সময় নিচ্ছে। অনুগ্রহ করে ৫ সেকেন্ড পর আবার টেস্ট বাটনে চাপুন।"
          });
        }
      }
    }

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
