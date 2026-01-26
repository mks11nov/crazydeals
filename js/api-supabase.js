// js/api-supabase.js
// ===================================
// Supabase API Adapter
// This file adapts Supabase API calls to match the generic API interface
// ===================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Initialize Supabase client
const supabaseUrl = 'https://pmlhajcdqsfxlfvkzljw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtbGhhamNkcXNmeGxmdmt6bGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjMzNTEsImV4cCI6MjA4MzE5OTM1MX0.3nWHcHvZgn96GA1psf7InSReZ7r11x1IDdfKcI9L11M'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===================================
// Helper: Get Auth Token
// ===================================
async function getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
}

// ===================================
// Helper: Make Edge Function Request
// ===================================
async function callEdgeFunction(functionName, options = {}) {
    const token = await getAuthToken()
    
    const { data, error } = await supabase.functions.invoke(functionName, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`
        }
    })

    if (error) {
        return {
            success: false,
            message: error.message
        }
    }

    return data
}

// ===================================
// Authentication API Adapter
// ===================================
export const AuthAPIAdapter = {
    async register(userData) {
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    phone: userData.phone
                }
            }
        })

        if (error) {
            return {
                success: false,
                message: error.message,
                errors: [{ field: 'email', message: error.message }]
            }
        }

        return {
            success: true,
            message: 'Registration successful',
            data: {
                userId: data.user.id,
                email: data.user.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                token: data.session?.access_token,
                refreshToken: data.session?.refresh_token,
                expiresIn: data.session?.expires_in
            }
        }
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            return {
                success: false,
                message: 'Invalid credentials',
                errors: [{ field: 'password', message: 'Email or password is incorrect' }]
            }
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single()

        return {
            success: true,
            message: 'Login successful',
            data: {
                userId: data.user.id,
                email: data.user.email,
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
                phone: profile?.phone || '',
                token: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in
            }
        }
    },

    async getProfile() {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
            return { success: false, message: 'Not authenticated' }
        }

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()

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
        }
    },

    async logout() {
        await supabase.auth.signOut()
        return { success: true, message: 'Logout successful' }
    }
}

// ===================================
// Cart API Adapter
// ===================================
export const CartAPIAdapter = {
    async getCart() {
        return await callEdgeFunction('cart', {
            method: 'GET'
        })
    },

    async addItem(productId, quantity) {
        // Get product details from local products.json
        //const response = await fetch('data/products.json')
        const response = await ProductAPI.getProductsById(productId);
        const { products } = await response.data;
        
        if (!product) {
            return { success: false, message: 'Product not found' }
        }

        return await callEdgeFunction('cart', {
            method: 'POST',
            body: {
                productId: product.id,
                quantity,
                productName: product.name,
                productPrice: product.price,
                productImage: product.image
            }
        })
    },

    async updateItem(cartItemId, quantity) {
        return await callEdgeFunction('cart', {
            method: 'PUT',
            body: { quantity }
        })
    },

    async removeItem(cartItemId) {
        return await callEdgeFunction('cart', {
            method: 'DELETE'
        })
    },

    async clearCart() {
        return await callEdgeFunction('cart', {
            method: 'DELETE'
        })
    }
}

// ===================================
// Order API Adapter
// ===================================
export const OrderAPIAdapter = {
    async placeOrder(orderData) {
        return await callEdgeFunction('orders', {
            method: 'POST',
            body: orderData
        })
    },

    async getOrders(page = 1, limit = 10, status = null) {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
        if (status) params.append('status', status)
        
        return await callEdgeFunction(`orders?${params.toString()}`, {
            method: 'GET'
        })
    },

    async getOrderDetails(orderId) {
        return await callEdgeFunction(`orders/${orderId}`, {
            method: 'GET'
        })
    },

    async cancelOrder(orderId, reason) {
        return await callEdgeFunction(`orders/${orderId}`, {
            method: 'DELETE',
            body: { reason }
        })
    }
}

export  const ProductAPIAdapter = {
    async getProducts() {        
        try {
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            return { success: true, data: data || [] };

        } catch (error) {
            console.error('Error fetching products:', error);
            return { success: false, message: error.message };
        }
    },

    async getProductById(productId) {        
        try {
            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await supabase
                .from('products')
                .eq('id', productId)
                .select()
                .single();
            
            if (error) throw error;
            
            return { success: true, data: data || [] };

        } catch (error) {
            console.error('Error fetching products:', error);
            return { success: false, message: error.message };
        }
    }
}
// ===================================
// Export Supabase Client (for direct access if needed)
// ===================================
export { supabase }
