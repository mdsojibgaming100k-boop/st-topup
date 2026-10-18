export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action, title, message, image, url, apiKey, appId, data } = req.body;
  if (!apiKey || !appId) return res.status(400).json({ error: 'API Key & App ID are required' });

  let payload = {
    app_id: appId,
    headings: { en: title || 'DRL TOPUP' },
    contents: { en: message || '' },
    url: url || undefined,
    big_picture: image || undefined,
    chrome_web_image: image || undefined
  };

  if (action === 'broadcast_customer') {
    payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: 'customer' }];
  } else if (action === 'single_user' && data?.userId) {
    payload.include_aliases = { external_id: [data.userId] };
    payload.target_channel = "push";
  } else if (action === 'test_admin') {
    payload.headings = { en: 'অ্যাডমিন পুশ এলার্ট টেস্ট 🔔' };
    payload.contents = { en: 'আপনার ফোনটিতে সফলভাবে অ্যাডমিন এলার্ট চালু হয়েছে।' };
    payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }];
  } else if (action === 'new_order') {
    payload.headings = { en: 'নতুন অর্ডার এসেছে! 🛒' };
    payload.contents = { en: `${data?.productName} - ৳${data?.price} | অর্ডার আইডি: #${data?.orderId?.slice(-6)}` };
    payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }];
  } else if (action === 'new_deposit') {
    payload.headings = { en: 'নতুন ডিপোজিট রিকোয়েস্ট! 💰' };
    payload.contents = { en: `${data?.method}: ৳${data?.amount} | TrxID: ${data?.trxId}` };
    payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }];
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return res.status(200).json({ success: true, recipients: result.recipients || 1, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
