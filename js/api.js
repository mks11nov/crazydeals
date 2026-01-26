// ===================================
// API Handler
// This file uses configuration from api-config.js
// ===================================

// Wait for config to load
if (!window.API_CONFIG) {
    console.error('❌ API Config not loaded! Make sure api-config.js is loaded before api.js');
}

// Get configuration
const getConfig = () => window.API_CONFIG;
const isSupabase = () => getConfig().isSupabase();
const isRest = () => getConfig().isRest();

let supabaseClient = null;

if (isSupabase()) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
        const config = getConfig().backend;
        supabaseClient = supabase.createClient(config.url, config.anonKey);
        console.log('✅ Supabase client initialized');
    };
    document.head.appendChild(script);
}
    


// ===================================
// Authentication Helpers
// ===================================

const Auth = {
    getToken() {
        return localStorage.getItem('authToken');
    },

    setToken(token) {
        localStorage.setItem('authToken', token);
    },

    removeToken() {
        localStorage.removeItem('authToken');
    },

    getUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    },

    setUser(userData) {
        localStorage.setItem('userData', JSON.stringify(userData));
    },

    removeUser() {
        localStorage.removeItem('userData');
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    logout() {
        this.removeToken();
        this.removeUser();
        Cart.clearLocalCart();
        window.location.href = 'index.html';
    }
};


// ===================================
// REST API Request Helper
// ===================================

async function restApiRequest(endpoint, options = {}) {
    const config = getConfig().backend;
    const url = `${config.baseURL}${endpoint}`;
    
    const requestConfig = {
        ...options,
        headers: {
            ...config.headers,
            ...options.headers
        }
    };

    const token = Auth.getToken();
    if (token) {
        requestConfig.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, requestConfig);
        const data = await response.json();

        if (response.status === 401) {
            Auth.logout();
            return { success: false, message: 'Session expired. Please login again.' };
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        return { 
            success: false, 
            message: 'Network error. Please check your connection.', 
            error: error.message 
        };
    }
}

// ===================================
// Supabase Helper Functions
// ===================================

async function waitForSupabase() {
    let attempts = 0;
    while ( !supabaseClient && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    if (!supabaseClient) {
        throw new Error('Supabase client failed to initialize');
    }
    return supabaseClient;
}

async function getSupabaseToken() {
    const client = await waitForSupabase();
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || null;
}

async function callSupabaseFunction(functionPath, options = {}) {
    const client = await waitForSupabase();
    const token = await getSupabaseToken();
    
    // Parse function name and path
    const parts = functionPath.split('/');
    const functionName = parts[0];
    const additionalPath = parts.slice(1).join('/');
    
    // Build the full URL if there's an additional path
    let url = getConfig().backend.functionsUrl + '/' + functionName;
    if (additionalPath) {
        url += '/' + additionalPath;
    }
    
    // Add query params if GET request
    if (options.queryParams) {
        url += '?' + new URLSearchParams(options.queryParams);
    }
    
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Supabase function error:', error);
        return { success: false, message: error.message };
    }
}

// ===================================
// Authentication API
// ===================================

