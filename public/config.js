// public/config.js

// =================================================================
// SUPABASE CONFIGURATION
// =================================================================
// 请在此处填入您自己的 Supabase 项目信息。
// 您可以在 Supabase 项目的 "Settings" -> "API" 页面找到这些信息。
// 确保使用 "anon (public)" key，而不是 "service_role (secret)" key。
// =================================================================

window.SUPABASE_CONFIG = {
    // 您的 Supabase 项目 URL
    url: 'https://aoztpatkhjnogqyhkokf.supabase.co', 
    
    // 您的 Supabase 项目公开匿名 Key
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvenRwYXRraGpub2dxeWhrb2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNzI4OTYsImV4cCI6MjA1OTc0ODg5Nn0.jMNkNa2tsOH9IMK3-KnmpYJfbNoa_b2VaNFk29rgHE0', 
    
    // 您在 Supabase Storage 中创建的存储桶的名称
    storageBucket: 'videos',
};


// =================================================================
// DO NOT EDIT BELOW THIS LINE
// =================================================================
// 通用的 Toast 通知功能
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found!');
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
} 