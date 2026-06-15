/* ============================================
   Authentication Module (Updated for Backend API)
   ============================================ */

async function registerUser(name, email, password, role) {
    if (!name || !email || !password || !role) {
        return { success: false, message: 'All fields are required' };
    }
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            if (json.success && json.data) {
                setCurrentUser(json.data);
            }
            return json;
        } catch (parseErr) {
            console.error('Non-JSON response from server:', text.substring(0, 200));
            return { success: false, message: 'Server error. Please try again.' };
        }
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Server communication error. Is the server running?' };
    }
}

async function loginUser(email, password) {
    if (!email || !password) return { success: false, message: 'Email and password are required' };
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            console.error('Non-JSON response from server:', text.substring(0, 200));
            return { success: false, message: 'Server error. Please try again.' };
        }
        if (json.success) {
            setCurrentUser(json.data);
            return { success: true, data: json.data };
        }
        return { success: false, message: json.message || 'Invalid email or password' };
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Server communication error. Is the server running?' };
    }
}

async function logoutUser() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
        console.error('API Error:', e);
    }
    clearCurrentUser();
    window.location.href = 'index.html';
}

function isLoggedIn() {
    return getCurrentUser() !== null;
}

function getCurrentUserRole() {
    const user = getCurrentUser();
    return user ? user.role : null;
}