const AuthAPI = {
    async register(userData) {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data, error } = await client.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        phone: userData.phone
                    }
                }
            });

            if (error) {
                return { 
                    success: false, 
                    message: error.message, 
                    errors: [{ field: 'email', message: error.message }] 
                };
            }

            const token = data.session?.access_token;
            if (token) {
                Auth.setToken(token);
                Auth.setUser({
                    userId: data.user.id,
                    email: data.user.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    phone: userData.phone
                });
            }

            return {
                success: true,
                message: 'Registration successful',
                data: {
                    userId: data.user.id,
                    email: data.user.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    token: token
                }
            };
        } else {
            const endpoint = getConfig().endpoints.auth.register;
            return await restApiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        }
    },

    async login(email, password) {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                return { 
                    success: false, 
                    message: 'Invalid credentials', 
                    errors: [{ field: 'password', message: 'Email or password is incorrect' }] 
                };
            }

            // Get user profile
            const { data: profile } = await client
                .from('user_profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            const userData = {
                userId: data.user.id,
                email: data.user.email,
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
                phone: profile?.phone || ''
            };

            Auth.setToken(data.session.access_token);
            Auth.setUser(userData);

            return {
                success: true,
                message: 'Login successful',
                data: { ...userData, token: data.session.access_token }
            };
        } else {
            const endpoint = getConfig().endpoints.auth.login;
            const response = await restApiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                Auth.setToken(response.data.token);
                Auth.setUser(response.data);
            }

            return response;
        }
    },

    async getProfile() {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data: { user } } = await client.auth.getUser();
            
            if (!user) return { success: false, message: 'Not authenticated' };

            const { data: profile } = await client
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            return {
                success: true,
                data: {
                    userId: user.id,
                    email: user.email,
                    firstName: profile?.first_name || '',
                    lastName: profile?.last_name || '',
                    phone: profile?.phone || '',
                    createdAt: profile?.created_at
                }
            };
        } else {
            const endpoint = getConfig().endpoints.auth.profile;
            return await restApiRequest(endpoint);
        }
    },

    async logout() {
        // Sync server cart to local before logout
        console.log('🔄 Syncing cart before logout...');
        try {
            await CartSync.autoSyncBeforeLogout();
        } catch (error) {
            console.error('Cart sync before logout failed:', error);
            // Continue with logout even if sync fails
        }

        if (isSupabase()) {
            const client = await waitForSupabase();
            await client.auth.signOut();
        } else {
            const endpoint = getConfig().endpoints.auth.logout;
            await restApiRequest(endpoint, { method: 'POST' });
        }
        
        Auth.logout();
        return { success: true, message: 'Logout successful' };
    }
};

// ===================================
// Cart API
// ===================================

const CartAPI = {
    async getCart() {
        if (isSupabase()) {
            return await callSupabaseFunction('cart', { method: 'GET' });
        } else {
            const endpoint = getConfig().endpoints.cart.get;
            return await restApiRequest(endpoint);
        }
    },

    async addItem(productId, quantity = 1) {
        if (isSupabase()) {
            // Get product details from API
            const productResponse = await ProductAPI.getProductsById(productId);

            if (!productResponse || !productResponse.success || !productResponse.data) {
                return { success: false, message: 'Product not found' };
            }

            const product = productResponse.data;

            // Handle case where data might be 'undefined' string
            if (!product || product === 'undefined' || typeof product !== 'object') {
                return { success: false, message: 'Product not found' };
            }

            return await callSupabaseFunction('cart/items', {
                method: 'POST',
                body: {
                    productId: product.id,
                    quantity,
                    productName: product.name,
                    productPrice: product.price,
                    productImage: product.image
                }
            });
        } else {
            const endpoint = getConfig().endpoints.cart.add;
            return await restApiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify({ productId, quantity })
            });
        }
    },

    async updateItem(cartItemId, quantity) {
        if (isSupabase()) {
            return await callSupabaseFunction(`cart/items/${cartItemId}`, {
                method: 'PUT',
                body: { quantity }
            });
        } else {
            const endpoint = getConfig().endpoints.cart.update(cartItemId);
            return await restApiRequest(endpoint, {
                method: 'PUT',
                body: JSON.stringify({ quantity })
            });
        }
    },

    async removeItem(cartItemId) {
        if (isSupabase()) {
            return await callSupabaseFunction(`cart/items/${cartItemId}`, {
                method: 'DELETE'
            });
        } else {
            const endpoint = getConfig().endpoints.cart.remove(cartItemId);
            return await restApiRequest(endpoint, {
                method: 'DELETE'
            });
        }
    },

    async clearCart() {
        if (isSupabase()) {
            return await callSupabaseFunction('cart', { method: 'DELETE' });
        } else {
            const endpoint = getConfig().endpoints.cart.clear;
            return await restApiRequest(endpoint, {
                method: 'DELETE'
            });
        }
    }
};

// ===================================
// Order API
// ===================================

const OrderAPI = {
    async placeOrder(orderData) {
        if (isSupabase()) {
            return await callSupabaseFunction('orders', {
                method: 'POST',
                body: orderData
            });
        } else {
            const endpoint = getConfig().endpoints.orders.create;
            return await restApiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(orderData)
            });
        }
    },

    async getOrders(page = 1, limit = 10, status = null) {
        if (isSupabase()) {
            const params = { page: page.toString(), limit: limit.toString() };
            if (status) params.status = status;
            
            return await callSupabaseFunction('orders', {
                method: 'GET',
                queryParams: params
            });
        } else {
            let endpoint = `${getConfig().endpoints.orders.list}?page=${page}&limit=${limit}`;
            if (status) endpoint += `&status=${status}`;
            return await restApiRequest(endpoint);
        }
    },

    async getOrderDetails(orderId) {
        if (isSupabase()) {
            return await callSupabaseFunction(`orders/${orderId}`, {
                method: 'GET'
            });
        } else {
            const endpoint = getConfig().endpoints.orders.get(orderId);
            return await restApiRequest(endpoint);
        }
    },

    async cancelOrder(orderId, reason) {
        if (isSupabase()) {
            return await callSupabaseFunction(`orders/${orderId}`, {
                method: 'DELETE',
                body: { reason }
            });
        } else {
            const endpoint = getConfig().endpoints.orders.cancel(orderId);
            return await restApiRequest(endpoint, {
                method: 'DELETE',
                body: JSON.stringify({ reason })
            });
        }
    }
};

// ===================================
// Address API
// ===================================

const AddressAPI = {
    async getAddresses() {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data } = await client.from('addresses').select('*');
            return { success: true, data: { addresses: data || [] } };
        } else {
            const endpoint = getConfig().endpoints.addresses.list;
            return await restApiRequest(endpoint);
        }
    },

    async addAddress(addressData) {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data, error } = await client
                .from('addresses')
                .insert(addressData)
                .select()
                .single();
            
            if (error) return { success: false, message: error.message };
            return { success: true, data };
        } else {
            const endpoint = getConfig().endpoints.addresses.create;
            return await restApiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(addressData)
            });
        }
    },

    async updateAddress(addressId, addressData) {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data, error } = await client
                .from('addresses')
                .update(addressData)
                .eq('id', addressId)
                .select()
                .single();
            
            if (error) return { success: false, message: error.message };
            return { success: true, data };
        } else {
            const endpoint = getConfig().endpoints.addresses.update(addressId);
            return await restApiRequest(endpoint, {
                method: 'PUT',
                body: JSON.stringify(addressData)
            });
        }
    },

    async deleteAddress(addressId) {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { error } = await client
                .from('addresses')
                .delete()
                .eq('id', addressId);
            
            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Address deleted' };
        } else {
            const endpoint = getConfig().endpoints.addresses.delete(addressId);
            return await restApiRequest(endpoint, {
                method: 'DELETE'
            });
        }
    }
};

// ===================================
// Local Cart Management (Fallback)
// For when user is not logged in or API is unavailable
// ===================================

const Cart = {
    // Get local cart
    getLocalCart() {
        const cart = localStorage.getItem('localCart');
        return cart ? JSON.parse(cart) : { items: [] };
    },

    // Save local cart
    saveLocalCart(cart) {
        localStorage.setItem('localCart', JSON.stringify(cart));
        this.updateCartBadge();
    },

    // Clear local cart
    clearLocalCart() {
        localStorage.removeItem('localCart');
        this.updateCartBadge();
    },

    // Add item to local cart
    addToLocalCart(product, quantity = 1) {
        const cart = this.getLocalCart();
        const existingItem = cart.items.find(item => item.productId === product.id);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: quantity
            });
        }

        this.saveLocalCart(cart);
        return cart;
    },

    // Update item in local cart
    updateLocalCartItem(productId, quantity) {
        const cart = this.getLocalCart();
        const item = cart.items.find(item => item.productId === productId);

        if (item) {
            if (quantity <= 0) {
                cart.items = cart.items.filter(item => item.productId !== productId);
            } else {
                item.quantity = quantity;
            }
            this.saveLocalCart(cart);
        }

        return cart;
    },

    // Remove item from local cart
    removeFromLocalCart(productId) {
        const cart = this.getLocalCart();
        cart.items = cart.items.filter(item => item.productId !== productId);
        this.saveLocalCart(cart);
        return cart;
    },

    // Get cart count
    getCartCount() {
        const cart = this.getLocalCart();
        return cart.items.reduce((total, item) => total + item.quantity, 0);
    },

    // Calculate cart total
    calculateTotal() {
        const cart = this.getLocalCart();
        const subtotal = cart.items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        const tax = subtotal * 0.09; // 9% tax
        const shipping = subtotal > 100 ? 0 : 15; // Free shipping over $100
        const total = subtotal + tax + shipping;

        return {
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            shipping: shipping.toFixed(2),
            total: total.toFixed(2)
        };
    },

    // Update cart badge
    async updateCartBadge() {
        const badge = document.getElementById('cartBadge');
        if (!badge) return;
        
        let itemCount = 0;
        
        if (Auth.isLoggedIn()) {
            // Get count from server
            try {
                const response = await CartAPI.getCart();
                if (response.success) {
                    itemCount = response.data.itemCount || 0;
                }
            } catch (error) {
                console.error('Error fetching cart count:', error);
                // Fallback to local cart
                const localCart = this.getLocalCart();
                itemCount = (localCart.items || []).reduce((sum, item) => sum + item.quantity, 0);
            }
        } else {
            // Get count from local storage
            const localCart = this.getLocalCart();
            itemCount = (localCart.items || []).reduce((sum, item) => sum + item.quantity, 0);
        }
        
        badge.textContent = itemCount;
        
        if (itemCount > 0) {
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
        
        console.log(`🔄 Cart badge updated: ${itemCount} items`);
    }
};

// ===================================
// Product API Helper
// ===================================

const ProductAPI = {
    async getProducts() {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data } = await client.from('products')
            .select('*');
            //.order('created_at', { ascending: false });
            return { success: true, data: { products: data || [] } };
        } else {
            const endpoint = getConfig().endpoints.product.list;
            return await restApiRequest(endpoint);
        }
    },

    async getProductsById(productId) {
        if (isSupabase()) {
            const client = await waitForSupabase();
            const { data } = await client.from('products')
            .select()
            .eq('id', productId)
            .single();
            
            return { success: true, data: data || 'undefined' };
        } else {
            const endpoint = getConfig().endpoints.product.list;
            return await restApiRequest(endpoint);
        }
    }

}

// ===================================
// Toast Notification Helper
// ===================================

const Toast = {
    show(message, type = 'success') {
        // Remove existing toasts
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    success(message) {
        this.show(message, 'success');
    },

    error(message) {
        this.show(message, 'error');
    },

    info(message) {
        this.show(message, 'info');
    }
};

// ===================================
// Form Validation Helpers
// ===================================

const Validator = {
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    phone(phone) {
        const re = /^[\d\s\-\+\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    zipCode(zip) {
        const re = /^\d{5}(-\d{4})?$/;
        return re.test(zip);
    },

    password(password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        return password.length >= 8 &&
               /[A-Z]/.test(password) &&
               /[a-z]/.test(password) &&
               /\d/.test(password);
    },

    required(value) {
        return value && value.trim().length > 0;
    }
};

// ===================================
// Initialize on Load
// ===================================

document.addEventListener('DOMContentLoaded', async() => {
     try {
        await Cart.updateCartBadge();
    } catch (error) {
        console.error('Cart badge update failed:', error);
    }
});

console.log('✅ API Handler initialized with backend:', getConfig().backendType);